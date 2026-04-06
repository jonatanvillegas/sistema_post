const { Producto, Kardex } = require('./producto.model');

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
    if (stockBajo === 'true') filtro.$expr = { $lte: ['$stock', '$stockMinimo'] };

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
    const producto = await Producto.create(req.body);

    // Registrar en kardex como entrada inicial
    if (producto.stock > 0) {
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

    Object.assign(producto, req.body);
    await producto.save();

    // Si cambió el stock, registrar en kardex
    if (req.body.stock !== undefined && req.body.stock !== stockAnterior) {
      const diferencia = producto.stock - stockAnterior;
      await Kardex.create({
        productoId: producto._id,
        tipo: diferencia > 0 ? 'entrada' : 'ajuste',
        cantidad: Math.abs(diferencia),
        stockAnterior,
        stockNuevo: producto.stock,
        motivo: req.body.motivoAjuste || 'Ajuste manual',
        usuarioId: req.user._id,
      });
    }

    res.json({ mensaje: 'Producto actualizado', producto });
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

module.exports = { getProductos, getStockBajo, getProductoById, createProducto, updateProducto, deleteProducto, getKardex };
