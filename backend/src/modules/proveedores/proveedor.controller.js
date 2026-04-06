const { Proveedor, Compra } = require('./proveedor.model');
const { Producto, Kardex } = require('../inventario/producto.model');

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

// @POST /api/proveedores/compras  — registrar compra e incrementar stock
const registrarCompra = async (req, res) => {
  try {
    const { proveedorId, productos, total, numeroFactura, observaciones } = req.body;

    const proveedor = await Proveedor.findById(proveedorId);
    if (!proveedor) return res.status(404).json({ mensaje: 'Proveedor no encontrado' });

    const productosCompra = [];

    for (const item of productos) {
      const producto = await Producto.findById(item.productoId);
      if (!producto) {
        return res.status(404).json({ mensaje: `Producto ${item.productoId} no encontrado` });
      }

      const stockAnterior = producto.stock;
      producto.stock += item.cantidad;
      if (item.precioCompra) producto.precioCompra = item.precioCompra;
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
    });

    res.status(201).json({ mensaje: 'Compra registrada correctamente', compra });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar compra', error: error.message });
  }
};

module.exports = {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  getComprasProveedor,
  registrarCompra,
};
