const Credito = require('./credito.model');
const Cliente = require('../clientes/cliente.model');
const Caja = require('../caja/caja.model');
const mongoose = require('mongoose');

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
    const credito = await Credito.findById(req.params.id);

    if (!credito) return res.status(404).json({ mensaje: 'Crédito no encontrado' });
    if (credito.estado === 'pagado') return res.status(400).json({ mensaje: 'El crédito ya está pagado' });
    if (monto > credito.saldoPendiente) return res.status(400).json({ mensaje: `El monto excede el saldo pendiente (${credito.saldoPendiente})` });

    // 1. Verificar si hay caja abierta
    const cajaActiva = await Caja.findOne({ estado: 'abierta' });
    if (!cajaActiva) return res.status(400).json({ mensaje: 'Debe abrir caja antes de recibir un abono' });

    // 2. Registrar el abono en el arreglo
    credito.abonos.push({
      monto,
      metodoPago,
      comprobante,
      usuarioId: req.user._id,
      cajaId: cajaActiva._id,
    });

    // 3. Guardar el crédito
    await credito.save();

    // 4. Actualizar el saldoActual del Cliente
    await Cliente.findByIdAndUpdate(
      credito.clienteId,
      { $inc: { saldoActual: -monto } }
    );

    // 5. Registrar el movimiento de ingreso en la caja
    cajaActiva.ingresos.push({
      concepto: `Abono a Crédito - Venta: ${req.body.numeroVenta || 'C-' + req.params.id.slice(-5)}`,
      monto,
      tipo: 'ingreso_manual',
      fecha: new Date(),
    });

    await cajaActiva.save();

    res.json({ mensaje: 'Abono registrado con éxito', credito });
  } catch (error) {
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

module.exports = {
  getCreditosByCliente,
  registrarAbono,
  getCreditosPendientes,
};
