const mongoose = require('mongoose');
const Cuenta = require('./cuenta.model');
const Asiento = require('./asiento.model');
const {
  round2,
  getConfig,
  seedCuentasIniciales,
  crearAsiento,
} = require('./contabilidad.service');

const parseRango = (query) => {
  const filtro = {};
  if (query.desde || query.hasta) {
    filtro.fecha = {};
    if (query.desde) filtro.fecha.$gte = new Date(`${query.desde}T00:00:00`);
    if (query.hasta) filtro.fecha.$lte = new Date(`${query.hasta}T23:59:59.999`);
  }
  return filtro;
};

const getConfiguracion = async (_req, res) => {
  try {
    await seedCuentasIniciales();
    const config = await getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener configuración contable', error: error.message });
  }
};

const updateConfiguracion = async (req, res) => {
  try {
    const config = await getConfig();
    const { activa, integraciones, cuentasPorDefecto } = req.body;

    if (typeof activa === 'boolean') config.activa = activa;
    if (integraciones) config.integraciones = { ...config.integraciones?.toObject?.(), ...integraciones };
    if (cuentasPorDefecto) config.cuentasPorDefecto = { ...config.cuentasPorDefecto?.toObject?.(), ...cuentasPorDefecto };

    await config.save();
    res.json(config);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar configuración contable', error: error.message });
  }
};

const getCuentas = async (req, res) => {
  try {
    await seedCuentasIniciales();
    const filtro = {};
    if (req.query.tipo) filtro.tipo = req.query.tipo;
    if (req.query.estado !== undefined) filtro.estado = req.query.estado === 'true';
    const cuentas = await Cuenta.find(filtro).sort({ codigo: 1 });
    res.json(cuentas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener cuentas contables', error: error.message });
  }
};

const createCuenta = async (req, res) => {
  try {
    const cuenta = await Cuenta.create(req.body);
    res.status(201).json(cuenta);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear cuenta contable', error: error.message });
  }
};

const updateCuenta = async (req, res) => {
  try {
    const cuenta = await Cuenta.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cuenta) return res.status(404).json({ mensaje: 'Cuenta contable no encontrada' });
    res.json(cuenta);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar cuenta contable', error: error.message });
  }
};

const getAsientos = async (req, res) => {
  try {
    const { buscar, page = 1, limit = 20 } = req.query;
    const filtro = parseRango(req.query);
    if (req.query.estado) filtro.estado = req.query.estado;
    if (buscar && String(buscar).trim()) {
      const rx = new RegExp(String(buscar).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [{ numero: rx }, { concepto: rx }, { referencia: rx }];
    }

    const total = await Asiento.countDocuments(filtro);
    const asientos = await Asiento.find(filtro)
      .populate('usuarioId', 'nombre')
      .sort({ fecha: -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.json({ total, pagina: Number(page), asientos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener comprobantes diarios', error: error.message });
  }
};

const createAsiento = async (req, res) => {
  try {
    const asiento = await crearAsiento({
      ...req.body,
      origen: { modulo: 'manual', documentoNumero: req.body.referencia || '' },
      usuarioId: req.user?._id,
    });
    res.status(201).json(asiento);
  } catch (error) {
    res.status(400).json({ mensaje: error.message || 'Error al crear comprobante diario' });
  }
};

const anularAsiento = async (req, res) => {
  try {
    const asiento = await Asiento.findById(req.params.id);
    if (!asiento) return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
    if (asiento.estado === 'anulado') return res.status(400).json({ mensaje: 'El comprobante ya está anulado' });
    asiento.estado = 'anulado';
    asiento.motivoAnulacion = req.body?.motivo || 'Anulado manualmente';
    await asiento.save();
    res.json({ mensaje: 'Comprobante anulado', asiento });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al anular comprobante', error: error.message });
  }
};

const getMovimientos = async (filtro = {}) => {
  const asientos = await Asiento.find({ ...filtro, estado: 'registrado' }).sort({ fecha: 1, numero: 1 });
  return asientos.flatMap((a) => (a.detalles || []).map((d) => ({
    asientoId: a._id,
    numero: a.numero,
    fecha: a.fecha,
    concepto: a.concepto,
    referencia: a.referencia,
    origen: a.origen,
    cuentaId: d.cuentaId,
    codigo: d.codigo,
    cuentaNombre: d.cuentaNombre,
    descripcion: d.descripcion,
    debe: Number(d.debe || 0),
    haber: Number(d.haber || 0),
  })));
};

const getCuentasT = async (req, res) => {
  try {
    const movimientos = await getMovimientos(parseRango(req.query));
    const mapa = new Map();
    for (const mov of movimientos) {
      const key = String(mov.cuentaId);
      if (!mapa.has(key)) {
        mapa.set(key, { cuentaId: key, codigo: mov.codigo, nombre: mov.cuentaNombre, debe: [], haber: [], totalDebe: 0, totalHaber: 0, saldo: 0 });
      }
      const cuenta = mapa.get(key);
      if (mov.debe > 0) {
        cuenta.debe.push(mov);
        cuenta.totalDebe += mov.debe;
      }
      if (mov.haber > 0) {
        cuenta.haber.push(mov);
        cuenta.totalHaber += mov.haber;
      }
      cuenta.totalDebe = round2(cuenta.totalDebe);
      cuenta.totalHaber = round2(cuenta.totalHaber);
      cuenta.saldo = round2(cuenta.totalDebe - cuenta.totalHaber);
    }
    res.json(Array.from(mapa.values()).sort((a, b) => a.codigo.localeCompare(b.codigo)));
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar cuentas T', error: error.message });
  }
};

const getEstadoCuenta = async (req, res) => {
  try {
    const cuentaId = req.params.cuentaId;
    const cuenta = mongoose.Types.ObjectId.isValid(cuentaId)
      ? await Cuenta.findById(cuentaId)
      : await Cuenta.findOne({ codigo: cuentaId });
    if (!cuenta) return res.status(404).json({ mensaje: 'Cuenta contable no encontrada' });

    const movimientos = (await getMovimientos(parseRango(req.query))).filter((m) => String(m.cuentaId) === String(cuenta._id));
    let saldo = 0;
    const detalle = movimientos.map((m) => {
      saldo = round2(saldo + m.debe - m.haber);
      return { ...m, saldo };
    });
    res.json({ cuenta, movimientos: detalle, saldoFinal: saldo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar estado de cuenta', error: error.message });
  }
};

const getBalanceGeneral = async (req, res) => {
  try {
    const cuentas = await Cuenta.find({ estado: true }).sort({ codigo: 1 });
    const movimientos = await getMovimientos(parseRango(req.query));
    const saldos = new Map();
    for (const m of movimientos) saldos.set(String(m.cuentaId), round2((saldos.get(String(m.cuentaId)) || 0) + m.debe - m.haber));

    const secciones = { activo: [], pasivo: [], patrimonio: [], ingreso: [], gasto: [], costo: [] };
    for (const cuenta of cuentas) {
      const saldoNatural = ['pasivo', 'patrimonio', 'ingreso'].includes(cuenta.tipo)
        ? round2(-(saldos.get(String(cuenta._id)) || 0))
        : round2(saldos.get(String(cuenta._id)) || 0);
      if (saldoNatural !== 0) secciones[cuenta.tipo].push({ cuentaId: cuenta._id, codigo: cuenta.codigo, nombre: cuenta.nombre, saldo: saldoNatural });
    }

    const total = (items) => round2(items.reduce((sum, x) => sum + Number(x.saldo || 0), 0));
    const totales = {
      activo: total(secciones.activo),
      pasivo: total(secciones.pasivo),
      patrimonio: total(secciones.patrimonio),
      ingreso: total(secciones.ingreso),
      gasto: total(secciones.gasto),
      costo: total(secciones.costo),
    };
    totales.resultado = round2(totales.ingreso - totales.gasto - totales.costo);
    totales.pasivoPatrimonioResultado = round2(totales.pasivo + totales.patrimonio + totales.resultado);
    totales.diferencia = round2(totales.activo - totales.pasivoPatrimonioResultado);

    res.json({ secciones, totales });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar balance general', error: error.message });
  }
};

const getAnexos = async (req, res) => {
  try {
    const movimientos = await getMovimientos(parseRango(req.query));
    const porOrigen = {};
    for (const m of movimientos) {
      const key = m.origen?.modulo || 'manual';
      porOrigen[key] ||= { modulo: key, debe: 0, haber: 0, cantidad: 0 };
      porOrigen[key].debe = round2(porOrigen[key].debe + m.debe);
      porOrigen[key].haber = round2(porOrigen[key].haber + m.haber);
      porOrigen[key].cantidad += 1;
    }
    res.json({ porOrigen: Object.values(porOrigen), movimientos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al generar anexos contables', error: error.message });
  }
};

module.exports = {
  getConfiguracion,
  updateConfiguracion,
  getCuentas,
  createCuenta,
  updateCuenta,
  getAsientos,
  createAsiento,
  anularAsiento,
  getCuentasT,
  getEstadoCuenta,
  getBalanceGeneral,
  getAnexos,
};
