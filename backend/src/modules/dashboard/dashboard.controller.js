const Venta = require('../ventas/venta.model');
const { Producto } = require('../inventario/producto.model');
const Caja = require('../caja/caja.model');

// @GET /api/dashboard/resumen
const getResumen = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);

    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    // Ventas del día
    const ventasHoy = await Venta.aggregate([
      {
        $match: {
          fecha: { $gte: hoy, $lt: manana },
          estado: 'completada',
        },
      },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: '$total' },
          cantidad: { $sum: 1 },
        },
      },
    ]);

    // Ventas del mes
    const ventasMes = await Venta.aggregate([
      {
        $match: {
          fecha: { $gte: inicioMes },
          estado: 'completada',
        },
      },
      {
        $group: {
          _id: null,
          totalVentas: { $sum: '$total' },
          cantidad: { $sum: 1 },
        },
      },
    ]);

    // Productos con stock bajo
    const stockBajo = await Producto.countDocuments({
      estado: true,
      $expr: { $lte: ['$stock', '$stockMinimo'] },
    });

    // Total productos activos
    const totalProductos = await Producto.countDocuments({ estado: true });

    // Caja activa
    const cajaActiva = await Caja.findOne({ estado: 'abierta' }).populate('usuarioApertura', 'nombre');

    res.json({
      ventasHoy: ventasHoy[0] || { totalVentas: 0, cantidad: 0 },
      ventasMes: ventasMes[0] || { totalVentas: 0, cantidad: 0 },
      stockBajo,
      totalProductos,
      cajaActiva,
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener resumen', error: error.message });
  }
};

// @GET /api/dashboard/ventas
const getVentasDashboard = async (req, res) => {
  try {
    const { periodo = '7dias' } = req.query;

    let diasAtras = 7;
    if (periodo === '30dias') diasAtras = 30;
    if (periodo === 'mes') diasAtras = 30;

    const desde = new Date();
    desde.setDate(desde.getDate() - diasAtras);
    desde.setHours(0, 0, 0, 0);

    // Ventas por día
    const ventasPorDia = await Venta.aggregate([
      {
        $match: {
          fecha: { $gte: desde },
          estado: 'completada',
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$fecha' },
          },
          total: { $sum: '$total' },
          cantidad: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Productos más vendidos
    const topProductos = await Venta.aggregate([
      { $match: { estado: 'completada', fecha: { $gte: desde } } },
      { $unwind: '$productos' },
      {
        $group: {
          _id: '$productos.productoId',
          nombre: { $first: '$productos.nombre' },
          totalVendido: { $sum: '$productos.cantidad' },
          ingresos: { $sum: '$productos.subtotal' },
        },
      },
      { $sort: { totalVendido: -1 } },
      { $limit: 5 },
    ]);

    // Ventas por método de pago
    const ventasPorMetodo = await Venta.aggregate([
      { $match: { estado: 'completada', fecha: { $gte: desde } } },
      {
        $group: {
          _id: '$metodoPago',
          total: { $sum: '$total' },
          cantidad: { $sum: 1 },
        },
      },
    ]);

    res.json({ ventasPorDia, topProductos, ventasPorMetodo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener estadísticas de ventas', error: error.message });
  }
};

// @GET /api/dashboard/inventario
const getInventarioDashboard = async (req, res) => {
  try {
    // Por categoría
    const porCategoria = await Producto.aggregate([
      { $match: { estado: true } },
      {
        $group: {
          _id: '$categoria',
          cantidad: { $sum: 1 },
          valorTotal: { $sum: { $multiply: ['$stock', '$precioVenta'] } },
        },
      },
      { $sort: { cantidad: -1 } },
    ]);

    // Productos con stock bajo
    const stockBajo = await Producto.find({
      estado: true,
      $expr: { $lte: ['$stock', '$stockMinimo'] },
    })
      .select('nombre stock stockMinimo categoria')
      .sort({ stock: 1 })
      .limit(10);

    // Valor total del inventario
    const valorInventario = await Producto.aggregate([
      { $match: { estado: true } },
      {
        $group: {
          _id: null,
          valorVenta: { $sum: { $multiply: ['$stock', '$precioVenta'] } },
          valorCosto: { $sum: { $multiply: ['$stock', '$precioCompra'] } },
        },
      },
    ]);

    res.json({
      porCategoria,
      stockBajo,
      valorInventario: valorInventario[0] || { valorVenta: 0, valorCosto: 0 },
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener estadísticas de inventario', error: error.message });
  }
};

module.exports = { getResumen, getVentasDashboard, getInventarioDashboard };
