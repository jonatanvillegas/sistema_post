const Venta = require('../ventas/venta.model');
const { Producto, Kardex } = require('../inventario/producto.model');
const Devolucion = require('../devoluciones/devolucion.model');

// ─── Reporte de Utilidades ───
const getReporteUtilidades = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const match = { estado: 'completada' };

    if (desde || hasta) {
      match.fecha = {};
      if (desde) match.fecha.$gte = new Date(desde + 'T00:00:00');
      if (hasta) match.fecha.$lte = new Date(hasta + 'T23:59:59');
    }

    const ventas = await Venta.find(match).populate('productos.productoId', 'precioCompra');

    let totalVentas = 0;
    let totalCosto = 0;
    let totalDescuentos = 0;
    const porCategoria = {};

    for (const venta of ventas) {
      totalVentas += venta.total;
      totalDescuentos += venta.descuento || 0;

      for (const item of venta.productos) {
        const costoUnit = item.productoId?.precioCompra || 0;
        totalCosto += costoUnit * item.cantidad;
      }
    }

    const utilidadBruta = totalVentas - totalCosto;
    const margenPorcentaje = totalVentas > 0 ? ((utilidadBruta / totalVentas) * 100) : 0;

    // Utilidad por día
    const utilidadPorDia = await Venta.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
          ventas: { $sum: '$total' },
          cantidad: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalVentas,
      totalCosto,
      utilidadBruta,
      margenPorcentaje: margenPorcentaje.toFixed(2),
      totalDescuentos,
      cantidadVentas: ventas.length,
      utilidadPorDia,
    });
  } catch (error) {
    console.error('Error getReporteUtilidades:', error);
    res.status(500).json({ mensaje: 'Error al generar reporte de utilidades' });
  }
};

// ─── Reporte de Productos más/menos vendidos ───
const getReporteProductos = async (req, res) => {
  try {
    const { desde, hasta, orden = 'mas' } = req.query;
    const match = { estado: 'completada' };

    if (desde || hasta) {
      match.fecha = {};
      if (desde) match.fecha.$gte = new Date(desde + 'T00:00:00');
      if (hasta) match.fecha.$lte = new Date(hasta + 'T23:59:59');
    }

    const sortOrder = orden === 'menos' ? 1 : -1;

    const productosVendidos = await Venta.aggregate([
      { $match: match },
      { $unwind: '$productos' },
      {
        $group: {
          _id: '$productos.productoId',
          nombre: { $first: '$productos.nombre' },
          codigo: { $first: '$productos.codigo' },
          totalVendido: { $sum: '$productos.cantidad' },
          ingresos: { $sum: '$productos.subtotal' },
          vecesVendido: { $sum: 1 },
        },
      },
      { $sort: { totalVendido: sortOrder } },
      { $limit: 50 },
    ]);

    // Agregar info de stock actual
    for (const item of productosVendidos) {
      const prod = await Producto.findById(item._id).select('stock stockMinimo categoria precioCompra precioVenta');
      if (prod) {
        item.stockActual = prod.stock;
        item.stockMinimo = prod.stockMinimo;
        item.categoria = prod.categoria;
        item.precioCompra = prod.precioCompra;
        item.precioVenta = prod.precioVenta;
      }
    }

    res.json(productosVendidos);
  } catch (error) {
    console.error('Error getReporteProductos:', error);
    res.status(500).json({ mensaje: 'Error al generar reporte de productos' });
  }
};

// ─── Reporte de Compras vs Ventas ───
const getReporteComprasVsVentas = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const matchVentas = { estado: 'completada' };
    const matchKardex = { tipo: 'entrada' };

    if (desde || hasta) {
      const dateFilter = {};
      if (desde) dateFilter.$gte = new Date(desde + 'T00:00:00');
      if (hasta) dateFilter.$lte = new Date(hasta + 'T23:59:59');
      matchVentas.fecha = dateFilter;
      matchKardex.createdAt = dateFilter;
    }

    const [ventasPorDia, comprasPorDia] = await Promise.all([
      Venta.aggregate([
        { $match: matchVentas },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
            totalVentas: { $sum: '$total' },
            cantidadVentas: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Kardex.aggregate([
        { $match: matchKardex },
        {
          $lookup: {
            from: 'productos',
            localField: 'productoId',
            foreignField: '_id',
            as: 'producto',
          },
        },
        { $unwind: { path: '$producto', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            totalCompras: {
              $sum: { $multiply: ['$cantidad', { $ifNull: ['$producto.precioCompra', 0] }] },
            },
            cantidadEntradas: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Combinar datos
    const fechas = new Set([...ventasPorDia.map((v) => v._id), ...comprasPorDia.map((c) => c._id)]);
    const combinado = Array.from(fechas)
      .sort()
      .map((fecha) => {
        const v = ventasPorDia.find((x) => x._id === fecha) || {};
        const c = comprasPorDia.find((x) => x._id === fecha) || {};
        return {
          fecha,
          ventas: v.totalVentas || 0,
          compras: c.totalCompras || 0,
          diferencia: (v.totalVentas || 0) - (c.totalCompras || 0),
        };
      });

    res.json(combinado);
  } catch (error) {
    console.error('Error getReporteComprasVsVentas:', error);
    res.status(500).json({ mensaje: 'Error al generar reporte' });
  }
};

// ─── Reporte de Inventario Valorizado ───
const getReporteInventarioValorizado = async (req, res) => {
  try {
    const { categoria } = req.query;
    const filter = { estado: true };
    if (categoria) filter.categoria = categoria;

    const productos = await Producto.find(filter)
      .select('nombre codigo categoria stock precioCompra precioVenta stockMinimo controlaStock')
      .sort({ categoria: 1, nombre: 1 });

    let totalCosto = 0;
    let totalVenta = 0;
    let totalUnidades = 0;
    const porCategoria = {};

    const detalle = productos.map((p) => {
      const valorCosto = p.stock * p.precioCompra;
      const valorVenta = p.stock * p.precioVenta;
      const utilidad = valorVenta - valorCosto;

      totalCosto += valorCosto;
      totalVenta += valorVenta;
      totalUnidades += p.stock;

      if (!porCategoria[p.categoria]) {
        porCategoria[p.categoria] = { cantidad: 0, valorCosto: 0, valorVenta: 0, unidades: 0 };
      }
      porCategoria[p.categoria].cantidad += 1;
      porCategoria[p.categoria].valorCosto += valorCosto;
      porCategoria[p.categoria].valorVenta += valorVenta;
      porCategoria[p.categoria].unidades += p.stock;

      return {
        _id: p._id,
        nombre: p.nombre,
        codigo: p.codigo,
        categoria: p.categoria,
        stock: p.stock,
        precioCompra: p.precioCompra,
        precioVenta: p.precioVenta,
        valorCosto,
        valorVenta,
        utilidad,
        margen: valorVenta > 0 ? ((utilidad / valorVenta) * 100).toFixed(1) : 0,
        stockBajo: p.controlaStock && p.stock <= p.stockMinimo,
      };
    });

    const categoriasResumen = Object.entries(porCategoria).map(([nombre, data]) => ({
      nombre,
      ...data,
      utilidad: data.valorVenta - data.valorCosto,
    }));

    res.json({
      resumen: {
        totalProductos: productos.length,
        totalUnidades,
        totalCosto,
        totalVenta,
        utilidadEstimada: totalVenta - totalCosto,
        margenPromedio: totalVenta > 0 ? (((totalVenta - totalCosto) / totalVenta) * 100).toFixed(1) : 0,
      },
      categorias: categoriasResumen,
      detalle,
    });
  } catch (error) {
    console.error('Error getReporteInventarioValorizado:', error);
    res.status(500).json({ mensaje: 'Error al generar reporte de inventario' });
  }
};

// ─── Reporte de Movimientos de Stock ───
const getReporteMovimientosStock = async (req, res) => {
  try {
    const { desde, hasta, tipo, productoId } = req.query;
    const match = {};

    if (tipo) match.tipo = tipo;
    if (productoId) match.productoId = require('mongoose').Types.ObjectId(productoId);

    if (desde || hasta) {
      match.createdAt = {};
      if (desde) match.createdAt.$gte = new Date(desde + 'T00:00:00');
      if (hasta) match.createdAt.$lte = new Date(hasta + 'T23:59:59');
    }

    const movimientos = await Kardex.find(match)
      .populate('productoId', 'nombre codigo categoria')
      .populate('usuarioId', 'nombre')
      .sort({ createdAt: -1 })
      .limit(500);

    // Resumen
    const resumen = await Kardex.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$tipo',
          cantidad: { $sum: '$cantidad' },
          movimientos: { $sum: 1 },
        },
      },
    ]);

    res.json({ movimientos, resumen });
  } catch (error) {
    console.error('Error getReporteMovimientosStock:', error);
    res.status(500).json({ mensaje: 'Error al generar reporte de movimientos' });
  }
};

// ─── Reporte de Clientes Frecuentes ───
const getReporteClientesFrecuentes = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const match = { estado: 'completada', clienteId: { $ne: null } };

    if (desde || hasta) {
      match.fecha = {};
      if (desde) match.fecha.$gte = new Date(desde + 'T00:00:00');
      if (hasta) match.fecha.$lte = new Date(hasta + 'T23:59:59');
    }

    const clientes = await Venta.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$clienteId',
          nombre: { $first: '$cliente.nombre' },
          nit: { $first: '$cliente.nit' },
          cantidadCompras: { $sum: 1 },
          totalCompras: { $sum: '$total' },
          ultimaCompra: { $max: '$fecha' },
          ticketPromedio: { $avg: '$total' },
        },
      },
      { $sort: { totalCompras: -1 } },
      { $limit: 50 },
    ]);

    res.json(clientes);
  } catch (error) {
    console.error('Error getReporteClientesFrecuentes:', error);
    res.status(500).json({ mensaje: 'Error al generar reporte de clientes' });
  }
};

// ─── Reporte de Devoluciones ───
const getReporteDevoluciones = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const match = {};

    if (desde || hasta) {
      match.createdAt = {};
      if (desde) match.createdAt.$gte = new Date(desde + 'T00:00:00');
      if (hasta) match.createdAt.$lte = new Date(hasta + 'T23:59:59');
    }

    const [resumen, porMotivo, porDia] = await Promise.all([
      Devolucion.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$estado',
            count: { $sum: 1 },
            total: { $sum: '$totalDevolucion' },
          },
        },
      ]),
      Devolucion.aggregate([
        { $match: match },
        { $unwind: '$productos' },
        {
          $group: {
            _id: '$productos.motivo',
            count: { $sum: 1 },
            total: { $sum: '$productos.subtotal' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Devolucion.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            total: { $sum: '$totalDevolucion' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ resumen, porMotivo, porDia });
  } catch (error) {
    console.error('Error getReporteDevoluciones:', error);
    res.status(500).json({ mensaje: 'Error al generar reporte de devoluciones' });
  }
};

module.exports = {
  getReporteUtilidades,
  getReporteProductos,
  getReporteComprasVsVentas,
  getReporteInventarioValorizado,
  getReporteMovimientosStock,
  getReporteClientesFrecuentes,
  getReporteDevoluciones,
};
