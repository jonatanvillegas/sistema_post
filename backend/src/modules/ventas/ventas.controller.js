const Venta = require('./venta.model');
const { Producto, Kardex } = require('../inventario/producto.model');
const Caja = require('../caja/caja.model');
const Cliente = require('../clientes/cliente.model');
const Credito = require('../creditos/credito.model');
const mongoose = require('mongoose');

// @GET /api/ventas
const getVentas = async (req, res) => {
  try {
    const { desde, hasta, estado, page = 1, limit = 20 } = req.query;
    const filtro = {};

    if (estado) filtro.estado = estado;
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
      if (producto.stock < item.cantidad) {
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

      // 3. Descontar stock y registrar en kardex
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

    const total = subtotal - descuento;
    
    // 4. Validar límite de crédito if applica
    if (metodoPago === 'credito') {
      const nuevoSaldo = clienteDoc.saldoActual + total;
      if (nuevoSaldo > clienteDoc.limiteCredito && clienteDoc.limiteCredito > 0) {
        throw new Error(`Límite de crédito excedido. Disponible: ${clienteDoc.limiteCredito - clienteDoc.saldoActual}`);
      }
      clienteDoc.saldoActual = nuevoSaldo;
      await clienteDoc.save();
    }

    const vuelto = metodoPago === 'efectivo' ? (montoRecibido || 0) - total : 0;
    if (metodoPago === 'efectivo' && montoRecibido < total) {
       throw new Error('Monto recibido insuficiente');
    }

    // 5. Verificar si hay caja abierta
    const cajaActiva = await Caja.findOne({ estado: 'abierta' });

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
      cajaId: cajaActiva ? cajaActiva._id : null,
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
      { motivo: 'Venta', createdAt: { $gte: venta.createdAt } },
      { motivo: `Venta ${venta.numeroVenta}` }
    );

    // 9. Registrar ingreso en caja si no es crédito
    if (cajaActiva && metodoPago !== 'credito') {
      cajaActiva.ingresos.push({
        concepto: `Venta ${venta.numeroVenta}`,
        monto: total,
        tipo: 'venta',
        ventaId: venta._id,
      });
      await cajaActiva.save();
    }

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

    // Revertir stock
    for (const item of venta.productos) {
      const producto = await Producto.findById(item.productoId);
      if (producto) {
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
    } else if (caja) {
      // Crear un egreso de reverso en la caja abierta (mantiene auditoría)
      caja.egresos.push({
        concepto: `Anulación venta ${venta.numeroVenta}`,
        monto: venta.total,
        tipo: 'egreso',
        ventaId: venta._id,
      });
      await caja.save();
    }

    res.json({ mensaje: 'Venta anulada correctamente', venta });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al anular venta', error: error.message });
  }
};

module.exports = { getVentas, getVentaById, createVenta, anularVenta };
