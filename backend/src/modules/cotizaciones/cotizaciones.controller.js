const Cotizacion = require('./cotizacion.model');
const { Producto } = require('../inventario/producto.model');
const Venta = require('../ventas/venta.model');

// ─── Obtener todas las cotizaciones ───
const getCotizaciones = async (req, res) => {
  try {
    const { estado, buscar, clienteId, desde, hasta, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (estado && estado !== 'todas') filter.estado = estado;
    if (clienteId) filter.clienteId = clienteId;

    if (buscar) {
      filter.$or = [
        { numeroCotizacion: { $regex: buscar, $options: 'i' } },
        { 'cliente.nombre': { $regex: buscar, $options: 'i' } },
        { 'cliente.nit': { $regex: buscar, $options: 'i' } },
      ];
    }

    if (desde || hasta) {
      filter.createdAt = {};
      if (desde) filter.createdAt.$gte = new Date(desde + 'T00:00:00');
      if (hasta) filter.createdAt.$lte = new Date(hasta + 'T23:59:59');
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [cotizaciones, total] = await Promise.all([
      Cotizacion.find(filter)
        .populate('clienteId', 'nombre nit telefono direccion')
        .populate('usuarioId', 'nombre')
        .populate('ventaId', 'numeroVenta total')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Cotizacion.countDocuments(filter),
    ]);

    // Marcar vencidas automáticamente
    const ahora = new Date();
    for (const cot of cotizaciones) {
      if (
        ['borrador', 'enviada'].includes(cot.estado) &&
        cot.fechaVencimiento &&
        cot.fechaVencimiento < ahora
      ) {
        cot.estado = 'vencida';
        await cot.save();
      }
    }

    res.json({ cotizaciones, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    console.error('Error getCotizaciones:', error);
    res.status(500).json({ mensaje: 'Error al obtener cotizaciones' });
  }
};

// ─── Obtener una cotización por ID ───
const getCotizacionById = async (req, res) => {
  try {
    const cot = await Cotizacion.findById(req.params.id)
      .populate('clienteId', 'nombre nit telefono direccion email')
      .populate('usuarioId', 'nombre')
      .populate('ventaId', 'numeroVenta total estado');

    if (!cot) return res.status(404).json({ mensaje: 'Cotización no encontrada' });

    // Verificar vencimiento
    if (['borrador', 'enviada'].includes(cot.estado) && cot.fechaVencimiento < new Date()) {
      cot.estado = 'vencida';
      await cot.save();
    }

    res.json(cot);
  } catch (error) {
    console.error('Error getCotizacionById:', error);
    res.status(500).json({ mensaje: 'Error al obtener cotización' });
  }
};

// ─── Crear cotización ───
const createCotizacion = async (req, res) => {
  try {
    const {
      clienteId, cliente, productos, descuento = 0,
      notas, condiciones, vigenciaDias, estado = 'borrador',
    } = req.body;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ mensaje: 'Debe incluir al menos un producto' });
    }

    // Calcular totales
    let subtotal = 0;
    const productosFinales = [];

    for (const item of productos) {
      const prod = await Producto.findById(item.productoId);
      if (!prod) {
        return res.status(400).json({ mensaje: `Producto no encontrado: ${item.productoId}` });
      }

      const precioUnit = item.precioUnitario || prod.precioVenta;
      const cantidad = item.cantidad || 1;
      let descMonto = 0;

      if (item.descuentoTipo === 'monto') {
        descMonto = Number(item.descuentoValor || 0);
      } else if (item.descuentoTipo === 'porcentaje') {
        descMonto = (precioUnit * cantidad * Number(item.descuentoValor || 0)) / 100;
      }

      const itemSubtotal = precioUnit * cantidad - descMonto;
      subtotal += precioUnit * cantidad;

      productosFinales.push({
        productoId: prod._id,
        nombre: prod.nombre,
        codigo: prod.codigo || '',
        cantidad,
        precioUnitario: precioUnit,
        descuentoTipo: item.descuentoTipo || 'ninguno',
        descuentoValor: item.descuentoValor || 0,
        descuentoMonto: descMonto,
        subtotal: itemSubtotal,
      });
    }

    const total = subtotal - Number(descuento);

    const cotizacion = new Cotizacion({
      clienteId: clienteId || null,
      cliente: cliente || { nombre: 'Consumidor Final', nit: 'CF' },
      productos: productosFinales,
      subtotal,
      descuento: Number(descuento),
      total: total > 0 ? total : 0,
      notas: notas || '',
      condiciones: condiciones || undefined,
      vigenciaDias: vigenciaDias || 15,
      estado,
      usuarioId: req.user._id,
    });

    await cotizacion.save();

    const populated = await Cotizacion.findById(cotizacion._id)
      .populate('clienteId', 'nombre nit telefono direccion')
      .populate('usuarioId', 'nombre');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error createCotizacion:', error);
    res.status(500).json({ mensaje: 'Error al crear cotización' });
  }
};

// ─── Actualizar cotización ───
const updateCotizacion = async (req, res) => {
  try {
    const cot = await Cotizacion.findById(req.params.id);
    if (!cot) return res.status(404).json({ mensaje: 'Cotización no encontrada' });

    if (['convertida', 'cancelada'].includes(cot.estado)) {
      return res.status(400).json({ mensaje: 'No se puede editar una cotización convertida o cancelada' });
    }

    const {
      clienteId, cliente, productos, descuento,
      notas, condiciones, vigenciaDias, estado,
    } = req.body;

    if (productos && productos.length > 0) {
      let subtotal = 0;
      const productosFinales = [];

      for (const item of productos) {
        const prod = await Producto.findById(item.productoId);
        if (!prod) continue;

        const precioUnit = item.precioUnitario || prod.precioVenta;
        const cantidad = item.cantidad || 1;
        let descMonto = 0;

        if (item.descuentoTipo === 'monto') {
          descMonto = Number(item.descuentoValor || 0);
        } else if (item.descuentoTipo === 'porcentaje') {
          descMonto = (precioUnit * cantidad * Number(item.descuentoValor || 0)) / 100;
        }

        const itemSubtotal = precioUnit * cantidad - descMonto;
        subtotal += precioUnit * cantidad;

        productosFinales.push({
          productoId: prod._id,
          nombre: prod.nombre,
          codigo: prod.codigo || '',
          cantidad,
          precioUnitario: precioUnit,
          descuentoTipo: item.descuentoTipo || 'ninguno',
          descuentoValor: item.descuentoValor || 0,
          descuentoMonto: descMonto,
          subtotal: itemSubtotal,
        });
      }

      cot.productos = productosFinales;
      cot.subtotal = subtotal;
      cot.descuento = descuento !== undefined ? Number(descuento) : cot.descuento;
      cot.total = subtotal - cot.descuento;
    }

    if (clienteId !== undefined) cot.clienteId = clienteId;
    if (cliente) cot.cliente = cliente;
    if (notas !== undefined) cot.notas = notas;
    if (condiciones !== undefined) cot.condiciones = condiciones;
    if (vigenciaDias !== undefined) {
      cot.vigenciaDias = vigenciaDias;
      const fecha = new Date(cot.createdAt);
      fecha.setDate(fecha.getDate() + vigenciaDias);
      cot.fechaVencimiento = fecha;
    }
    if (estado) cot.estado = estado;

    await cot.save();

    const populated = await Cotizacion.findById(cot._id)
      .populate('clienteId', 'nombre nit telefono direccion')
      .populate('usuarioId', 'nombre');

    res.json(populated);
  } catch (error) {
    console.error('Error updateCotizacion:', error);
    res.status(500).json({ mensaje: 'Error al actualizar cotización' });
  }
};

// ─── Cambiar estado de cotización ───
const cambiarEstado = async (req, res) => {
  try {
    const { estado } = req.body;
    const cot = await Cotizacion.findById(req.params.id);
    if (!cot) return res.status(404).json({ mensaje: 'Cotización no encontrada' });

    const transicionesValidas = {
      borrador: ['enviada', 'cancelada'],
      enviada: ['aprobada', 'cancelada', 'vencida'],
      aprobada: ['convertida', 'cancelada'],
      vencida: ['enviada'], // Puede reactivarse
    };

    const permitidas = transicionesValidas[cot.estado] || [];
    if (!permitidas.includes(estado)) {
      return res.status(400).json({
        mensaje: `No se puede cambiar de "${cot.estado}" a "${estado}"`,
      });
    }

    cot.estado = estado;

    // Si se reactiva, recalcular vencimiento
    if (estado === 'enviada' && cot.fechaVencimiento < new Date()) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + (cot.vigenciaDias || 15));
      cot.fechaVencimiento = fecha;
    }

    await cot.save();
    res.json(cot);
  } catch (error) {
    console.error('Error cambiarEstado:', error);
    res.status(500).json({ mensaje: 'Error al cambiar estado' });
  }
};

// ─── Convertir cotización en venta ───
const convertirAVenta = async (req, res) => {
  try {
    const cot = await Cotizacion.findById(req.params.id);
    if (!cot) return res.status(404).json({ mensaje: 'Cotización no encontrada' });

    if (cot.estado === 'convertida') {
      return res.status(400).json({ mensaje: 'Esta cotización ya fue convertida en venta' });
    }
    if (!['aprobada', 'enviada', 'borrador'].includes(cot.estado)) {
      return res.status(400).json({ mensaje: 'Solo se pueden convertir cotizaciones aprobadas, enviadas o en borrador' });
    }

    const { metodoPago = 'efectivo', montoRecibido, cajaId } = req.body;

    // Verificar stock disponible
    for (const item of cot.productos) {
      const prod = await Producto.findById(item.productoId);
      if (!prod) {
        return res.status(400).json({ mensaje: `Producto "${item.nombre}" ya no existe en inventario` });
      }
      if (prod.controlaStock && prod.stock < item.cantidad) {
        return res.status(400).json({
          mensaje: `Stock insuficiente para "${item.nombre}". Disponible: ${prod.stock}, Requerido: ${item.cantidad}`,
        });
      }
    }

    // Crear la venta
    const productosVenta = cot.productos.map((item) => ({
      productoId: item.productoId,
      nombre: item.nombre,
      codigo: item.codigo,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotalBruto: item.precioUnitario * item.cantidad,
      descuentoTipo: item.descuentoTipo,
      descuentoValor: item.descuentoValor,
      descuentoMonto: item.descuentoMonto,
      subtotal: item.subtotal,
    }));

    const venta = new Venta({
      cliente: cot.cliente,
      clienteId: cot.clienteId,
      productos: productosVenta,
      subtotal: cot.subtotal,
      descuento: cot.descuento,
      total: cot.total,
      metodoPago,
      montoRecibido: montoRecibido || cot.total,
      vuelto: metodoPago === 'efectivo' ? Math.max((montoRecibido || cot.total) - cot.total, 0) : 0,
      estado: 'completada',
      usuarioId: req.user._id,
      cajaId: cajaId || null,
    });

    await venta.save();

    // Descontar stock
    const { Kardex } = require('../inventario/producto.model');
    for (const item of cot.productos) {
      const prod = await Producto.findById(item.productoId);
      if (prod && prod.controlaStock) {
        const stockAnterior = prod.stock;
        prod.stock -= item.cantidad;
        await prod.save();

        await Kardex.create({
          productoId: prod._id,
          tipo: 'salida',
          cantidad: item.cantidad,
          stockAnterior,
          stockNuevo: prod.stock,
          motivo: `Venta desde cotización ${cot.numeroCotizacion}`,
          usuarioId: req.user._id,
        });
      }
    }

    // Actualizar cotización
    cot.estado = 'convertida';
    cot.ventaId = venta._id;
    await cot.save();

    const ventaPopulated = await Venta.findById(venta._id)
      .populate('usuarioId', 'nombre')
      .populate('clienteId', 'nombre nit');

    res.json({
      mensaje: 'Cotización convertida en venta exitosamente',
      venta: ventaPopulated,
      cotizacion: cot,
    });
  } catch (error) {
    console.error('Error convertirAVenta:', error);
    res.status(500).json({ mensaje: 'Error al convertir cotización en venta' });
  }
};

// ─── Eliminar cotización ───
const deleteCotizacion = async (req, res) => {
  try {
    const cot = await Cotizacion.findById(req.params.id);
    if (!cot) return res.status(404).json({ mensaje: 'Cotización no encontrada' });

    if (cot.estado === 'convertida') {
      return res.status(400).json({ mensaje: 'No se puede eliminar una cotización ya convertida en venta' });
    }

    await Cotizacion.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Cotización eliminada correctamente' });
  } catch (error) {
    console.error('Error deleteCotizacion:', error);
    res.status(500).json({ mensaje: 'Error al eliminar cotización' });
  }
};

// ─── Duplicar cotización ───
const duplicarCotizacion = async (req, res) => {
  try {
    const original = await Cotizacion.findById(req.params.id);
    if (!original) return res.status(404).json({ mensaje: 'Cotización no encontrada' });

    const nueva = new Cotizacion({
      clienteId: original.clienteId,
      cliente: original.cliente,
      productos: original.productos,
      subtotal: original.subtotal,
      descuento: original.descuento,
      total: original.total,
      notas: original.notas,
      condiciones: original.condiciones,
      vigenciaDias: original.vigenciaDias,
      estado: 'borrador',
      usuarioId: req.user._id,
    });

    await nueva.save();

    const populated = await Cotizacion.findById(nueva._id)
      .populate('clienteId', 'nombre nit telefono direccion')
      .populate('usuarioId', 'nombre');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Error duplicarCotizacion:', error);
    res.status(500).json({ mensaje: 'Error al duplicar cotización' });
  }
};

// ─── Estadísticas de cotizaciones ───
const getEstadisticas = async (req, res) => {
  try {
    const [porEstado, totalMes] = await Promise.all([
      Cotizacion.aggregate([
        { $group: { _id: '$estado', count: { $sum: 1 }, total: { $sum: '$total' } } },
      ]),
      Cotizacion.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            total: { $sum: '$total' },
            convertidas: {
              $sum: { $cond: [{ $eq: ['$estado', 'convertida'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    res.json({ porEstado, resumenMes: totalMes[0] || { count: 0, total: 0, convertidas: 0 } });
  } catch (error) {
    console.error('Error getEstadisticas:', error);
    res.status(500).json({ mensaje: 'Error al obtener estadísticas' });
  }
};

module.exports = {
  getCotizaciones,
  getCotizacionById,
  createCotizacion,
  updateCotizacion,
  cambiarEstado,
  convertirAVenta,
  deleteCotizacion,
  duplicarCotizacion,
  getEstadisticas,
};
