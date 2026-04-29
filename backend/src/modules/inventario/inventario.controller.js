const { Producto, Kardex } = require('./producto.model');
const ExcelJS = require('exceljs');
const { recordAudit } = require('../audit/audit.controller');

const isControlaStock = (producto) => producto?.controlaStock !== false;

// @GET /api/inventario
const getProductos = async (req, res) => {
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
      // Excluir productos que no controlan stock
      filtro.controlaStock = { $ne: false };
      filtro.$expr = { $lte: ['$stock', '$stockMinimo'] };
    }

    const productos = await Producto.find(filtro)
      .populate('proveedorId', 'nombre')
      .sort({ nombre: 1 });

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

// @POST /api/inventario
const createProducto = async (req, res) => {
  try {
    const payload = { ...req.body };
    
    // Si viene una imagen, guardar el nombre del archivo
    if (req.file) {
      payload.imagen = req.file.filename;
    }

    // Normalizar tipos numéricos (FormData los envía como string)
    if (payload.precioCompra) payload.precioCompra = Number(payload.precioCompra);
    if (payload.precioVenta) payload.precioVenta = Number(payload.precioVenta);
    if (payload.stock) payload.stock = Number(payload.stock);
    if (payload.stockMinimo) payload.stockMinimo = Number(payload.stockMinimo);
    if (payload.controlaStock === 'false') payload.controlaStock = false;
    if (payload.controlaStock === 'true') payload.controlaStock = true;

    if (payload.controlaStock === false) {
      payload.stock = 0;
      payload.stockMinimo = 0;
    }

    const producto = await Producto.create(payload);

    // Registrar en kardex como entrada inicial
    if (isControlaStock(producto) && producto.stock > 0) {
      await Kardex.create({
        productoId: producto._id,
        tipo: 'entrada',
        cantidad: producto.stock,
        stockAnterior: 0,
        stockNuevo: producto.stock,
        motivo: 'Stock inicial',
        usuarioId: req.user._id,
      });
    }

    res.status(201).json(producto);

    await recordAudit({
      usuarioId: req.user._id,
      accion: 'CREATE',
      modulo: 'INVENTARIO',
      detalle: `Producto creado: ${producto.nombre}`,
      metadata: { productoId: producto._id, codigo: producto.codigo },
      req,
    });
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

    // Si viene una nueva imagen, actualizarla
    if (req.file) {
      incoming.imagen = req.file.filename;
    }

    // Normalizar tipos numéricos
    if (incoming.precioCompra) incoming.precioCompra = Number(incoming.precioCompra);
    if (incoming.precioVenta) incoming.precioVenta = Number(incoming.precioVenta);
    if (incoming.stock) incoming.stock = Number(incoming.stock);
    if (incoming.stockMinimo) incoming.stockMinimo = Number(incoming.stockMinimo);
    if (incoming.controlaStock === 'false') incoming.controlaStock = false;
    if (incoming.controlaStock === 'true') incoming.controlaStock = true;

    if (incoming.controlaStock === false) {
      incoming.stock = 0;
      incoming.stockMinimo = 0;
    }

    Object.assign(producto, incoming);
    await producto.save();

    // Si cambió el stock, registrar en kardex
    if (isControlaStock(producto) && incoming.stock !== undefined && incoming.stock !== stockAnterior) {
      const diferencia = producto.stock - stockAnterior;
      await Kardex.create({
        productoId: producto._id,
        tipo: diferencia > 0 ? 'entrada' : 'ajuste',
        cantidad: Math.abs(diferencia),
        stockAnterior,
        stockNuevo: producto.stock,
        motivo: incoming.motivoAjuste || 'Ajuste manual',
        usuarioId: req.user._id,
      });
    }

    res.json({ mensaje: 'Producto actualizado', producto });

    await recordAudit({
      usuarioId: req.user._id,
      accion: 'UPDATE',
      modulo: 'INVENTARIO',
      detalle: `Producto actualizado: ${producto.nombre}`,
      metadata: { productoId: producto._id, cambios: req.body },
      req,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar producto', error: error.message });
  }
};

// @DELETE /api/inventario/:id  (desactivar)
const deleteProducto = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: 'Producto no encontrado' });

    producto.estado = false;
    await producto.save();

    res.json({ mensaje: 'Producto desactivado correctamente' });

    await recordAudit({
      usuarioId: req.user._id,
      accion: 'DELETE',
      modulo: 'INVENTARIO',
      detalle: `Producto desactivado: ${producto.nombre}`,
      metadata: { productoId: producto._id },
      req,
    });
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
        stockMinimo: Number(p?.stockMinimo) || 0,
      });
    }

    // Format numeric columns
    ws.getColumn('precioCompra').numFmt = '#,##0.00';
    ws.getColumn('precioVenta').numFmt = '#,##0.00';
    ws.getColumn('stock').numFmt = '#,##0';
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
  createProducto,
  updateProducto,
  deleteProducto,
  getKardex,
  exportInventarioExcel,
};
