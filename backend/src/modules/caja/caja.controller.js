const Caja = require('./caja.model');

const toCents = (value) => Math.round((Number(value) || 0) * 100);
const fromCents = (cents) => Number((Number(cents || 0) / 100).toFixed(2));

const toStartOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const toEndOfDay = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

const escapeCsv = (value) => {
  const s = String(value ?? '');
  const needsQuotes = /[\n\r,\"]/g.test(s);
  const escaped = s.replace(/\"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const formatIso = (d) => {
  try {
    const x = new Date(d);
    return isValidDate(x) ? x.toISOString() : '';
  } catch {
    return '';
  }
};

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

    if (!Array.isArray(billetaje)) {
      return res.status(400).json({ mensaje: 'Billetaje inválido: se espera un arreglo' });
    }

    if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
      return res.status(400).json({ mensaje: 'Tipo de cambio inválido' });
    }

    console.log('--- PAYLOAD RECIBIDO ---');
    console.log('Billetaje:', JSON.stringify(billetaje, null, 2));

    const caja = await Caja.findById(req.params.id);
    if (!caja) return res.status(404).json({ mensaje: 'Caja no encontrada' });
    if (caja.estado === 'cerrada') return res.status(400).json({ mensaje: 'La caja ya está cerrada' });

    // 1. Calcular totales del sistema (NIO) en centavos para evitar errores de coma flotante
    const totalVentasCents = (caja.ingresos || [])
      .filter(i => i.tipo === 'venta')
      .reduce((sum, i) => sum + toCents(i.monto), 0);

    const totalIngresosCents = (caja.ingresos || [])
      .filter(i => i.tipo === 'ingreso_manual')
      .reduce((sum, i) => sum + toCents(i.monto), 0);

    const totalEgresosCents = (caja.egresos || [])
      .reduce((sum, e) => sum + toCents(e.monto), 0);

    const montoInicialCents = toCents(caja.montoInicial);
    const montoFinalSistemaCents = montoInicialCents + totalVentasCents + totalIngresosCents - totalEgresosCents;
    const montoFinalSistema = fromCents(montoFinalSistemaCents);
    const totalVentas = fromCents(totalVentasCents);
    const totalIngresos = fromCents(totalIngresosCents);
    const totalEgresos = fromCents(totalEgresosCents);

    // 2. Procesar Arqueo Físico (Consolidado en NIO) usando centavos
    let montoFisicoConsolidadoCents = 0;
    const billetajeProcesado = billetaje
      .filter(item => (Number(item?.cantidad) || 0) > 0 && (Number(item?.denominacion) || 0) > 0)
      .map(item => {
      const denom = Number(item.denominacion) || 0;
      const cant = Number(item.cantidad) || 0;

      // Normalizar moneda
      const monRaw = String(item.moneda || '').trim().toUpperCase();
      const esUSD = monRaw === 'USD';
      const monedaFinal = esUSD ? 'USD' : 'NIO';

      // subtotal en la moneda original (centavos)
      const denomCents = Math.round(denom * 100);
      const subCents = denomCents * cant;

      // conversión a NIO (centavos) si corresponde
      const valorConvertidoANIOCents = esUSD
        ? Math.round(subCents * tipoCambio)
        : subCents;

      montoFisicoConsolidadoCents += valorConvertidoANIOCents;

      return {
        denominacion: denom,
        cantidad: cant,
        subtotal: fromCents(subCents),
        moneda: monedaFinal,
        tipo: item.tipo || (denom >= 10 ? 'billete' : 'moneda')
      };
    });

    const montoFisicoConsolidado = fromCents(montoFisicoConsolidadoCents);

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
    const diferenciaCents = montoFinalSistemaCents < 0
      ? (montoFisicoConsolidadoCents + montoFinalSistemaCents)
      : (montoFisicoConsolidadoCents - montoFinalSistemaCents);
    caja.diferencia = fromCents(diferenciaCents);
    
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

    // Totales en centavos (consistentes con el cierre)
    const totalVentasCents = (caja.ingresos || [])
      .filter((i) => i.tipo === 'venta')
      .reduce((sum, i) => sum + toCents(i.monto), 0);

    const totalIngresosCents = (caja.ingresos || [])
      .filter((i) => i.tipo === 'ingreso_manual')
      .reduce((sum, i) => sum + toCents(i.monto), 0);

    const totalEgresosCents = (caja.egresos || [])
      .reduce((sum, e) => sum + toCents(e.monto), 0);

    const montoInicialCents = toCents(caja.montoInicial);
    const saldoActualCents = montoInicialCents + totalVentasCents + totalIngresosCents - totalEgresosCents;

    const totalVentas = fromCents(totalVentasCents);
    const totalIngresos = fromCents(totalIngresosCents);
    const totalEgresos = fromCents(totalEgresosCents);
    const saldoActual = fromCents(saldoActualCents);

    res.json({
      caja,
      resumen: {
        totalVentas,
        totalIngresos,
        totalEgresos,
        saldoActual,
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

// @GET /api/caja/transacciones/export?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Exporta en CSV todos los movimientos (ingresos/egresos) dentro del rango.
const exportTransaccionesCaja = async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ mensaje: 'Debe enviar desde y hasta (YYYY-MM-DD)' });
    }

    const start = toStartOfDay(new Date(desde));
    const end = toEndOfDay(new Date(hasta));

    if (!isValidDate(start) || !isValidDate(end) || start > end) {
      return res.status(400).json({ mensaje: 'Rango de fechas inválido' });
    }

    // Traemos cajas que se solapan con el rango (para no cargar histórico completo)
    const cajas = await Caja.find({
      fechaApertura: { $lte: end },
      $or: [{ fechaCierre: null }, { fechaCierre: { $gte: start } }],
    })
      .populate('usuarioApertura', 'nombre')
      .lean();

    const rows = [];
    for (const caja of cajas) {
      const cajaId = caja?._id;
      const usuario = caja?.usuarioApertura?.nombre || '';
      const fechaApertura = caja?.fechaApertura;
      const fechaCierre = caja?.fechaCierre;

      for (const mov of caja?.ingresos || []) {
        const fechaMov = mov?.createdAt || mov?.fecha;
        const f = new Date(fechaMov);
        if (!isValidDate(f) || f < start || f > end) continue;
        rows.push({
          fecha: f,
          direccion: 'INGRESO',
          tipo: mov?.tipo || '',
          concepto: mov?.concepto || '',
          monto: Number(mov?.monto || 0),
          ventaId: mov?.ventaId || '',
          cajaId,
          usuarioApertura: usuario,
          cajaFechaApertura: fechaApertura,
          cajaFechaCierre: fechaCierre,
        });
      }

      for (const mov of caja?.egresos || []) {
        const fechaMov = mov?.createdAt || mov?.fecha;
        const f = new Date(fechaMov);
        if (!isValidDate(f) || f < start || f > end) continue;
        rows.push({
          fecha: f,
          direccion: 'EGRESO',
          tipo: mov?.tipo || 'egreso',
          concepto: mov?.concepto || '',
          monto: Number(mov?.monto || 0),
          ventaId: mov?.ventaId || '',
          cajaId,
          usuarioApertura: usuario,
          cajaFechaApertura: fechaApertura,
          cajaFechaCierre: fechaCierre,
        });
      }
    }

    rows.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    const header = [
      'fecha',
      'direccion',
      'tipo',
      'concepto',
      'monto',
      'ventaId',
      'cajaId',
      'usuarioApertura',
      'cajaFechaApertura',
      'cajaFechaCierre',
    ].join(',');

    const lines = rows.map((r) =>
      [
        formatIso(r.fecha),
        r.direccion,
        r.tipo,
        r.concepto,
        r.monto,
        r.ventaId,
        r.cajaId,
        r.usuarioApertura,
        formatIso(r.cajaFechaApertura),
        formatIso(r.cajaFechaCierre),
      ]
        .map(escapeCsv)
        .join(',')
    );

    const csv = [header, ...lines].join('\n');
    const filename = `transacciones_caja_${desde}_a_${hasta}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM para Excel
    res.send(`\ufeff${csv}`);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al exportar transacciones', error: error.message });
  }
};

module.exports = {
  abrirCaja,
  cerrarCaja,
  getCajaActual,
  registrarEgreso,
  getHistorialCaja,
  getCajaById,
  exportTransaccionesCaja,
};
