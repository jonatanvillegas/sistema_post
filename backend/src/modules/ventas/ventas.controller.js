const Venta = require('./venta.model');
const { Producto, Kardex } = require('../inventario/producto.model');
const Caja = require('../caja/caja.model');
const Cliente = require('../clientes/cliente.model');
const Credito = require('../creditos/credito.model');
const mongoose = require('mongoose');

const isControlaStock = (producto) => producto?.controlaStock !== false;

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
      if (desde) filtro.fecha.$gte = new Date(desde);
      if (hasta) filtro.fecha.$lte = new Date(hasta);
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

// @POST /api/ventas
const createVenta = async (req, res) => {
  try {
    const { cliente, productos, descuento = 0, metodoPago, montoRecibido, clienteId } = req.body;

    if (!productos || productos.length === 0) {
      return res.status(400).json({ mensaje: 'La venta debe tener al menos un producto' });
    }

    // 0. Caja debe estar abierta para cualquier venta/pedido
    const cajaActiva = await Caja.findOne({ estado: 'abierta' });
    if (!cajaActiva) {
      return res.status(400).json({ mensaje: 'Debe abrir caja antes de realizar ventas/pedidos' });
    }

    // 1. Validaciones de Crédito
    let infoCliente = cliente || { nombre: 'Consumidor Final', nit: 'CF' };
    let clienteDoc = null;

    if (metodoPago === 'credito') {
      if (!clienteId) return res.status(400).json({ mensaje: 'Debe seleccionar un cliente para ventas al crédito' });
      clienteDoc = await Cliente.findById(clienteId);
      if (!clienteDoc) return res.status(404).json({ mensaje: 'Cliente no encontrado' });
      if (!clienteDoc.estado) return res.status(400).json({ mensaje: 'El cliente está desactivado' });
      infoCliente = { nombre: clienteDoc.nombre, nit: clienteDoc.nit };
    }

    // 2. Verificar stock y calcular subtotales
    let subtotal = 0;
    const productosVenta = [];

    for (const item of productos) {
      const producto = await Producto.findById(item.productoId);
      if (!producto) {
        throw new Error(`Producto ${item.productoId} no encontrado`);
      }

      if (isControlaStock(producto) && producto.stock < item.cantidad) {
        throw new Error(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}`);
      }

      const itemSubtotal = producto.precioVenta * item.cantidad;
      subtotal += itemSubtotal;

      productosVenta.push({
        productoId: producto._id,
        nombre: producto.nombre,
        codigo: producto.codigo || '',
        cantidad: item.cantidad,
        precioUnitario: producto.precioVenta,
        subtotal: itemSubtotal,
      });

      // 3. Descontar stock y registrar en kardex (solo si controla stock)
      if (isControlaStock(producto)) {
        const stockAnterior = producto.stock;
        producto.stock -= item.cantidad;
        await producto.save();

        await Kardex.create({
          productoId: item.productoId,
          tipo: 'salida',
          cantidad: item.cantidad,
          stockAnterior,
          stockNuevo: producto.stock,
          motivo: 'Venta', // Se actualizará abajo
          usuarioId: req.user._id,
        });
      }
    }

    const total = subtotal - descuento;
    
    // 4. Validar límite de crédito if applica
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
      subtotal,
      descuento,
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

    // 8. Actualizar motivo en kardex (puede no existir para productos sin control de stock)
    await Kardex.updateMany(
      { motivo: 'Venta', createdAt: { $gte: venta.createdAt } },
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
      // Pedido/venta al crédito: visible en movimientos, pero no suma a efectivo (cálculos de caja lo excluyen)
      cajaActiva.ingresos.push({
        concepto: `Pedido (Crédito) ${venta.numeroVenta}`,
        monto: total,
        tipo: 'venta_credito',
        ventaId: venta._id,
      });
    }

    await cajaActiva.save();

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

      // Si por algún motivo no existía el movimiento, no bloqueamos la anulación.
      if (removed === 0) {
        console.warn(`[anularVenta] No se encontró movimiento de caja para la venta ${venta._id} (${venta.numeroVenta})`);
      }
    }

    res.json({ mensaje: 'Venta anulada correctamente', venta });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al anular venta', error: error.message });
  }
};

module.exports = { getVentas, getVentaById, createVenta, anularVenta };
