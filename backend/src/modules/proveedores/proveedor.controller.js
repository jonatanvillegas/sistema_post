const { Proveedor, Compra } = require('./proveedor.model');
const { Producto, Kardex } = require('../inventario/producto.model');
const Caja = require('../caja/caja.model');

const isControlaStock = (producto) => producto?.controlaStock !== false;

const toId = (v) => String(v);

const buildCantidadMap = (items = []) => {
  const map = new Map();
  for (const item of items) {
    if (!item?.productoId) continue;
    const key = toId(item.productoId);
    map.set(key, { ...item, productoId: key });
  }
  return map;
};

// @GET /api/proveedores
const getProveedores = async (req, res) => {
  try {
    const proveedores = await Proveedor.find({ estado: true }).sort({ nombre: 1 });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener proveedores', error: error.message });
  }
};

// @GET /api/proveedores/:id
const getProveedorById = async (req, res) => {
  try {
    const proveedor = await Proveedor.findById(req.params.id);
    if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
    res.json(proveedor);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener proveedor', error: error.message });
  }
};

// @POST /api/proveedores
const createProveedor = async (req, res) => {
  try {
    const proveedor = await Proveedor.create(req.body);
    res.status(201).json(proveedor);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear proveedor', error: error.message });
  }
};

// @PUT /api/proveedores/:id
const updateProveedor = async (req, res) => {
  try {
    const proveedor = await Proveedor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
    res.json({ mensaje: 'Proveedor actualizado', proveedor });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar proveedor', error: error.message });
  }
};

// @DELETE /api/proveedores/:id
const deleteProveedor = async (req, res) => {
  try {
    const proveedor = await Proveedor.findById(req.params.id);
    if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });
    proveedor.estado = false;
    await proveedor.save();
    res.json({ mensaje: 'Proveedor eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar proveedor', error: error.message });
  }
};

// @GET /api/proveedores/:id/compras
const getComprasProveedor = async (req, res) => {
  try {
    const compras = await Compra.find({ proveedorId: req.params.id })
      .populate('usuarioId', 'nombre')
      .sort({ fecha: -1 });
    res.json(compras);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener compras', error: error.message });
  }
};

// @GET /api/proveedores/compras/:id
const getCompraById = async (req, res) => {
  try {
    const compra = await Compra.findById(req.params.id)
      .populate('proveedorId', 'nombre')
      .populate('usuarioId', 'nombre')
      .sort({ fecha: -1 });

    if (!compra) return res.status(404).json({ mensaje: 'Compra no encontrada' });
    res.json(compra);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener compra', error: error.message });
  }
};

// @POST /api/proveedores/compras  — registrar compra e incrementar stock
const registrarCompra = async (req, res) => {
  try {
    const { proveedorId, productos, total, numeroFactura, observaciones } = req.body;

    // Caja debe estar abierta para reflejar la salida
    const cajaActiva = await Caja.findOne({ estado: 'abierta' });
    if (!cajaActiva) {
      return res.status(400).json({ mensaje: 'Debe abrir caja antes de registrar compras' });
    }

    const proveedor = await Proveedor.findById(proveedorId);
    if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });

    const productosCompra = [];

    for (const item of productos) {
      const producto = await Producto.findById(item.productoId);
      if (!producto) {
        return res.status(404).json({ mensaje: `Producto ${item.productoId} no encontrado` });
      }

      // Actualizar costo siempre; stock solo si el producto controla stock
      if (item.precioCompra !== undefined && item.precioCompra !== null) {
        producto.precioCompra = item.precioCompra;
      }

      if (isControlaStock(producto)) {
        const stockAnterior = producto.stock;
        producto.stock += item.cantidad;
        await producto.save();

        await Kardex.create({
          productoId: producto._id,
          tipo: 'entrada',
          cantidad: item.cantidad,
          stockAnterior,
          stockNuevo: producto.stock,
          motivo: `Compra a ${proveedor.nombre} - Factura: ${numeroFactura || 'N/A'}`,
          usuarioId: req.user._id,
        });
      } else {
        await producto.save();
      }

      productosCompra.push({
        productoId: producto._id,
        nombre: producto.nombre,
        cantidad: item.cantidad,
        precioUnitario: item.precioCompra || producto.precioCompra,
        subtotal: (item.precioCompra || producto.precioCompra) * item.cantidad,
      });
    }

    const compra = await Compra.create({
      proveedorId,
      productos: productosCompra,
      total,
      numeroFactura,
      observaciones,
      usuarioId: req.user._id,
      cajaId: cajaActiva._id,
    });

    // Registrar egreso en caja
    const concepto = `Compra a ${proveedor.nombre} - Factura: ${numeroFactura || 'N/A'} (${compra._id})`;
    cajaActiva.egresos.push({
      concepto,
      monto: Number(total) || 0,
      tipo: 'egreso',
    });
    const egresoMov = cajaActiva.egresos[cajaActiva.egresos.length - 1];
    await cajaActiva.save();

    compra.egresoId = egresoMov?._id || null;
    await compra.save();

    res.status(201).json({ mensaje: 'Compra registrada correctamente', compra });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar compra', error: error.message });
  }
};

// @PUT /api/proveedores/compras/:id  — corregir compra y recalcular inventario (Admin)
const updateCompra = async (req, res) => {
  try {
    const compra = await Compra.findById(req.params.id);
    if (!compra) return res.status(404).json({ mensaje: 'Compra no encontrada' });

    const { productos, numeroFactura, observaciones } = req.body;
    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ mensaje: 'Debe enviar al menos un producto' });
    }

    const oldMap = buildCantidadMap(compra.productos);
    const newMap = buildCantidadMap(productos);

    // Validar que no se deje el stock en negativo al reducir cantidades
    for (const [productoId, oldItem] of oldMap.entries()) {
      const newItem = newMap.get(productoId);
      const oldQty = Number(oldItem?.cantidad || 0);
      const newQty = Number(newItem?.cantidad || 0);
      const delta = newQty - oldQty;
      if (delta >= 0) continue;

      const producto = await Producto.findById(productoId);
      if (!producto) {
        return res.status(404).json({ mensaje: `Producto ${productoId} no encontrado` });
      }

      if (!isControlaStock(producto)) {
        // No valida stock para productos que no controlan stock
        continue;
      }

      const needed = Math.abs(delta);
      if (producto.stock < needed) {
        return res.status(400).json({
          mensaje: `No se puede reducir ${needed} unidades de "${producto.nombre}" porque el stock actual es ${producto.stock}.`,
        });
      }
    }

    // Aplicar deltas de stock (unión de ids antiguos y nuevos)
    const allIds = new Set([...oldMap.keys(), ...newMap.keys()]);
    const motivo = `Corrección compra ${compra._id} - Factura: ${numeroFactura ?? compra.numeroFactura ?? 'N/A'}`;

    for (const productoId of allIds) {
      const oldQty = Number(oldMap.get(productoId)?.cantidad || 0);
      const newQty = Number(newMap.get(productoId)?.cantidad || 0);
      const delta = newQty - oldQty;
      if (delta === 0) continue;

      const producto = await Producto.findById(productoId);
      if (!producto) {
        return res.status(404).json({ mensaje: `Producto ${productoId} no encontrado` });
      }

      const stockAnterior = producto.stock;
      if (isControlaStock(producto)) {
        producto.stock += delta;
      }

      const incomingPrecioCompra = newMap.get(productoId)?.precioCompra;
      if (incomingPrecioCompra !== undefined && incomingPrecioCompra !== null) {
        producto.precioCompra = incomingPrecioCompra;
      }

      await producto.save();

      if (isControlaStock(producto)) {
        await Kardex.create({
          productoId: producto._id,
          tipo: delta > 0 ? 'entrada' : 'ajuste',
          cantidad: Math.abs(delta),
          stockAnterior,
          stockNuevo: producto.stock,
          motivo,
          usuarioId: req.user._id,
        });
      }
    }

    // Reconstruir items de compra y total
    const productosCompra = [];
    let total = 0;

    for (const item of productos) {
      const producto = await Producto.findById(item.productoId);
      if (!producto) {
        return res.status(404).json({ mensaje: `Producto ${item.productoId} no encontrado` });
      }

      const qty = Number(item.cantidad || 0);
      if (qty <= 0) {
        return res.status(400).json({ mensaje: `Cantidad inválida para "${producto.nombre}"` });
      }

      const unit = item.precioCompra !== undefined && item.precioCompra !== null ? Number(item.precioCompra) : Number(producto.precioCompra || 0);
      const subtotal = unit * qty;
      total += subtotal;
      productosCompra.push({
        productoId: producto._id,
        nombre: producto.nombre,
        cantidad: qty,
        precioUnitario: unit,
        subtotal,
      });
    }

    compra.productos = productosCompra;
    compra.total = total;
    if (numeroFactura !== undefined) compra.numeroFactura = numeroFactura;
    if (observaciones !== undefined) compra.observaciones = observaciones;
    await compra.save();

    // Ajustar egreso en caja si existe vínculo
    if (compra.cajaId && compra.egresoId) {
      const caja = await Caja.findById(compra.cajaId);
      if (caja) {
        const mov = caja.egresos.id(compra.egresoId);
        if (mov) {
          const proveedor = await Proveedor.findById(compra.proveedorId);
          const concepto = `Compra a ${proveedor?.nombre || 'Proveedor'} - Factura: ${compra.numeroFactura || 'N/A'} (${compra._id})`;
          mov.concepto = concepto;
          mov.monto = Number(total) || 0;
          mov.tipo = 'egreso';
          await caja.save();
        }
      }
    }

    res.json({ mensaje: 'Compra actualizada y stock recalculado', compra });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar compra', error: error.message });
  }
};

// @DELETE /api/proveedores/compras/:id — anular compra y revertir stock (Admin)
const deleteCompra = async (req, res) => {
  try {
    const compra = await Compra.findById(req.params.id);
    if (!compra) return res.status(404).json({ mensaje: 'Compra no encontrada' });

    // Validar que no se deje stock negativo
    for (const item of compra.productos) {
      const producto = await Producto.findById(item.productoId);
      if (!producto) continue;
      if (!isControlaStock(producto)) continue;
      if (producto.stock < item.cantidad) {
        return res.status(400).json({
          mensaje: `No se puede anular: "${producto.nombre}" tiene stock ${producto.stock} y la compra aportó ${item.cantidad}.`,
        });
      }
    }

    const motivo = `Anulación compra ${compra._id} - Factura: ${compra.numeroFactura || 'N/A'}`;
    for (const item of compra.productos) {
      const producto = await Producto.findById(item.productoId);
      if (!producto) continue;
      if (!isControlaStock(producto)) continue;
      const stockAnterior = producto.stock;
      producto.stock -= item.cantidad;
      await producto.save();

      await Kardex.create({
        productoId: producto._id,
        tipo: 'ajuste',
        cantidad: item.cantidad,
        stockAnterior,
        stockNuevo: producto.stock,
        motivo,
        usuarioId: req.user._id,
      });
    }

    await compra.deleteOne();

    // Quitar egreso de caja si existía vínculo
    if (compra.cajaId && compra.egresoId) {
      const caja = await Caja.findById(compra.cajaId);
      if (caja) {
        const mov = caja.egresos.id(compra.egresoId);
        if (mov) {
          mov.deleteOne();
          await caja.save();
        }
      }
    }

    res.json({ mensaje: 'Compra anulada y stock revertido' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al anular compra', error: error.message });
  }
};

module.exports = {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  getComprasProveedor,
  getCompraById,
  registrarCompra,
  updateCompra,
  deleteCompra,
};
