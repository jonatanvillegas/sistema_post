const { Producto, Kardex } = require('./producto.model');
const ExcelJS = require('exceljs');
const { crearAsientoInventarioSiActivo } = require('../contabilidad/contabilidad.service');

const isControlaStock = (producto) => producto?.controlaStock !== false;

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const calcPrecioVentaFromMargen = (precioCompra, margenGanancia) => {
  const pc = Number(precioCompra);
  const margen = Number(margenGanancia);
  if (!Number.isFinite(pc) || pc < 0) return null;
  if (!Number.isFinite(margen) || margen < 0 || margen >= 100) return null;
  return round2(pc / (1 - margen / 100));
};

const normalizeOptionalCode = (codigo) => {
  const value = String(codigo ?? '').trim();
  return value ? value : undefined;
};

// @GET /api/inventario
const getProductos = async (req, res) => {
  try {
    const { buscar, categoria, stockBajo, limit } = req.query;
    const filtro = { estado: true };
    const limitNum = Number.parseInt(limit, 10);
    const queryLimit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 50) : null;

    if (buscar) {
      filtro.$or = [
        { nombre: { $regex: buscar, $options: 'i' } },
        { codigo: { $regex: buscar, $options: 'i' } },
      ];
    }
    if (categoria) filtro.categoria = categoria;
    if (stockBajo === 'true') {
      // Excluir productos que no controlan stock
      filtro.controlaStock = { $ne: false };
      filtro.$expr = { $lte: ['$stock', '$stockMinimo'] };
    }

    let query = Producto.find(filtro)
      .populate('proveedorId', 'nombre')
      .sort({ nombre: 1 });

    if (queryLimit) {
      query = query.limit(queryLimit);
    }

    const productos = await query;

    res.json(productos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener productos', error: error.message });
  }
};

// @GET /api/inventario/stock-bajo
const getStockBajo = async (req, res) => {
  try {
    const productos = await Producto.find({
      estado: true,
      controlaStock: { $ne: false },
      $expr: { $lte: ['$stock', '$stockMinimo'] },
    }).sort({ stock: 1 });

    res.json({ total: productos.length, productos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener stock bajo', error: error.message });
  }
};

// @GET /api/inventario/:id
const getProductoById = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id).populate('proveedorId', 'nombre telefono');
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });
    res.json(producto);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener producto', error: error.message });
  }
};

// @PUT /api/inventario/:id/dar-baja-danado
const darBajaStockDanado = async (req, res) => {
  try {
    const { cantidad, motivo } = req.body;
    const qty = Number(cantidad || 0);

    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ mensaje: 'La cantidad a dar de baja debe ser mayor a cero' });
    }

    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });

    const stockDanadoActual = Number(producto.stockDanado || 0);
    if (stockDanadoActual < qty) {
      return res.status(400).json({
        mensaje: `Stock dañado insuficiente para "${producto.nombre}". Disponible: ${stockDanadoActual}`,
      });
    }

    producto.stockDanado = stockDanadoActual - qty;
    await producto.save();

    const kardex = await Kardex.create({
      productoId: producto._id,
      tipo: 'ajuste',
      cantidad: qty,
      stockAnterior: stockDanadoActual,
      stockNuevo: producto.stockDanado,
      motivo: motivo || 'Baja de producto dañado',
      usuarioId: req.user._id,
    });

    try {
      await crearAsientoInventarioSiActivo({ producto, kardex, usuarioId: req.user._id });
    } catch (contabilidadError) {
      console.warn(`[contabilidad] No se pudo generar asiento por baja de inventario:`, contabilidadError.message);
    }

    res.json({ mensaje: 'Producto dañado dado de baja correctamente', producto });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al dar de baja stock dañado', error: error.message });
  }
};

// @POST /api/inventario
const createProducto = async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.codigo = normalizeOptionalCode(payload.codigo);
    if (!payload.codigo) delete payload.codigo;
    if (payload.controlaStock === false) {
      payload.stock = 0;
      payload.stockMinimo = 0;
    }

    const producto = await Producto.create(payload);

    // Registrar en kardex como entrada inicial
    if (isControlaStock(producto) && producto.stock > 0) {
      const kardex = await Kardex.create({
        productoId: producto._id,
        tipo: 'entrada',
        cantidad: producto.stock,
        stockAnterior: 0,
        stockNuevo: producto.stock,
        motivo: 'Stock inicial',
        usuarioId: req.user._id,
      });

      try {
        await crearAsientoInventarioSiActivo({ producto, kardex, usuarioId: req.user._id });
      } catch (contabilidadError) {
        console.warn(`[contabilidad] No se pudo generar asiento por stock inicial:`, contabilidadError.message);
      }
    }

    res.status(201).json(producto);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear producto', error: error.message });
  }
};

// @PUT /api/inventario/:id
const updateProducto = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });

    const stockAnterior = producto.stock;

    const incoming = { ...req.body };
    incoming.codigo = normalizeOptionalCode(incoming.codigo);
    if (!incoming.codigo) {
      delete incoming.codigo;
      producto.codigo = undefined;
    }
    if (incoming.controlaStock === false) {
      incoming.stock = 0;
      incoming.stockMinimo = 0;
    }

    Object.assign(producto, incoming);
    await producto.save();

    // Si cambió el stock, registrar en kardex
    if (isControlaStock(producto) && req.body.stock !== undefined && req.body.stock !== stockAnterior) {
      const diferencia = producto.stock - stockAnterior;
      const kardex = await Kardex.create({
        productoId: producto._id,
        tipo: diferencia > 0 ? 'entrada' : 'ajuste',
        cantidad: Math.abs(diferencia),
        stockAnterior,
        stockNuevo: producto.stock,
        motivo: req.body.motivoAjuste || 'Ajuste manual',
        usuarioId: req.user._id,
      });

      try {
        await crearAsientoInventarioSiActivo({ producto, kardex, usuarioId: req.user._id });
      } catch (contabilidadError) {
        console.warn(`[contabilidad] No se pudo generar asiento por ajuste de inventario:`, contabilidadError.message);
      }
    }

    res.json({ mensaje: 'Producto actualizado', producto });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar producto', error: error.message });
  }
};

// @POST /api/inventario/import
// Body: { productos: [{ nombre, codigo?, categoria?, precioCompra, margenGanancia, stock?, stockMinimo?, controlaStock?, descripcion? }], actualizarExistentes?: true }
const importInventarioMasivo = async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.productos) ? req.body.productos : [];
    const actualizarExistentes = req.body?.actualizarExistentes !== false;

    if (rows.length === 0) {
      return res.status(400).json({ mensaje: 'Debe enviar al menos un producto para importar' });
    }

    const errores = [];
    const creados = [];
    const actualizados = [];
    const codigosEnArchivo = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const fila = Number(row.fila || i + 2);
      const nombre = String(row.nombre || '').trim();
      const codigo = normalizeOptionalCode(row.codigo);
      const precioCompra = Number(row.precioCompra);
      const margenGanancia = Number(row.margenGanancia);
      const precioVenta = calcPrecioVentaFromMargen(precioCompra, margenGanancia);
      const controlaStock = row.controlaStock === false || String(row.controlaStock || '').toLowerCase() === 'no' ? false : true;
      const stock = controlaStock ? Number(row.stock || 0) : 0;
      const stockMinimo = controlaStock ? Number(row.stockMinimo ?? 5) : 0;

      if (!nombre) {
        errores.push({ fila, mensaje: 'El nombre es requerido' });
        continue;
      }
      if (codigo) {
        if (codigosEnArchivo.has(codigo)) {
          errores.push({ fila, mensaje: `Código repetido en el archivo: ${codigo}` });
          continue;
        }
        codigosEnArchivo.add(codigo);
      }
      if (precioVenta === null) {
        errores.push({ fila, mensaje: 'Precio compra o margen inválido. El margen debe estar entre 0 y 99' });
        continue;
      }
      if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(stockMinimo) || stockMinimo < 0) {
        errores.push({ fila, mensaje: 'Stock o stock mínimo inválido' });
        continue;
      }

      try {
        let producto = codigo ? await Producto.findOne({ codigo }) : null;
        const payload = {
          nombre,
          precioCompra,
          precioVenta,
          stock,
          stockMinimo,
          controlaStock,
          categoria: String(row.categoria || 'General').trim() || 'General',
          descripcion: String(row.descripcion || '').trim(),
          estado: true,
        };
        if (codigo) payload.codigo = codigo;
        if (row.proveedorId) payload.proveedorId = row.proveedorId;

        if (producto && actualizarExistentes) {
          const stockAnterior = Number(producto.stock || 0);
          Object.assign(producto, payload);
          await producto.save();

          const diferencia = Number(producto.stock || 0) - stockAnterior;
          if (isControlaStock(producto) && diferencia !== 0) {
            const kardex = await Kardex.create({
              productoId: producto._id,
              tipo: diferencia > 0 ? 'entrada' : 'ajuste',
              cantidad: Math.abs(diferencia),
              stockAnterior,
              stockNuevo: producto.stock,
              motivo: 'Carga masiva de inventario',
              usuarioId: req.user._id,
            });

            try {
              await crearAsientoInventarioSiActivo({ producto, kardex, usuarioId: req.user._id });
            } catch (contabilidadError) {
              console.warn(`[contabilidad] No se pudo generar asiento por carga masiva:`, contabilidadError.message);
            }
          }

          actualizados.push({ fila, id: producto._id, nombre: producto.nombre, codigo: producto.codigo || '' });
          continue;
        }

        if (producto && !actualizarExistentes) {
          errores.push({ fila, mensaje: `Ya existe un producto con código ${codigo}` });
          continue;
        }

        producto = await Producto.create(payload);
        if (isControlaStock(producto) && Number(producto.stock || 0) > 0) {
          const kardex = await Kardex.create({
            productoId: producto._id,
            tipo: 'entrada',
            cantidad: producto.stock,
            stockAnterior: 0,
            stockNuevo: producto.stock,
            motivo: 'Carga masiva de inventario',
            usuarioId: req.user._id,
          });

          try {
            await crearAsientoInventarioSiActivo({ producto, kardex, usuarioId: req.user._id });
          } catch (contabilidadError) {
            console.warn(`[contabilidad] No se pudo generar asiento por carga masiva:`, contabilidadError.message);
          }
        }

        creados.push({ fila, id: producto._id, nombre: producto.nombre, codigo: producto.codigo || '' });
      } catch (error) {
        errores.push({ fila, mensaje: error.message });
      }
    }

    res.json({
      mensaje: 'Carga masiva procesada',
      resumen: {
        recibidos: rows.length,
        creados: creados.length,
        actualizados: actualizados.length,
        errores: errores.length,
      },
      creados,
      actualizados,
      errores,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al importar inventario', error: error.message });
  }
};

// @GET /api/inventario/import/plantilla
const descargarPlantillaImportInventario = async (_req, res) => {
  const header = [
    'nombre',
    'codigo_opcional',
    'categoria',
    'precio_compra',
    'margen_ganancia',
    'stock',
    'stock_minimo',
    'controla_stock',
    'descripcion',
  ].join(',');
  const ejemplo = [
    'Producto ejemplo',
    '',
    'General',
    '100',
    '30',
    '10',
    '5',
    'SI',
    'Código de barras opcional; el precio de venta se calcula con el margen',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla_carga_inventario.csv"');
  res.send(`\ufeff${header}\n${ejemplo}`);
};

// @DELETE /api/inventario/:id  (desactivar)
const deleteProducto = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });

    producto.estado = false;
    await producto.save();

    res.json({ mensaje: 'Producto desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar producto', error: error.message });
  }
};

// @GET /api/inventario/kardex/:id
const getKardex = async (req, res) => {
  try {
    const kardex = await Kardex.find({ productoId: req.params.id })
      .populate('usuarioId', 'nombre')
      .sort({ createdAt: -1 });

    res.json(kardex);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener kardex', error: error.message });
  }
};

// @GET /api/inventario/export/excel
const exportInventarioExcel = async (req, res) => {
  try {
    const { buscar, categoria, stockBajo } = req.query;
    const filtro = { estado: true };

    if (buscar) {
      filtro.$or = [
        { nombre: { $regex: buscar, $options: 'i' } },
        { codigo: { $regex: buscar, $options: 'i' } },
      ];
    }
    if (categoria) filtro.categoria = categoria;
    if (stockBajo === 'true') {
      filtro.controlaStock = { $ne: false };
      filtro.$expr = { $lte: ['$stock', '$stockMinimo'] };
    }

    const productos = await Producto.find(filtro)
      .populate('proveedorId', 'nombre')
      .sort({ nombre: 1 })
      .lean();

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sistema POS';
    wb.created = new Date();

    const ws = wb.addWorksheet('Inventario');

    ws.columns = [
      { header: 'Código', key: 'codigo', width: 18 },
      { header: 'Producto', key: 'nombre', width: 34 },
      { header: 'Categoría', key: 'categoria', width: 18 },
      { header: 'Proveedor', key: 'proveedor', width: 24 },
      { header: 'Precio compra', key: 'precioCompra', width: 14 },
      { header: 'Precio venta', key: 'precioVenta', width: 14 },
      { header: 'Controla stock', key: 'controlaStock', width: 14 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Stock dañado', key: 'stockDanado', width: 12 },
      { header: 'Stock mínimo', key: 'stockMinimo', width: 12 },
    ];

    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    for (const p of productos) {
      ws.addRow({
        codigo: p?.codigo || '',
        nombre: p?.nombre || '',
        categoria: p?.categoria || 'General',
        proveedor: p?.proveedorId?.nombre || '',
        precioCompra: Number(p?.precioCompra) || 0,
        precioVenta: Number(p?.precioVenta) || 0,
        controlaStock: p?.controlaStock === false ? 'No' : 'Sí',
        stock: Number(p?.stock) || 0,
        stockDanado: Number(p?.stockDanado) || 0,
        stockMinimo: Number(p?.stockMinimo) || 0,
      });
    }

    // Format numeric columns
    ws.getColumn('precioCompra').numFmt = '#,##0.00';
    ws.getColumn('precioVenta').numFmt = '#,##0.00';
    ws.getColumn('stock').numFmt = '#,##0';
    ws.getColumn('stockDanado').numFmt = '#,##0';
    ws.getColumn('stockMinimo').numFmt = '#,##0';

    const pad2 = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const fname = `inventario_${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.setHeader('Cache-Control', 'no-store');

    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al exportar inventario', error: error.message });
  }
};

module.exports = {
  getProductos,
  getStockBajo,
  getProductoById,
  darBajaStockDanado,
  createProducto,
  updateProducto,
  deleteProducto,
  getKardex,
  importInventarioMasivo,
  descargarPlantillaImportInventario,
  exportInventarioExcel,
};
