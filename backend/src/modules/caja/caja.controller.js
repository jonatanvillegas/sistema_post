const Caja = require('./caja.model');

const toCents = (value) => Math.round((Number(value) || 0) * 100);
const fromCents = (cents) => Number((Number(cents || 0) / 100).toFixed(2));

const toStartOfDay = (d) => {
  return new Date(`${d}T00:00:00`);
};

const toEndOfDay = (d) => {
  return new Date(`${d}T23:59:59.999`);
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
    if (!isValidDate(x)) return '';
    
    // Formato local legible para Excel/CSV: YYYY-MM-DD HH:mm:ss
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = x.getFullYear();
    const mm = pad(x.getMonth() + 1);
    const dd = pad(x.getDate());
    const hh = pad(x.getHours());
    const min = pad(x.getMinutes());
    const ss = pad(x.getSeconds());
    
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
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
    const { billetaje = [], observaciones, tipoCambio: tipoCambioInput, depositoTransferencia: depositoTransferenciaInput } = req.body;
    const tipoCambio = Number(tipoCambioInput) || 36.6;
    const depositoTransferencia = Number(depositoTransferenciaInput || 0);

    if (!Array.isArray(billetaje)) {
      return res.status(400).json({ mensaje: 'Billetaje inválido: se espera un arreglo' });
    }

    if (!Number.isFinite(tipoCambio) || tipoCambio <= 0) {
      return res.status(400).json({ mensaje: 'Tipo de cambio inválido' });
    }

    if (!Number.isFinite(depositoTransferencia) || depositoTransferencia < 0) {
      return res.status(400).json({ mensaje: 'Depósito/transferencia inválido' });
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
      .filter(i => i.tipo === 'ingreso_manual' || i.tipo === 'ingreso_externo')
      .reduce((sum, i) => sum + toCents(i.monto), 0);

    const totalEgresosCents = (caja.egresos || [])
      .reduce((sum, e) => sum + toCents(e.monto), 0);

    const depositoTransferenciaCents = toCents(depositoTransferencia);
    const totalEgresosAjustadoCents = totalEgresosCents + depositoTransferenciaCents;

    const montoInicialCents = toCents(caja.montoInicial);
    const montoFinalSistemaCents = montoInicialCents + totalVentasCents + totalIngresosCents - totalEgresosAjustadoCents;
    const montoFinalSistema = fromCents(montoFinalSistemaCents);
    const totalVentas = fromCents(totalVentasCents);
    const totalIngresos = fromCents(totalIngresosCents);
    const totalEgresos = fromCents(totalEgresosAjustadoCents);

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
    caja.depositoTransferencia = fromCents(depositoTransferenciaCents);
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
        depositoTransferencia: caja.depositoTransferencia,
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
      .filter((i) => i.tipo === 'ingreso_manual' || i.tipo === 'ingreso_externo')
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

// @POST /api/caja/ingreso
const registrarIngreso = async (req, res) => {
  try {
    const { concepto, monto } = req.body;
    const montoNum = Number(monto || 0);

    if (!concepto || !String(concepto).trim()) {
      return res.status(400).json({ mensaje: 'El concepto es requerido' });
    }

    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser mayor a cero' });
    }

    const caja = await Caja.findOne({ estado: 'abierta' });
    if (!caja) return res.status(404).json({ mensaje: 'No hay caja abierta' });

    caja.ingresos.push({ concepto, monto: montoNum, tipo: 'ingreso_externo' });
    await caja.save();

    res.json({ mensaje: 'Ingreso registrado', caja });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar ingreso', error: error.message });
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
      if (desde) filtro.fechaApertura.$gte = new Date(`${desde}T00:00:00`);
      if (hasta) filtro.fechaApertura.$lte = new Date(`${hasta}T23:59:59.999`);
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
    const { desde, hasta, cajaId } = req.query;

    const filtro = {};
    if (cajaId) {
      filtro._id = cajaId;
    } else {
      if (!desde || !hasta) {
        return res.status(400).json({ mensaje: 'Debe enviar desde y hasta (YYYY-MM-DD) o un cajaId' });
      }
      const start = toStartOfDay(desde);
      const end = toEndOfDay(hasta);

      if (!isValidDate(start) || !isValidDate(end) || start > end) {
        return res.status(400).json({ mensaje: 'Rango de fechas inválido' });
      }

      filtro.fechaApertura = { $lte: end };
      filtro.$or = [{ fechaCierre: null }, { fechaCierre: { $gte: start } }];
    }

    const cajas = await Caja.find(filtro)
      .populate('usuarioApertura', 'nombre')
      .lean();

    const start = desde ? toStartOfDay(desde) : null;
    const end = hasta ? toEndOfDay(hasta) : null;

    const rows = [];
    for (const caja of cajas) {
      const cajaId = caja?._id;
      const usuario = caja?.usuarioApertura?.nombre || '';
      const fechaApertura = caja?.fechaApertura;
      const fechaCierre = caja?.fechaCierre;

      for (const mov of caja?.ingresos || []) {
        const fechaMov = mov?.createdAt || mov?.fecha;
        const f = new Date(fechaMov);
        if (start && end && (!isValidDate(f) || f < start || f > end)) continue;
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
        if (start && end && (!isValidDate(f) || f < start || f > end)) continue;
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
    const filename = cajaId ? `movimientos_caja_${cajaId}.csv` : `transacciones_caja_${desde}_a_${hasta}.csv`;

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
  registrarIngreso,
  registrarEgreso,
  getHistorialCaja,
  getCajaById,
  exportTransaccionesCaja,
};
