const Devolucion = require('./devolucion.model');
const Venta = require('../ventas/venta.model');
const { Producto, Kardex } = require('../inventario/producto.model');
const Caja = require('../caja/caja.model');
const { crearAsientoDevolucionSiActivo } = require('../contabilidad/contabilidad.service');

const getDiferenciaTipo = (diferenciaMonto) => {
  if (diferenciaMonto > 0) return 'favor_cliente';
  if (diferenciaMonto < 0) return 'favor_tienda';
  return 'sin_diferencia';
};

const getDevoluciones = async (req, res) => {
  try {
    const { estado, tipo, buscar, desde, hasta, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (estado && estado !== 'todas') filter.estado = estado;
    if (tipo && tipo !== 'todas') filter.tipo = tipo;

    if (buscar) {
      filter.$or = [
        { numeroDevolucion: { $regex: buscar, $options: 'i' } },
        { numeroVenta: { $regex: buscar, $options: 'i' } },
        { 'cliente.nombre': { $regex: buscar, $options: 'i' } },
      ];
    }

    if (desde || hasta) {
      filter.createdAt = {};
      if (desde) filter.createdAt.$gte = new Date(`${desde}T00:00:00`);
      if (hasta) filter.createdAt.$lte = new Date(`${hasta}T23:59:59`);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [devoluciones, total] = await Promise.all([
      Devolucion.find(filter)
        .populate('ventaId', 'numeroVenta total estado fecha')
        .populate('clienteId', 'nombre nit')
        .populate('usuarioId', 'nombre')
        .populate('aprobadoPor', 'nombre')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Devolucion.countDocuments(filter),
    ]);

    res.json({
      devoluciones,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    console.error('Error getDevoluciones:', error);
    res.status(500).json({ mensaje: 'Error al obtener devoluciones' });
  }
};

const getDevolucionById = async (req, res) => {
  try {
    const dev = await Devolucion.findById(req.params.id)
      .populate('ventaId')
      .populate('clienteId', 'nombre nit telefono direccion')
      .populate('usuarioId', 'nombre')
      .populate('aprobadoPor', 'nombre');

    if (!dev) return res.status(404).json({ mensaje: 'Devolucion no encontrada' });
    res.json(dev);
  } catch (error) {
    console.error('Error getDevolucionById:', error);
    res.status(500).json({ mensaje: 'Error al obtener devolucion' });
  }
};

const getProductosVenta = async (req, res) => {
  try {
    const term = String(req.params.ventaRef || '').trim();
    if (!term) {
      return res.status(400).json({ mensaje: 'Debe indicar el numero de venta' });
    }

    const ventaFilter = [{ numeroVenta: term }];
    if (/^[0-9a-fA-F]{24}$/.test(term)) {
      ventaFilter.push({ _id: term });
    }

    const venta = await Venta.findOne({ $or: ventaFilter }).populate('clienteId', 'nombre nit');

    if (!venta) return res.status(404).json({ mensaje: 'Venta no encontrada' });
    if (venta.estado === 'anulada') {
      return res.status(400).json({ mensaje: 'No se pueden hacer devoluciones de una venta anulada' });
    }

    const devolucionesPrevias = await Devolucion.find({
      ventaId: venta._id,
      estado: { $in: ['pendiente', 'aprobada', 'completada'] },
    });

    const cantidadesDevueltas = {};
    for (const dev of devolucionesPrevias) {
      for (const item of dev.productos) {
        const key = String(item.productoId);
        cantidadesDevueltas[key] = (cantidadesDevueltas[key] || 0) + item.cantidad;
      }
    }

    const productosDisponibles = venta.productos
      .map((item) => ({
        productoId: item.productoId,
        nombre: item.nombre,
        codigo: item.codigo,
        cantidadOriginal: item.cantidad,
        cantidadDevuelta: cantidadesDevueltas[String(item.productoId)] || 0,
        cantidadDisponible: item.cantidad - (cantidadesDevueltas[String(item.productoId)] || 0),
        precioUnitario: item.precioUnitario,
      }))
      .filter((p) => p.cantidadDisponible > 0);

    res.json({
      venta: {
        _id: venta._id,
        numeroVenta: venta.numeroVenta,
        cliente: venta.cliente,
        clienteId: venta.clienteId,
        total: venta.total,
        fecha: venta.fecha,
        estado: venta.estado,
      },
      productosDisponibles,
    });
  } catch (error) {
    console.error('Error getProductosVenta:', error);
    res.status(500).json({ mensaje: 'Error al obtener productos de la venta' });
  }
};

const createDevolucion = async (req, res) => {
  try {
    const {
      ventaId,
      productos,
      productosCambio = [],
      tipo = 'devolucion',
      motivoGeneral,
      reingresarStock = true,
      observaciones,
      garantia,
    } = req.body;

    if (!ventaId) return res.status(400).json({ mensaje: 'Debe indicar la venta de origen' });
    if (!productos || productos.length === 0) {
      return res.status(400).json({ mensaje: 'Debe seleccionar al menos un producto a devolver' });
    }

    const venta = await Venta.findById(ventaId);
    if (!venta) return res.status(404).json({ mensaje: 'Venta no encontrada' });
    if (venta.estado === 'anulada') {
      return res.status(400).json({ mensaje: 'No se pueden hacer devoluciones de ventas anuladas' });
    }

    const devolucionesPrevias = await Devolucion.find({
      ventaId: venta._id,
      estado: { $in: ['pendiente', 'aprobada', 'completada'] },
    });

    const cantidadesDevueltas = {};
    for (const dev of devolucionesPrevias) {
      for (const item of dev.productos) {
        const key = String(item.productoId);
        cantidadesDevueltas[key] = (cantidadesDevueltas[key] || 0) + item.cantidad;
      }
    }

    let totalDevolucion = 0;
    const productosFinales = [];

    for (const item of productos) {
      const prodVenta = venta.productos.find((p) => String(p.productoId) === String(item.productoId));
      if (!prodVenta) {
        return res.status(400).json({ mensaje: `Producto ${item.productoId} no pertenece a esta venta` });
      }

      const yaDevuelto = cantidadesDevueltas[String(item.productoId)] || 0;
      const disponible = prodVenta.cantidad - yaDevuelto;
      const qty = Number(item.cantidad || 0);

      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ mensaje: `Cantidad invalida para "${prodVenta.nombre}"` });
      }

      if (qty > disponible) {
        return res.status(400).json({
          mensaje: `Cantidad excedida para "${prodVenta.nombre}". Disponible: ${disponible}`,
        });
      }

      const subtotal = Number(prodVenta.precioUnitario || 0) * qty;
      totalDevolucion += subtotal;

      productosFinales.push({
        productoId: item.productoId,
        nombre: prodVenta.nombre,
        codigo: prodVenta.codigo || '',
        cantidad: qty,
        cantidadOriginal: prodVenta.cantidad,
        precioUnitario: prodVenta.precioUnitario,
        subtotal,
        motivo: item.motivo || 'otro',
        motivoDetalle: item.motivoDetalle || '',
        estadoProducto: item.estadoProducto === 'danado' ? 'danado' : 'bueno',
      });
    }

    let totalCambio = 0;
    const productosCambioFinales = [];

    for (const item of productosCambio) {
      const qty = Number(item.cantidad || 0);
      if (!item.productoId) {
        return res.status(400).json({ mensaje: 'Cada producto de cambio debe indicar el producto' });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ mensaje: 'La cantidad del producto de cambio debe ser mayor a cero' });
      }

      const productoCambio = await Producto.findById(item.productoId);
      if (!productoCambio || productoCambio.estado === false) {
        return res.status(404).json({ mensaje: 'Uno de los productos de cambio ya no existe o esta inactivo' });
      }

      if (productoCambio.controlaStock && Number(productoCambio.stock || 0) < qty) {
        return res.status(400).json({
          mensaje: `Stock insuficiente para entregar "${productoCambio.nombre}". Disponible: ${productoCambio.stock || 0}`,
        });
      }

      const precioUnitario = Number(item.precioUnitario || productoCambio.precioVenta || 0);
      const subtotal = precioUnitario * qty;
      totalCambio += subtotal;

      productosCambioFinales.push({
        productoId: productoCambio._id,
        nombre: productoCambio.nombre,
        codigo: productoCambio.codigo || '',
        cantidad: qty,
        precioUnitario,
        subtotal,
      });
    }

    const diferenciaMonto = Number((totalDevolucion - totalCambio).toFixed(2));
    const diferenciaTipo = getDiferenciaTipo(diferenciaMonto);

    const devolucion = new Devolucion({
      ventaId: venta._id,
      numeroVenta: venta.numeroVenta,
      clienteId: venta.clienteId || null,
      cliente: venta.cliente,
      productos: productosFinales,
      productosCambio: productosCambioFinales,
      totalDevolucion,
      totalCambio,
      diferenciaMonto,
      diferenciaTipo,
      tipo,
      estado: 'pendiente',
      motivoGeneral: motivoGeneral || '',
      reingresarStock,
      observaciones: observaciones || '',
      garantia: tipo === 'garantia' ? garantia : undefined,
      usuarioId: req.user._id,
    });

    await devolucion.save();

    const populated = await Devolucion.findById(devolucion._id)
      .populate('ventaId', 'numeroVenta total')
      .populate('usuarioId', 'nombre');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error createDevolucion:', error);
    res.status(500).json({ mensaje: 'Error al crear devolucion' });
  }
};

const aprobarDevolucion = async (req, res) => {
  try {
    const dev = await Devolucion.findById(req.params.id);
    if (!dev) return res.status(404).json({ mensaje: 'Devolucion no encontrada' });

    if (dev.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: 'Solo se pueden aprobar devoluciones pendientes' });
    }

    let cajaActiva = null;
    const requiereIngresoEnCaja = dev.diferenciaTipo === 'favor_tienda' && Number(dev.diferenciaMonto || 0) < 0;
    if (requiereIngresoEnCaja) {
      cajaActiva = await Caja.findOne({ estado: 'abierta' });
      if (!cajaActiva) {
        return res.status(400).json({
          mensaje: 'Debe haber una caja abierta para cobrar la diferencia de esta devolucion',
        });
      }
    }

    if (Array.isArray(dev.productosCambio) && dev.productosCambio.length > 0) {
      for (const item of dev.productosCambio) {
        const prod = await Producto.findById(item.productoId);
        if (!prod) {
          return res.status(400).json({ mensaje: `El producto de cambio "${item.nombre}" ya no existe` });
        }

        if (prod.controlaStock) {
          const stockActual = Number(prod.stock || 0);
          if (stockActual < item.cantidad) {
            return res.status(400).json({
              mensaje: `Stock insuficiente para entregar "${prod.nombre}". Disponible: ${stockActual}`,
            });
          }
        }
      }
    }

    dev.estado = 'aprobada';
    dev.aprobadoPor = req.user._id;
    dev.fechaAprobacion = new Date();

    if (dev.reingresarStock && !dev.stockReingresado) {
      for (const item of dev.productos) {
        const prod = await Producto.findById(item.productoId);
        if (prod && prod.controlaStock) {
          const esDanado = item.estadoProducto === 'danado';
          const stockAnterior = esDanado ? Number(prod.stockDanado || 0) : Number(prod.stock || 0);

          if (esDanado) {
            prod.stockDanado = stockAnterior + item.cantidad;
          } else {
            prod.stock += item.cantidad;
          }

          await prod.save();

          await Kardex.create({
            productoId: prod._id,
            tipo: 'entrada',
            cantidad: item.cantidad,
            stockAnterior,
            stockNuevo: esDanado ? prod.stockDanado : prod.stock,
            motivo: `Devolucion ${dev.numeroDevolucion} - ${item.motivo}${esDanado ? ' (stock danado)' : ''}`,
            usuarioId: req.user._id,
          });
        }
      }

      dev.stockReingresado = true;
      dev.stockDanadoRegistrado = dev.productos.some((item) => item.estadoProducto === 'danado');
    }

    if (Array.isArray(dev.productosCambio) && dev.productosCambio.length > 0) {
      for (const item of dev.productosCambio) {
        const prod = await Producto.findById(item.productoId);
        if (prod && prod.controlaStock) {
          const stockActual = Number(prod.stock || 0);
          prod.stock = stockActual - item.cantidad;
          await prod.save();

          await Kardex.create({
            productoId: prod._id,
            tipo: 'salida',
            cantidad: item.cantidad,
            stockAnterior: stockActual,
            stockNuevo: prod.stock,
            motivo: `Cambio entregado por devolucion ${dev.numeroDevolucion}`,
            usuarioId: req.user._id,
          });
        }
      }
    }

    if (dev.diferenciaTipo === 'favor_cliente' && Number(dev.diferenciaMonto || 0) > 0) {
      const countNC = await Devolucion.countDocuments({ 'notaCredito.generada': true });
      dev.notaCredito = {
        numero: `NC-${String(countNC + 1).padStart(6, '0')}`,
        monto: dev.diferenciaMonto,
        generada: true,
      };
    } else {
      dev.notaCredito = {
        numero: '',
        monto: 0,
        generada: false,
      };
    }

    if (requiereIngresoEnCaja && cajaActiva) {
      const montoCobrado = Math.abs(Number(dev.diferenciaMonto || 0));
      const conceptoIngreso = `Diferencia cobrada por devolucion ${dev.numeroDevolucion} de venta ${dev.numeroVenta}`;

      cajaActiva.ingresos.push({
        concepto: conceptoIngreso,
        monto: montoCobrado,
        tipo: 'devolucion_diferencia',
      });
      await cajaActiva.save();

      dev.ingresoCaja = {
        registrado: true,
        cajaId: cajaActiva._id,
        monto: montoCobrado,
        concepto: conceptoIngreso,
      };
    } else {
      dev.ingresoCaja = {
        registrado: false,
        cajaId: null,
        monto: 0,
        concepto: '',
      };
    }

    dev.estado = 'completada';
    await dev.save();

    try {
      await crearAsientoDevolucionSiActivo({ devolucion: dev, usuarioId: req.user._id });
    } catch (contabilidadError) {
      console.warn(`[contabilidad] No se pudo generar asiento por devolución ${dev.numeroDevolucion}:`, contabilidadError.message);
    }

    const populated = await Devolucion.findById(dev._id)
      .populate('ventaId', 'numeroVenta total')
      .populate('usuarioId', 'nombre')
      .populate('aprobadoPor', 'nombre');

    res.json({
      mensaje: 'Devolucion aprobada y completada exitosamente',
      resumen: {
        totalDevolucion: dev.totalDevolucion,
        totalCambio: dev.totalCambio || 0,
        diferenciaMonto: dev.diferenciaMonto || 0,
        diferenciaTipo: dev.diferenciaTipo || 'sin_diferencia',
      },
      devolucion: populated,
    });
  } catch (error) {
    console.error('Error aprobarDevolucion:', error);
    res.status(500).json({ mensaje: 'Error al aprobar devolucion' });
  }
};

const rechazarDevolucion = async (req, res) => {
  try {
    const dev = await Devolucion.findById(req.params.id);
    if (!dev) return res.status(404).json({ mensaje: 'Devolucion no encontrada' });

    if (dev.estado !== 'pendiente') {
      return res.status(400).json({ mensaje: 'Solo se pueden rechazar devoluciones pendientes' });
    }

    const { motivo } = req.body;

    dev.estado = 'rechazada';
    dev.aprobadoPor = req.user._id;
    dev.fechaAprobacion = new Date();
    if (motivo) dev.observaciones = `${dev.observaciones}\nRechazo: ${motivo}`.trim();

    await dev.save();

    res.json({ mensaje: 'Devolucion rechazada', devolucion: dev });
  } catch (error) {
    console.error('Error rechazarDevolucion:', error);
    res.status(500).json({ mensaje: 'Error al rechazar devolucion' });
  }
};

const getEstadisticas = async (req, res) => {
  try {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [porEstado, porTipo, resumenMes] = await Promise.all([
      Devolucion.aggregate([
        { $group: { _id: '$estado', count: { $sum: 1 }, total: { $sum: '$totalDevolucion' } } },
      ]),
      Devolucion.aggregate([
        { $group: { _id: '$tipo', count: { $sum: 1 }, total: { $sum: '$totalDevolucion' } } },
      ]),
      Devolucion.aggregate([
        { $match: { createdAt: { $gte: inicioMes } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$totalDevolucion' },
            completadas: { $sum: { $cond: [{ $eq: ['$estado', 'completada'] }, 1, 0] } },
            pendientes: { $sum: { $cond: [{ $eq: ['$estado', 'pendiente'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const topMotivos = await Devolucion.aggregate([
      { $unwind: '$productos' },
      { $group: { _id: '$productos.motivo', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      porEstado,
      porTipo,
      resumenMes: resumenMes[0] || { count: 0, total: 0, completadas: 0, pendientes: 0 },
      topMotivos,
    });
  } catch (error) {
    console.error('Error getEstadisticas:', error);
    res.status(500).json({ mensaje: 'Error al obtener estadisticas' });
  }
};

module.exports = {
  getDevoluciones,
  getDevolucionById,
  getProductosVenta,
  createDevolucion,
  aprobarDevolucion,
  rechazarDevolucion,
  getEstadisticas,
};
