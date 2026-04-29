const Venta = require('./venta.model');
const { Producto, Kardex } = require('../inventario/producto.model');
const Caja = require('../caja/caja.model');
const Cliente = require('../clientes/cliente.model');
const Credito = require('../creditos/credito.model');
const mongoose = require('mongoose');
const { recordAudit } = require('../audit/audit.controller');

const isControlaStock = (producto) => producto?.controlaStock !== false;

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const safeDiscount = ({ baseAmount, tipo, valor }) => {
  const base = Number(baseAmount);
  if (!isFinite(base) || base <= 0) return { tipo: 'ninguno', valor: 0, monto: 0 };

  const t = String(tipo || 'ninguno');
  const v = Number(valor);
  if (!isFinite(v) || v <= 0) return { tipo: 'ninguno', valor: 0, monto: 0 };

  let monto = 0;
  if (t === 'porcentaje') {
    if (v >= 100) {
      monto = base;
    } else {
      monto = base * (v / 100);
    }
  } else if (t === 'monto') {
    monto = v;
  } else {
    return { tipo: 'ninguno', valor: 0, monto: 0 };
  }

  monto = Math.min(Math.max(0, monto), base);
  return { tipo: t, valor: v, monto: round2(monto) };
};

// @GET /api/ventas
const getVentas = async (req, res) => {
  try {
    const { desde, hasta, estado, buscar, page = 1, limit = 20 } = req.query;
    const filtro = {};

    if (estado) filtro.estado = estado;

    if (buscar && String(buscar).trim()) {
      const q = String(buscar).trim();
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [
        { numeroVenta: rx },
        { 'cliente.nombre': rx },
        { 'cliente.nit': rx },
      ];
    }
    if (desde || hasta) {
      filtro.fecha = {};
      if (desde) filtro.fecha.$gte = new Date(`${desde}T00:00:00`);
      if (hasta) filtro.fecha.$lte = new Date(`${hasta}T23:59:59.999`);
    }

    const total = await Venta.countDocuments(filtro);
    const ventas = await Venta.find(filtro)
      .populate('usuarioId', 'nombre')
      .sort({ fecha: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ total, pagina: Number(page), ventas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener ventas', error: error.message });
  }
};

// @GET /api/ventas/reporte/admin  (solo Admin)
const getVentasReporteAdmin = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ mensaje: 'Debe enviar desde y hasta (YYYY-MM-DD)' });
    }

    const d0 = new Date(`${desde}T00:00:00`);
    const d1 = new Date(`${hasta}T23:59:59.999`);
    if (Number.isNaN(d0.getTime()) || Number.isNaN(d1.getTime())) {
      return res.status(400).json({ mensaje: 'Rango de fecha inválido' });
    }

    const match = {
      estado: 'completada',
      fecha: { $gte: d0, $lte: d1 },
    };

    const [agg] = await Venta.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          cantidadVentas: { $sum: 1 },
          subtotalBruto: { $sum: '$subtotal' },
          totalDescuentos: { $sum: '$descuento' },
          totalVendido: { $sum: '$total' },

          conDescuentoCount: { $sum: { $cond: [{ $gt: ['$descuento', 0] }, 1, 0] } },
          conDescuentoTotal: { $sum: { $cond: [{ $gt: ['$descuento', 0] }, '$total', 0] } },

          sinDescuentoCount: { $sum: { $cond: [{ $eq: ['$descuento', 0] }, 1, 0] } },
          sinDescuentoTotal: { $sum: { $cond: [{ $eq: ['$descuento', 0] }, '$total', 0] } },
        },
      },
    ]);

    const totales = {
      cantidadVentas: Number(agg?.cantidadVentas) || 0,
      subtotalBruto: round2(agg?.subtotalBruto || 0),
      totalDescuentos: round2(agg?.totalDescuentos || 0),
      totalVendido: round2(agg?.totalVendido || 0),
      conDescuento: {
        count: Number(agg?.conDescuentoCount) || 0,
        total: round2(agg?.conDescuentoTotal || 0),
      },
      sinDescuento: {
        count: Number(agg?.sinDescuentoCount) || 0,
        total: round2(agg?.sinDescuentoTotal || 0),
      },
    };

    const ventas = await Venta.find(match)
      .populate('usuarioId', 'nombre')
      .sort({ fecha: -1 })
      .limit(1000);

    res.json({ desde, hasta, totales, ventas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar reporte', error: error.message });
  }
};

// @GET /api/ventas/:id
const getVentaById = async (req, res) => {
  try {
    const venta = await Venta.findById(req.params.id).populate('usuarioId', 'nombre');
    if (!venta) return res.status(404).json({ mensaje: 'Venta no encontrada' });
    res.json(venta);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener venta', error: error.message });
  }
};

const Config = require('../config/config.model');

// @POST /api/ventas
const createVenta = async (req, res) => {
  try {
    const {
      cliente,
      productos,
      descuento = 0,
      descuentoGeneralTipo,
      descuentoGeneralValor,
      metodoPago,
      montoRecibido,
      clienteId,
    } = req.body;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ mensaje: 'La venta debe tener al menos un producto' });
    }

    const rol = String(req.user?.rol || '');
    const canApplyDiscount = rol === 'admin' || (rol === 'cajero' && req.user?.puedeAplicarDescuento === true);
    if (!canApplyDiscount) {
      const hasGeneralDiscount =
        (descuentoGeneralTipo && String(descuentoGeneralTipo) !== 'ninguno' && Number(descuentoGeneralValor) > 0) ||
        Number(descuento) > 0;
      const hasLineDiscount = Array.isArray(productos)
        ? productos.some((it) => {
            const tipo = String(it?.descuentoTipo || 'ninguno');
            const val = Number(it?.descuentoValor || 0);
            return tipo !== 'ninguno' && val > 0;
          })
        : false;
      if (hasGeneralDiscount || hasLineDiscount) {
        return res.status(403).json({ mensaje: 'No tiene permiso para aplicar descuentos' });
      }
    }

    // 0. Caja: Consultar modo y buscar caja abierta correcta
    let config = await Config.findOne();
    if (!config) config = await Config.create({});

    const queryCaja = { estado: 'abierta' };
    if (config.tipoSistema === 'online') {
      queryCaja.usuarioApertura = req.user._id;
    }

    const cajaActiva = await Caja.findOne(queryCaja);
    if (!cajaActiva) {
      throw new Error('Debe abrir caja antes de realizar ventas/pedidos');
    }

    // 1. Validaciones de Crédito
    let infoCliente = cliente || { nombre: 'Consumidor Final', nit: 'CF' };
    let clienteDoc = null;

    if (metodoPago === 'credito') {
      if (!clienteId) throw new Error('Debe seleccionar un cliente para ventas al crédito');
      clienteDoc = await Cliente.findById(clienteId);
      if (!clienteDoc) throw new Error('Cliente no encontrado');
      if (!clienteDoc.estado) throw new Error('El cliente está desactivado');
      infoCliente = { nombre: clienteDoc.nombre, nit: clienteDoc.nit };
    }

    // 2. Verificar stock y calcular subtotales/desc.
    let subtotalBruto = 0;
    let descuentoLineas = 0;
    const productosVenta = [];

    for (const item of productos) {
      const producto = await Producto.findById(item.productoId);
      if (!producto) {
        throw new Error(`Producto ${item.productoId} no encontrado`);
      }

      if (isControlaStock(producto) && producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}`);
      }

      const qty = Number(item.cantidad);
      if (!isFinite(qty) || qty < 1) {
        throw new Error(`Cantidad inválida para "${producto.nombre}"`);
      }
      const unit = Number(producto.precioVenta);

      const itemSubtotalBruto = unit * qty;
      subtotalBruto += itemSubtotalBruto;

      const descLinea = safeDiscount({
        baseAmount: itemSubtotalBruto,
        tipo: item?.descuentoTipo,
        valor: item?.descuentoValor,
      });
      descuentoLineas += descLinea.monto;
      const itemSubtotal = round2(itemSubtotalBruto - descLinea.monto);

      productosVenta.push({
        productoId: producto._id,
        nombre: producto.nombre,
        codigo: producto.codigo || '',
        cantidad: item.cantidad,
        precioUnitario: producto.precioVenta,
        subtotalBruto: round2(itemSubtotalBruto),
        descuentoTipo: descLinea.tipo,
        descuentoValor: descLinea.valor,
        descuentoMonto: descLinea.monto,
        subtotal: itemSubtotal,
      });

      // 3. Descontar stock atómicamente y registrar en kardex
      if (isControlaStock(producto)) {
        const stockAnterior = producto.stock;
        
        // Actualización atómica (Funciona en standalone MongoDB)
        const updatedProd = await Producto.findOneAndUpdate(
          { _id: producto._id, stock: { $gte: item.cantidad } },
          { $inc: { stock: -item.cantidad } },
          { new: true }
        );

        if (!updatedProd) {
          throw new Error(`No se pudo actualizar stock de "${producto.nombre}". Stock insuficiente.`);
        }

        await Kardex.create({
          productoId: item.productoId,
          tipo: 'salida',
          cantidad: item.cantidad,
          stockAnterior,
          stockNuevo: updatedProd.stock,
          motivo: `Venta (procesando)`,
          usuarioId: req.user._id,
        });
      }
    }

    subtotalBruto = round2(subtotalBruto);
    descuentoLineas = round2(descuentoLineas);
    const baseGeneral = Math.max(0, subtotalBruto - descuentoLineas);

    const generalTipo = descuentoGeneralTipo ? String(descuentoGeneralTipo) : (Number(descuento) > 0 ? 'monto' : 'ninguno');
    const generalValor = descuentoGeneralTipo ? descuentoGeneralValor : descuento;
    const descGeneral = safeDiscount({ baseAmount: baseGeneral, tipo: generalTipo, valor: generalValor });

    const descuentoTotal = round2(descuentoLineas + descGeneral.monto);
    const total = round2(subtotalBruto - descuentoTotal);
    
    // 4. Validar límite de crédito
    if (metodoPago === 'credito') {
      const clienteObjId = new mongoose.Types.ObjectId(clienteId);

      const agg = await Credito.aggregate([
        { $match: { clienteId: clienteObjId, estado: { $in: ['pendiente', 'vencido'] } } },
        { $group: { _id: null, total: { $sum: '$saldoPendiente' } } },
      ]);

      const deudaActual = Number(agg?.[0]?.total) || 0;
      const nuevoSaldo = deudaActual + total;

      if (nuevoSaldo > clienteDoc.limiteCredito && clienteDoc.limiteCredito > 0) {
        throw new Error(`Límite de crédito excedido. Disponible: ${clienteDoc.limiteCredito - deudaActual}`);
      }

      clienteDoc.saldoActual = nuevoSaldo;
      await clienteDoc.save();
    }

    const vuelto = metodoPago === 'efectivo' ? (montoRecibido || 0) - total : 0;
    if (metodoPago === 'efectivo' && montoRecibido < total) {
       throw new Error('Monto recibido insuficiente');
    }

    // 6. Crear la venta
    const venta = await Venta.create({
      cliente: infoCliente,
      clienteId: clienteId || null,
      productos: productosVenta,
      subtotal: subtotalBruto,
      descuento: descuentoTotal,
      descuentoLineas,
      descuentoGeneralTipo: descGeneral.tipo,
      descuentoGeneralValor: descGeneral.valor,
      descuentoGeneralMonto: descGeneral.monto,
      total,
      metodoPago: metodoPago || 'efectivo',
      montoRecibido: metodoPago === 'credito' ? 0 : (montoRecibido || total),
      vuelto: vuelto > 0 ? vuelto : 0,
      usuarioId: req.user._id,
      cajaId: cajaActiva._id,
    });

    // 7. Si es crédito, crear documento de crédito
    if (metodoPago === 'credito') {
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

      await Credito.create({
        clienteId,
        ventaId: venta._id,
        montoTotal: total,
        saldoPendiente: total,
        fechaVencimiento,
      });
    }

    // 8. Actualizar motivo en kardex
    await Kardex.updateMany(
      { motivo: 'Venta (procesando)', usuarioId: req.user._id, createdAt: { $gte: venta.createdAt } },
      { motivo: `Venta ${venta.numeroVenta}` }
    );

    // 9. Registrar movimiento en caja
    if (metodoPago !== 'credito') {
      cajaActiva.ingresos.push({
        concepto: `Venta ${venta.numeroVenta}`,
        monto: total,
        tipo: 'venta',
        ventaId: venta._id,
      });
    } else {
      cajaActiva.ingresos.push({
        concepto: `Pedido (Crédito) ${venta.numeroVenta}`,
        monto: total,
        tipo: 'venta_credito',
        ventaId: venta._id,
      });
    }

    await cajaActiva.save();

    await recordAudit({
      usuarioId: req.user._id,
      accion: 'CREATE',
      modulo: 'VENTAS',
      detalle: `Venta creada: ${venta.numeroVenta} por ${total}`,
      metadata: { ventaId: venta._id, total },
      req,
    });

    res.status(201).json(venta);
  } catch (error) {
    res.status(500).json({ mensaje: error.message || 'Error al crear venta' });
  }
};

// @PUT /api/ventas/:id/anular  (solo Admin)
const anularVenta = async (req, res) => {
  try {
    const { motivo } = req.body;
    const venta = await Venta.findById(req.params.id);

    if (!venta) return res.status(404).json({ mensaje: 'Venta no encontrada' });
    if (venta.estado === 'anulada') {
      return res.status(400).json({ mensaje: 'La venta ya está anulada' });
    }

    // Validaciones previas para no dejar el sistema inconsistente
    let caja = null;
    if (venta.cajaId) {
      caja = await Caja.findById(venta.cajaId);
      if (caja && caja.estado === 'cerrada') {
        return res.status(400).json({ mensaje: 'No se puede anular una venta de una caja cerrada' });
      }
    }

    let credito = null;
    if (venta.metodoPago === 'credito') {
      credito = await Credito.findOne({ ventaId: venta._id });
      const abonosCount = credito?.abonos?.length || 0;
      if (abonosCount > 0) {
        return res.status(400).json({
          mensaje: 'No se puede anular una venta al crédito que ya tiene abonos. Revierta/ajuste el crédito primero.',
        });
      }
    }

    venta.estado = 'anulada';
    venta.motivoAnulacion = motivo || 'Sin motivo especificado';
    await venta.save();

    // Revertir stock (solo productos que controlan stock)
    for (const item of venta.productos) {
      const producto = await Producto.findById(item.productoId);
      if (producto) {
        if (isControlaStock(producto)) {
          const stockAnterior = producto.stock;
          producto.stock += item.cantidad;
          await producto.save();

          await Kardex.create({
            productoId: item.productoId,
            tipo: 'entrada',
            cantidad: item.cantidad,
            stockAnterior,
            stockNuevo: producto.stock,
            motivo: `Anulación venta ${venta.numeroVenta}`,
            usuarioId: req.user._id,
          });
        }
      }
    }

    // Reverso contable
    if (venta.metodoPago === 'credito') {
      // Anular crédito y restaurar saldo del cliente
      if (credito) {
        credito.estado = 'anulado';
        const notaExtra = `Anulado por: ${req.user?._id || 'sistema'} | Motivo: ${venta.motivoAnulacion}`;
        credito.notas = credito.notas ? `${credito.notas}\n${notaExtra}` : notaExtra;
        await credito.save();
      }

      if (venta.clienteId) {
        const clienteDoc = await Cliente.findById(venta.clienteId);
        if (clienteDoc) {
          const nuevoSaldo = (Number(clienteDoc.saldoActual) || 0) - (Number(venta.total) || 0);
          clienteDoc.saldoActual = Math.max(0, nuevoSaldo);
          await clienteDoc.save();
        }
      }
    }

    // Quitar el movimiento de ingreso asociado a la venta (venta / venta_credito)
    // para que NO afecte el cierre ni aparezca en la caja.
    if (caja) {
      const before = (caja.ingresos || []).length;
      caja.ingresos = (caja.ingresos || []).filter((mov) => {
        const sameVenta = mov?.ventaId && String(mov.ventaId) === String(venta._id);
        const isVentaMov = mov?.tipo === 'venta' || mov?.tipo === 'venta_credito';
        return !(sameVenta && isVentaMov);
      });
      const removed = before - (caja.ingresos || []).length;
      await caja.save();

      if (removed === 0) {
        console.warn(`[anularVenta] No se encontró movimiento de caja para la venta ${venta._id} (${venta.numeroVenta})`);
      }
    }

    await recordAudit({
      usuarioId: req.user._id,
      accion: 'ANULAR',
      modulo: 'VENTAS',
      detalle: `Venta anulada: ${venta.numeroVenta}`,
      metadata: { ventaId: venta._id, motivo },
      req,
    });

    res.json({ mensaje: 'Venta anulada correctamente', venta });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al anular venta', error: error.message });
  }
};

module.exports = { getVentas, getVentaById, getVentasReporteAdmin, createVenta, anularVenta };
