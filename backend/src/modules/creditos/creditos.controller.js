const Credito = require('./credito.model');
const Cliente = require('../clientes/cliente.model');
const Caja = require('../caja/caja.model');
const Venta = require('../ventas/venta.model');
const { Producto, Kardex } = require('../inventario/producto.model');
const mongoose = require('mongoose');

const isControlaStock = (producto) => producto?.controlaStock !== false;

const recalcularSaldoActualCliente = async (clienteId, session) => {
  const pipeline = [
    {
      $match: {
        clienteId,
        estado: { $in: ['pendiente', 'vencido'] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$saldoPendiente' },
      },
    },
  ];

  const query = Credito.aggregate(pipeline);
  if (session) query.session(session);
  const agg = await query;
  return Number(agg?.[0]?.total) || 0;
};

// @GET /api/creditos/cliente/:clienteId
const getCreditosByCliente = async (req, res) => {
  try {
    const { estado } = req.query;
    const query = { clienteId: req.params.clienteId };
    if (estado) query.estado = estado;

    const creditos = await Credito.find(query)
      .populate('ventaId', 'numeroVenta total fecha')
      .sort({ createdAt: -1 });

    res.json(creditos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener créditos', error: error.message });
  }
};

// @POST /api/creditos/:id/abono
const registrarAbono = async (req, res) => {
  try {
    const { monto, metodoPago, comprobante } = req.body;

    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ mensaje: 'Monto inválido' });
    }

    // Nota: Las transacciones requieren Replica Set/Mongos.
    // En instalaciones locales (standalone) fallan con: "Transaction numbers are only allowed..."
    // Para compatibilidad total, aquí se ejecuta sin transacciones.
    const credito = await Credito.findById(req.params.id);

    if (!credito) return res.status(404).json({ mensaje: 'Crédito no encontrado' });
    if (credito.estado === 'pagado') return res.status(400).json({ mensaje: 'El crédito ya está pagado' });
    if (montoNum > credito.saldoPendiente) {
      return res.status(400).json({ mensaje: `El monto excede el saldo pendiente (${credito.saldoPendiente})` });
    }

    // 1. Verificar si hay caja abierta
    const cajaActiva = await Caja.findOne({ estado: 'abierta' });
    if (!cajaActiva) return res.status(400).json({ mensaje: 'Debe abrir caja antes de recibir un abono' });

    // 2. Registrar el abono en el arreglo
    credito.abonos.push({
      monto: montoNum,
      metodoPago,
      comprobante,
      usuarioId: req.user._id,
      cajaId: cajaActiva._id,
    });

    // 3. Guardar el crédito
    await credito.save();

    // 4. Recalcular y sincronizar deuda del cliente (evita desfases)
    const saldoActualRecalculado = await recalcularSaldoActualCliente(credito.clienteId, null);
    await Cliente.findByIdAndUpdate(
      credito.clienteId,
      { $set: { saldoActual: saldoActualRecalculado } }
    );

    // 5. Registrar el movimiento de ingreso en la caja
    cajaActiva.ingresos.push({
      concepto: `Abono a Crédito - Venta: ${req.body.numeroVenta || 'C-' + req.params.id.slice(-5)}`,
      monto: montoNum,
      tipo: 'ingreso_manual',
      fecha: new Date(),
    });

    await cajaActiva.save();

    res.json({ mensaje: 'Abono registrado con éxito', credito });
  } catch (error) {
    try {
      // Importante para depuración en Electron: stderr queda en main.log
      console.error('Error al registrar abono:', error);
    } catch (_) {
      // noop
    }
    res.status(500).json({ mensaje: 'Error al registrar abono', error: error.message });
  }
};

// @GET /api/creditos/pendientes (Solo Admin)
const getCreditosPendientes = async (req, res) => {
  try {
    const creditos = await Credito.find({ estado: { $in: ['pendiente', 'vencido'] } })
      .populate('clienteId', 'nombre nit telefono')
      .populate('ventaId', 'numeroVenta total')
      .sort({ fechaVencimiento: 1 });

    res.json(creditos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener créditos pendientes', error: error.message });
  }
};

// @GET /api/creditos/:id/detalle
const getCreditoDetalle = async (req, res) => {
  try {
    const credito = await Credito.findById(req.params.id)
      .populate('clienteId', 'nombre nit telefono')
      .populate({
        path: 'ventaId',
        populate: { path: 'usuarioId', select: 'nombre rol' },
      });

    if (!credito) return res.status(404).json({ mensaje: 'Crédito no encontrado' });
    res.json(credito);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener detalle del crédito', error: error.message });
  }
};

// @PUT /api/creditos/:id/venta  (solo Admin)
// Body: { productos: [{ productoId, cantidad, precioUnitario? }] }
const updateCreditoVentaProductos = async (req, res) => {
  try {
    const { productos } = req.body;

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ mensaje: 'Debe enviar al menos un producto' });
    }

    const credito = await Credito.findById(req.params.id);
    if (!credito) return res.status(404).json({ mensaje: 'Crédito no encontrado' });

    if (credito.estado === 'anulado') {
      return res.status(400).json({ mensaje: 'No se puede modificar un crédito anulado' });
    }

    const abonosCount = credito?.abonos?.length || 0;
    if (abonosCount > 0) {
      return res.status(400).json({
        mensaje: 'No se puede modificar la venta de un crédito que ya tiene abonos',
      });
    }

    const venta = await Venta.findById(credito.ventaId);
    if (!venta) return res.status(404).json({ mensaje: 'Venta asociada no encontrada' });

    if (venta.estado === 'anulada') {
      return res.status(400).json({ mensaje: 'No se puede modificar una venta anulada' });
    }

    if (venta.metodoPago !== 'credito') {
      return res.status(400).json({ mensaje: 'Esta venta no es al crédito' });
    }

    let caja = null;
    if (venta.cajaId) {
      caja = await Caja.findById(venta.cajaId);
      if (caja && caja.estado === 'cerrada') {
        return res.status(400).json({ mensaje: 'No se puede modificar una venta de una caja cerrada' });
      }
    }

    // Normalizar y validar payload
    const productosInput = productos.map((p) => ({
      productoId: p?.productoId,
      cantidad: Number(p?.cantidad),
      precioUnitario: p?.precioUnitario === undefined || p?.precioUnitario === null ? null : Number(p?.precioUnitario),
    }));

    // Validar que no existan precios distintos para el mismo producto en la misma edición
    const precioByProductoId = new Map();

    for (const item of productosInput) {
      if (!item.productoId) {
        return res.status(400).json({ mensaje: 'Producto inválido en la venta' });
      }
      if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
        return res.status(400).json({ mensaje: 'Cantidad inválida en la venta' });
      }
      if (item.precioUnitario !== null && (!Number.isFinite(item.precioUnitario) || item.precioUnitario <= 0)) {
        return res.status(400).json({ mensaje: 'Precio unitario inválido en la venta' });
      }

      if (item.precioUnitario !== null) {
        const key = String(item.productoId);
        const prev = precioByProductoId.get(key);
        if (prev !== undefined && prev !== item.precioUnitario) {
          return res.status(400).json({
            mensaje: 'No se permite enviar el mismo producto con precios distintos en una sola edición',
          });
        }
        precioByProductoId.set(key, item.precioUnitario);
      }
    }

    // Calcular cantidades por producto (para ajuste de stock por delta)
    const oldQtyById = new Map();
    for (const item of venta.productos || []) {
      const key = String(item.productoId);
      oldQtyById.set(key, (oldQtyById.get(key) || 0) + Number(item.cantidad || 0));
    }

    const newQtyById = new Map();
    for (const item of productosInput) {
      const key = String(item.productoId);
      newQtyById.set(key, (newQtyById.get(key) || 0) + Number(item.cantidad || 0));
    }

    const allIds = Array.from(new Set([...oldQtyById.keys(), ...newQtyById.keys()]));
    const productosDocs = await Producto.find({ _id: { $in: allIds } });
    const productoDocById = new Map(productosDocs.map((p) => [String(p._id), p]));

    for (const id of allIds) {
      if (!productoDocById.has(String(id))) {
        return res.status(404).json({ mensaje: `Producto no encontrado: ${id}` });
      }
    }

    // Verificar stock disponible para deltas positivos
    for (const id of allIds) {
      const oldQty = oldQtyById.get(id) || 0;
      const newQty = newQtyById.get(id) || 0;
      const delta = newQty - oldQty;
      if (delta > 0) {
        const prodDoc = productoDocById.get(id);
        if (isControlaStock(prodDoc) && (Number(prodDoc.stock) || 0) < delta) {
          return res.status(400).json({
            mensaje: `Stock insuficiente para "${prodDoc.nombre}". Requiere +${delta}, disponible: ${prodDoc.stock}`,
          });
        }
      }
    }

    // Aplicar deltas de stock + Kardex
    for (const id of allIds) {
      const oldQty = oldQtyById.get(id) || 0;
      const newQty = newQtyById.get(id) || 0;
      const delta = newQty - oldQty;
      if (delta === 0) continue;

      const prodDoc = productoDocById.get(id);
      if (!isControlaStock(prodDoc)) continue;

      const stockAnterior = Number(prodDoc.stock) || 0;
      if (delta > 0) {
        prodDoc.stock = stockAnterior - delta;
        await prodDoc.save();
        await Kardex.create({
          productoId: prodDoc._id,
          tipo: 'salida',
          cantidad: delta,
          stockAnterior,
          stockNuevo: prodDoc.stock,
          motivo: `Ajuste venta ${venta.numeroVenta}`,
          usuarioId: req.user._id,
        });
      } else {
        const qtyReturn = Math.abs(delta);
        prodDoc.stock = stockAnterior + qtyReturn;
        await prodDoc.save();
        await Kardex.create({
          productoId: prodDoc._id,
          tipo: 'entrada',
          cantidad: qtyReturn,
          stockAnterior,
          stockNuevo: prodDoc.stock,
          motivo: `Ajuste venta ${venta.numeroVenta}`,
          usuarioId: req.user._id,
        });
      }
    }

    // Actualizar precio de venta del inventario (precioVenta) si el admin lo cambió
    for (const [id, nuevoPrecio] of precioByProductoId.entries()) {
      const prodDoc = productoDocById.get(String(id));
      if (!prodDoc) continue;
      if (Number(prodDoc.precioVenta) !== Number(nuevoPrecio)) {
        prodDoc.precioVenta = Number(nuevoPrecio);
        await prodDoc.save();
      }
    }

    // Reconstruir items de venta y recalcular totales
    let subtotal = 0;
    const productosVenta = [];

    for (const item of productosInput) {
      const prodDoc = productoDocById.get(String(item.productoId));
      const precioUnitario = item.precioUnitario !== null ? item.precioUnitario : Number(prodDoc.precioVenta);

      const itemSubtotal = precioUnitario * item.cantidad;
      subtotal += itemSubtotal;

      productosVenta.push({
        productoId: prodDoc._id,
        nombre: prodDoc.nombre,
        codigo: prodDoc.codigo || '',
        cantidad: item.cantidad,
        precioUnitario,
        subtotal: itemSubtotal,
      });
    }

    const descuento = Number(venta.descuento) || 0;
    const total = subtotal - descuento;
    if (total < 0) {
      return res.status(400).json({ mensaje: 'El descuento excede el subtotal; ajuste el descuento antes' });
    }

    venta.productos = productosVenta;
    venta.subtotal = subtotal;
    venta.total = total;
    await venta.save();

    credito.montoTotal = total;
    await credito.save();

    // Sincronizar saldoActual del cliente con agregación (evita desfases)
    const saldoActualRecalculado = await recalcularSaldoActualCliente(credito.clienteId, null);
    await Cliente.findByIdAndUpdate(
      credito.clienteId,
      { $set: { saldoActual: saldoActualRecalculado } }
    );

    // Actualizar el movimiento en caja (si existe)
    if (caja) {
      const movimiento = (caja.ingresos || []).find((m) => String(m.ventaId) === String(venta._id));
      if (movimiento) {
        movimiento.monto = total;
      }
      await caja.save();
    }

    const creditoActualizado = await Credito.findById(credito._id)
      .populate('clienteId', 'nombre nit telefono')
      .populate({
        path: 'ventaId',
        populate: { path: 'usuarioId', select: 'nombre rol' },
      });

    res.json({ mensaje: 'Venta del crédito actualizada', credito: creditoActualizado });
  } catch (error) {
    try {
      console.error('Error al actualizar venta de crédito:', error);
    } catch (_) {
      // noop
    }
    res.status(500).json({ mensaje: 'Error al actualizar venta del crédito', error: error.message });
  }
};

// ─── Resumen de Cuentas por Cobrar (Antigüedad de saldos) ───
const getResumenCuentasCobrar = async (req, res) => {
  try {
    const ahora = new Date();
    const hace30 = new Date(ahora); hace30.setDate(hace30.getDate() - 30);
    const hace60 = new Date(ahora); hace60.setDate(hace60.getDate() - 60);
    const hace90 = new Date(ahora); hace90.setDate(hace90.getDate() - 90);

    // Actualizar vencidos automáticamente
    await Credito.updateMany(
      { estado: 'pendiente', fechaVencimiento: { $lt: ahora } },
      { $set: { estado: 'vencido' } }
    );

    const creditos = await Credito.find({ estado: { $in: ['pendiente', 'vencido'] } })
      .populate('clienteId', 'nombre nit telefono')
      .populate('ventaId', 'numeroVenta total fecha')
      .sort({ fechaVencimiento: 1 });

    let totalPendiente = 0;
    let rango030 = 0;
    let rango3160 = 0;
    let rango6190 = 0;
    let rangoMas90 = 0;
    const clientesMap = {};

    for (const c of creditos) {
      totalPendiente += c.saldoPendiente;
      const diasVencido = Math.max(0, Math.floor((ahora - c.fechaVencimiento) / (1000 * 60 * 60 * 24)));

      if (diasVencido <= 30) rango030 += c.saldoPendiente;
      else if (diasVencido <= 60) rango3160 += c.saldoPendiente;
      else if (diasVencido <= 90) rango6190 += c.saldoPendiente;
      else rangoMas90 += c.saldoPendiente;

      const cid = String(c.clienteId?._id || c.clienteId);
      if (!clientesMap[cid]) {
        clientesMap[cid] = {
          clienteId: c.clienteId,
          nombre: c.clienteId?.nombre || 'Sin nombre',
          nit: c.clienteId?.nit || '',
          telefono: c.clienteId?.telefono || '',
          totalDeuda: 0,
          creditosActivos: 0,
          creditoMasAntiguo: c.fechaVencimiento,
        };
      }
      clientesMap[cid].totalDeuda += c.saldoPendiente;
      clientesMap[cid].creditosActivos += 1;
      if (c.fechaVencimiento < clientesMap[cid].creditoMasAntiguo) {
        clientesMap[cid].creditoMasAntiguo = c.fechaVencimiento;
      }
    }

    const clientesResumen = Object.values(clientesMap).sort((a, b) => b.totalDeuda - a.totalDeuda);

    res.json({
      totalPendiente,
      totalCreditos: creditos.length,
      antiguedad: {
        rango030,
        rango3160,
        rango6190,
        rangoMas90,
      },
      clientes: clientesResumen,
      creditos,
    });
  } catch (error) {
    console.error('Error getResumenCuentasCobrar:', error);
    res.status(500).json({ mensaje: 'Error al obtener resumen de cuentas por cobrar' });
  }
};

// ─── Estado de cuenta por cliente ───
const getEstadoCuentaCliente = async (req, res) => {
  try {
    const { clienteId } = req.params;
    const cliente = await Cliente.findById(clienteId);
    if (!cliente) return res.status(404).json({ mensaje: 'Cliente no encontrado' });

    const creditos = await Credito.find({ clienteId })
      .populate('ventaId', 'numeroVenta total fecha productos')
      .sort({ createdAt: -1 });

    let totalDeuda = 0;
    let totalAbonado = 0;
    let totalFacturado = 0;
    const historialAbonos = [];

    for (const c of creditos) {
      totalFacturado += c.montoTotal;
      if (['pendiente', 'vencido'].includes(c.estado)) {
        totalDeuda += c.saldoPendiente;
      }
      for (const abono of c.abonos) {
        totalAbonado += abono.monto;
        historialAbonos.push({
          creditoId: c._id,
          numeroVenta: c.ventaId?.numeroVenta || '',
          monto: abono.monto,
          fecha: abono.fecha,
          metodoPago: abono.metodoPago,
        });
      }
    }

    historialAbonos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json({
      cliente: {
        _id: cliente._id,
        nombre: cliente.nombre,
        nit: cliente.nit,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
      },
      resumen: {
        totalFacturado,
        totalAbonado,
        totalDeuda,
        creditosTotales: creditos.length,
        creditosPendientes: creditos.filter(c => ['pendiente', 'vencido'].includes(c.estado)).length,
      },
      creditos,
      historialAbonos,
    });
  } catch (error) {
    console.error('Error getEstadoCuentaCliente:', error);
    res.status(500).json({ mensaje: 'Error al obtener estado de cuenta' });
  }
};

// ─── Reporte de Morosidad ───
const getReporteMorosidad = async (req, res) => {
  try {
    const ahora = new Date();

    const creditosVencidos = await Credito.find({
      estado: 'vencido',
    })
      .populate('clienteId', 'nombre nit telefono')
      .populate('ventaId', 'numeroVenta total fecha')
      .sort({ fechaVencimiento: 1 });

    const morosos = {};
    for (const c of creditosVencidos) {
      const cid = String(c.clienteId?._id || c.clienteId);
      const diasVencido = Math.floor((ahora - c.fechaVencimiento) / (1000 * 60 * 60 * 24));

      if (!morosos[cid]) {
        morosos[cid] = {
          clienteId: c.clienteId?._id,
          nombre: c.clienteId?.nombre || 'Sin nombre',
          nit: c.clienteId?.nit || '',
          telefono: c.clienteId?.telefono || '',
          totalDeudaVencida: 0,
          creditosVencidos: 0,
          diasMaxVencimiento: 0,
          detalle: [],
        };
      }

      morosos[cid].totalDeudaVencida += c.saldoPendiente;
      morosos[cid].creditosVencidos += 1;
      if (diasVencido > morosos[cid].diasMaxVencimiento) {
        morosos[cid].diasMaxVencimiento = diasVencido;
      }
      morosos[cid].detalle.push({
        creditoId: c._id,
        numeroVenta: c.ventaId?.numeroVenta || '',
        saldoPendiente: c.saldoPendiente,
        fechaVencimiento: c.fechaVencimiento,
        diasVencido,
      });
    }

    const listaMorosos = Object.values(morosos).sort((a, b) => b.totalDeudaVencida - a.totalDeudaVencida);

    const totalMorosidad = listaMorosos.reduce((sum, m) => sum + m.totalDeudaVencida, 0);

    res.json({
      totalMorosidad,
      totalMorosos: listaMorosos.length,
      totalCreditos: creditosVencidos.length,
      morosos: listaMorosos,
    });
  } catch (error) {
    console.error('Error getReporteMorosidad:', error);
    res.status(500).json({ mensaje: 'Error al obtener reporte de morosidad' });
  }
};

module.exports = {
  getCreditosByCliente,
  registrarAbono,
  getCreditosPendientes,
  getCreditoDetalle,
  updateCreditoVentaProductos,
  getResumenCuentasCobrar,
  getEstadoCuentaCliente,
  getReporteMorosidad,
};
