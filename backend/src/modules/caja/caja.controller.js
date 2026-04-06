const Caja = require('./caja.model');

// @POST /api/caja/abrir
const abrirCaja = async (req, res) => {
  try {
    const { montoInicial, observaciones } = req.body;

    // Verificar que no haya caja abierta
    const cajaActiva = await Caja.findOne({ estado: 'abierta' });
    if (cajaActiva) {
      return res.status(400).json({
        mensaje: 'Ya existe una caja abierta',
        caja: cajaActiva,
      });
    }

    const caja = await Caja.create({
      montoInicial: montoInicial || 0,
      observaciones,
      usuarioApertura: req.user._id,
    });

    res.status(201).json({ mensaje: 'Caja abierta correctamente', caja });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al abrir caja', error: error.message });
  }
};

// @PUT /api/caja/cerrar/:id
const cerrarCaja = async (req, res) => {
  try {
    const { billetaje = [], observaciones, tipoCambio: tipoCambioInput } = req.body;
    const tipoCambio = Number(tipoCambioInput) || 36.6;

    console.log('--- PAYLOAD RECIBIDO ---');
    console.log('Billetaje:', JSON.stringify(billetaje, null, 2));

    const caja = await Caja.findById(req.params.id);
    if (!caja) return res.status(404).json({ mensaje: 'Caja no encontrada' });
    if (caja.estado === 'cerrada') return res.status(400).json({ mensaje: 'La caja ya está cerrada' });

    // 1. Calcular totales del sistema (NIO)
    const totalVentas = (caja.ingresos || [])
      .filter(i => i.tipo === 'venta')
      .reduce((sum, i) => sum + (Number(i.monto) || 0), 0);

    const totalIngresos = (caja.ingresos || [])
      .filter(i => i.tipo === 'ingreso_manual')
      .reduce((sum, i) => sum + (Number(i.monto) || 0), 0);

    const totalEgresos = (caja.egresos || [])
      .reduce((sum, e) => sum + (Number(e.monto) || 0), 0);

    const montoFinalSistema = (caja.montoInicial || 0) + totalVentas + totalIngresos - totalEgresos;

    // 2. Procesar Arqueo Físico (Consolidado en NIO)
    let montoFisicoConsolidado = 0;
    const billetajeProcesado = billetaje.map(item => {
      const denom = Number(item.denominacion) || 0;
      const cant = Number(item.cantidad) || 0;
      const sub = denom * cant;
      
      const monRaw = String(item.moneda || '').trim().toUpperCase();
      const esUSD = monRaw === 'USD';
      const monedaFinal = esUSD ? 'USD' : 'NIO';
      
      // Conversión CRITICA a NIO si es USD
      const valorConvertidoANIO = esUSD ? (sub * tipoCambio) : sub;
      
      montoFisicoConsolidado += valorConvertidoANIO;

      return {
        denominacion: denom,
        cantidad: cant,
        subtotal: sub,
        moneda: monedaFinal,
        tipo: item.tipo || (denom >= 10 ? 'billete' : 'moneda')
      };
    });

    console.log('Monto Fisico Total (NIO):', montoFisicoConsolidado);
    console.log('Monto Sistema Total (NIO):', montoFinalSistema);

    // 3. Persistencia en Base de Datos
    caja.fechaCierre = new Date();
    caja.estado = 'cerrada';
    caja.totalVentas = totalVentas;
    caja.totalIngresos = totalIngresos;
    caja.totalEgresos = totalEgresos;
    caja.tipoCambio = tipoCambio;
    caja.montoFinal = montoFisicoConsolidado;
    caja.diferencia = montoFisicoConsolidado - montoFinalSistema;
    
    // Carga de billetaje usando .set para mayor seguridad en Mongoose
    caja.set('billetaje', billetajeProcesado);
    caja.observaciones = observaciones || '';
    caja.usuarioCierre = req.user._id;

    // Obligar a Mongoose a notar el cambio en el esquema mixto o de array
    caja.markModified('billetaje');

    const cajaGuardada = await caja.save();

    console.log('--- CIERRE REALIZADO ---');
    console.log('Monto Fisico Final:', montoFisicoConsolidado);
    console.log('Billetaje en BD:', cajaGuardada.billetaje.length);

    res.json({
      mensaje: 'Caja cerrada correctamente',
      resumen: {
        montoInicial: caja.montoInicial,
        totalVentas,
        totalIngresos,
        totalEgresos,
        montoFinalSistema,
        montoFisico: montoFisicoConsolidado,
        diferencia: caja.diferencia,
        tipoCambio,
        billetaje: cajaGuardada.billetaje // RETORNAMOS LO QUE REALMENTE SE GUARDÓ
      }
    });
  } catch (error) {
    console.error('ERROR CRÍTICO CERRAR CAJA:', error);
    res.status(500).json({ mensaje: 'Error técnico al persistir cierre', error: error.message });
  }
};

// @GET /api/caja/actual
const getCajaActual = async (req, res) => {
  try {
    const caja = await Caja.findOne({ estado: 'abierta' })
      .populate('usuarioApertura', 'nombre')
      .sort({ fechaApertura: -1 });

    if (!caja) {
      return res.status(404).json({ mensaje: 'No hay caja abierta actualmente' });
    }

    const totalVentas = caja.ingresos
      .filter((i) => i.tipo === 'venta')
      .reduce((sum, i) => sum + i.monto, 0);

    const totalEgresos = caja.egresos.reduce((sum, e) => sum + e.monto, 0);

    res.json({
      caja,
      resumen: {
        totalVentas,
        totalEgresos,
        saldoActual: caja.montoInicial + totalVentas - totalEgresos,
      },
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener caja actual', error: error.message });
  }
};

// @POST /api/caja/egreso
const registrarEgreso = async (req, res) => {
  try {
    const { concepto, monto } = req.body;

    const caja = await Caja.findOne({ estado: 'abierta' });
    if (!caja) return res.status(404).json({ mensaje: 'No hay caja abierta' });

    caja.egresos.push({ concepto, monto, tipo: 'egreso' });
    await caja.save();

    res.json({ mensaje: 'Egreso registrado', caja });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar egreso', error: error.message });
  }
};

// @GET /api/caja/historial  (Admin)
const getHistorialCaja = async (req, res) => {
  try {
    const { page = 1, limit = 10, desde, hasta } = req.query;
    const filtro = {};

    if (desde || hasta) {
      filtro.fechaApertura = {};
      if (desde) filtro.fechaApertura.$gte = new Date(desde);
      if (hasta) {
        const fechaHasta = new Date(hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        filtro.fechaApertura.$lte = fechaHasta;
      }
    }

    const total = await Caja.countDocuments(filtro);
    const cajas = await Caja.find(filtro)
      .populate('usuarioApertura', 'nombre')
      .populate('usuarioCierre', 'nombre')
      .sort({ fechaApertura: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ total, pagina: Number(page), cajas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener historial de cajas', error: error.message });
  }
};

// @GET /api/caja/:id
const getCajaById = async (req, res) => {
  try {
    const caja = await Caja.findById(req.params.id)
      .populate('usuarioApertura', 'nombre')
      .populate('usuarioCierre', 'nombre');

    if (!caja) return res.status(404).json({ mensaje: 'Caja no encontrada' });
    res.json(caja);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener caja', error: error.message });
  }
};

module.exports = { abrirCaja, cerrarCaja, getCajaActual, registrarEgreso, getHistorialCaja, getCajaById };
