const Cuenta = require('./cuenta.model');
const Asiento = require('./asiento.model');
const Config = require('./config.model');
const { Producto } = require('../inventario/producto.model');

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

const cuentasIniciales = [
  { codigo: '1101', nombre: 'Caja', tipo: 'activo' },
  { codigo: '1102', nombre: 'Banco', tipo: 'activo' },
  { codigo: '1103', nombre: 'Cuentas por cobrar', tipo: 'activo' },
  { codigo: '1104', nombre: 'Inventario', tipo: 'activo' },
  { codigo: '2101', nombre: 'Cuentas por pagar', tipo: 'pasivo' },
  { codigo: '3101', nombre: 'Capital', tipo: 'patrimonio' },
  { codigo: '4101', nombre: 'Ingresos por ventas', tipo: 'ingreso' },
  { codigo: '4102', nombre: 'Descuentos sobre ventas', tipo: 'ingreso' },
  { codigo: '4103', nombre: 'Devoluciones sobre ventas', tipo: 'ingreso' },
  { codigo: '4201', nombre: 'Ingresos varios', tipo: 'ingreso' },
  { codigo: '5101', nombre: 'Gastos generales', tipo: 'gasto' },
  { codigo: '5102', nombre: 'Pérdida por productos dañados', tipo: 'gasto' },
  { codigo: '6101', nombre: 'Costo de ventas', tipo: 'costo' },
];

const integracionesDefault = {
  ventas: false,
  caja: false,
  inventario: false,
  creditos: false,
};

const cuentasPorDefectoDefault = {
  caja: '1101',
  banco: '1102',
  cuentasPorCobrar: '1103',
  inventario: '1104',
  cuentasPorPagar: '2101',
  ventas: '4101',
  descuentosVentas: '4102',
  devolucionesVentas: '4103',
  ingresosVarios: '4201',
  gastosCaja: '5101',
  productosDanados: '5102',
  costoVentas: '6101',
};

const getConfig = async () => {
  let config = await Config.findOne({ singleton: 'contabilidad' });
  if (!config) config = await Config.create({ singleton: 'contabilidad' });
  const integraciones = config.integraciones?.toObject?.() || {};
  const cuentasPorDefecto = config.cuentasPorDefecto?.toObject?.() || {};
  config.integraciones = { ...integracionesDefault, ...integraciones };
  config.cuentasPorDefecto = { ...cuentasPorDefectoDefault, ...cuentasPorDefecto };
  await config.save();
  return config;
};

const seedCuentasIniciales = async () => {
  for (const cuenta of cuentasIniciales) {
    await Cuenta.updateOne({ codigo: cuenta.codigo }, { $setOnInsert: cuenta }, { upsert: true });
  }
};

const getCuentaByCodigo = async (codigo) => {
  const cuenta = await Cuenta.findOne({ codigo, estado: true });
  if (!cuenta) throw new Error(`Cuenta contable no encontrada o inactiva: ${codigo}`);
  return cuenta;
};

const normalizarDetalles = async (detalles = []) => {
  const normalizados = [];
  for (const item of detalles) {
    const cuenta = item.cuentaId
      ? await Cuenta.findById(item.cuentaId)
      : await Cuenta.findOne({ codigo: item.codigo });

    if (!cuenta || !cuenta.estado) throw new Error(`Cuenta inválida: ${item.codigo || item.cuentaId}`);
    if (!cuenta.aceptaMovimientos) throw new Error(`La cuenta ${cuenta.codigo} no acepta movimientos`);

    const debe = round2(item.debe || 0);
    const haber = round2(item.haber || 0);
    if (debe < 0 || haber < 0 || (debe === 0 && haber === 0) || (debe > 0 && haber > 0)) {
      throw new Error(`Movimiento inválido en cuenta ${cuenta.codigo}`);
    }

    normalizados.push({
      cuentaId: cuenta._id,
      codigo: cuenta.codigo,
      cuentaNombre: cuenta.nombre,
      descripcion: item.descripcion || '',
      debe,
      haber,
    });
  }
  return normalizados;
};

const crearAsiento = async ({ fecha, concepto, referencia, origen, detalles, usuarioId }) => {
  const detallesNormalizados = await normalizarDetalles(detalles);
  return Asiento.create({
    fecha: fecha || new Date(),
    concepto,
    referencia,
    origen: origen || { modulo: 'manual' },
    detalles: detallesNormalizados,
    usuarioId,
  });
};

const crearAsientoVentaSiActivo = async (venta, usuarioId) => {
  const config = await getConfig();
  if (!config.activa || !config.integraciones?.ventas) return null;

  const existente = await Asiento.findOne({
    'origen.modulo': 'ventas',
    'origen.documentoId': venta._id,
    estado: 'registrado',
  });
  if (existente) return existente;

  const cuentas = config.cuentasPorDefecto || {};
  const cuentaDebitoCodigo = venta.metodoPago === 'credito'
    ? cuentas.cuentasPorCobrar
    : venta.metodoPago === 'transferencia' || venta.metodoPago === 'tarjeta'
      ? cuentas.banco
      : cuentas.caja;

  const cuentaDebito = await getCuentaByCodigo(cuentaDebitoCodigo);
  const cuentaVentas = await getCuentaByCodigo(cuentas.ventas);
  const detalles = [
    { cuentaId: cuentaDebito._id, debe: venta.total, haber: 0, descripcion: venta.metodoPago },
    { cuentaId: cuentaVentas._id, debe: 0, haber: venta.total, descripcion: 'Venta' },
  ];

  if (config.integraciones?.inventario) {
    let costoTotal = 0;
    for (const item of venta.productos || []) {
      const producto = await Producto.findById(item.productoId).select('precioCompra controlaStock');
      if (producto?.controlaStock !== false) {
        costoTotal += Number(producto.precioCompra || 0) * Number(item.cantidad || 0);
      }
    }

    costoTotal = round2(costoTotal);
    if (costoTotal > 0) {
      const cuentaCosto = await getCuentaByCodigo(cuentas.costoVentas);
      const cuentaInventario = await getCuentaByCodigo(cuentas.inventario);
      detalles.push(
        { cuentaId: cuentaCosto._id, debe: costoTotal, haber: 0, descripcion: 'Costo de venta' },
        { cuentaId: cuentaInventario._id, debe: 0, haber: costoTotal, descripcion: 'Salida de inventario por venta' }
      );
    }
  }

  return crearAsiento({
    fecha: venta.fecha || new Date(),
    concepto: `Venta ${venta.numeroVenta}`,
    referencia: venta.numeroVenta,
    origen: { modulo: 'ventas', documentoId: venta._id, documentoNumero: venta.numeroVenta },
    detalles,
    usuarioId,
  });
};

const crearAsientoIngresoCajaSiActivo = async ({ movimiento, cajaId, usuarioId }) => {
  const config = await getConfig();
  if (!config.activa || !config.integraciones?.caja) return null;

  const cuentas = config.cuentasPorDefecto || {};
  const cuentaCaja = await getCuentaByCodigo(cuentas.caja);
  const cuentaIngreso = await getCuentaByCodigo(cuentas.ingresosVarios);
  const docId = movimiento?._id || cajaId;

  const existente = await Asiento.findOne({ 'origen.modulo': 'caja', 'origen.documentoId': docId, estado: 'registrado' });
  if (existente) return existente;

  return crearAsiento({
    fecha: movimiento?.fecha || new Date(),
    concepto: movimiento?.concepto || 'Ingreso de caja',
    referencia: `CAJA-${String(cajaId).slice(-6)}`,
    origen: { modulo: 'caja', documentoId: docId, documentoNumero: 'ingreso' },
    detalles: [
      { cuentaId: cuentaCaja._id, debe: movimiento.monto, haber: 0, descripcion: 'Ingreso de caja' },
      { cuentaId: cuentaIngreso._id, debe: 0, haber: movimiento.monto, descripcion: movimiento?.tipo || 'ingreso' },
    ],
    usuarioId,
  });
};

const crearAsientoEgresoCajaSiActivo = async ({ movimiento, cajaId, usuarioId }) => {
  const config = await getConfig();
  if (!config.activa || !config.integraciones?.caja) return null;

  const cuentas = config.cuentasPorDefecto || {};
  const cuentaGasto = await getCuentaByCodigo(cuentas.gastosCaja);
  const cuentaCaja = await getCuentaByCodigo(cuentas.caja);
  const docId = movimiento?._id || cajaId;

  const existente = await Asiento.findOne({ 'origen.modulo': 'caja', 'origen.documentoId': docId, estado: 'registrado' });
  if (existente) return existente;

  return crearAsiento({
    fecha: movimiento?.fecha || new Date(),
    concepto: movimiento?.concepto || 'Egreso de caja',
    referencia: `CAJA-${String(cajaId).slice(-6)}`,
    origen: { modulo: 'caja', documentoId: docId, documentoNumero: 'egreso' },
    detalles: [
      { cuentaId: cuentaGasto._id, debe: movimiento.monto, haber: 0, descripcion: movimiento?.tipo || 'egreso' },
      { cuentaId: cuentaCaja._id, debe: 0, haber: movimiento.monto, descripcion: 'Salida de caja' },
    ],
    usuarioId,
  });
};

const crearAsientoInventarioSiActivo = async ({ producto, kardex, usuarioId }) => {
  const config = await getConfig();
  if (!config.activa || !config.integraciones?.inventario) return null;

  const cantidad = Number(kardex?.cantidad || 0);
  const costoUnitario = Number(producto?.precioCompra || 0);
  const monto = round2(cantidad * costoUnitario);
  if (monto <= 0) return null;

  const cuentas = config.cuentasPorDefecto || {};
  const cuentaInventario = await getCuentaByCodigo(cuentas.inventario);
  const cuentaContrapartida = kardex?.tipo === 'entrada'
    ? await getCuentaByCodigo(cuentas.cuentasPorPagar || '2101')
    : await getCuentaByCodigo(cuentas.productosDanados);

  const existente = await Asiento.findOne({ 'origen.modulo': 'inventario', 'origen.documentoId': kardex._id, estado: 'registrado' });
  if (existente) return existente;

  const esEntrada = kardex?.tipo === 'entrada';
  return crearAsiento({
    fecha: kardex?.createdAt || new Date(),
    concepto: `${kardex?.motivo || 'Movimiento de inventario'} - ${producto?.nombre || ''}`.trim(),
    referencia: producto?.codigo || String(producto?._id || ''),
    origen: { modulo: 'inventario', documentoId: kardex._id, documentoNumero: kardex?.tipo || 'movimiento' },
    detalles: esEntrada
      ? [
          { cuentaId: cuentaInventario._id, debe: monto, haber: 0, descripcion: 'Entrada de inventario' },
          { cuentaId: cuentaContrapartida._id, debe: 0, haber: monto, descripcion: 'Contrapartida inventario' },
        ]
      : [
          { cuentaId: cuentaContrapartida._id, debe: monto, haber: 0, descripcion: 'Baja/ajuste de inventario' },
          { cuentaId: cuentaInventario._id, debe: 0, haber: monto, descripcion: 'Salida de inventario' },
        ],
    usuarioId,
  });
};

const crearAsientoAbonoCreditoSiActivo = async ({ credito, abono, usuarioId }) => {
  const config = await getConfig();
  if (!config.activa || !config.integraciones?.creditos) return null;

  const cuentas = config.cuentasPorDefecto || {};
  const cuentaDebitoCodigo = abono?.metodoPago === 'transferencia' || abono?.metodoPago === 'tarjeta'
    ? cuentas.banco
    : cuentas.caja;
  const cuentaDebito = await getCuentaByCodigo(cuentaDebitoCodigo);
  const cuentaCxC = await getCuentaByCodigo(cuentas.cuentasPorCobrar);
  const docId = abono?._id || credito._id;

  const existente = await Asiento.findOne({ 'origen.modulo': 'creditos', 'origen.documentoId': docId, estado: 'registrado' });
  if (existente) return existente;

  return crearAsiento({
    fecha: abono?.fecha || new Date(),
    concepto: `Abono a crédito ${credito?._id ? String(credito._id).slice(-6) : ''}`,
    referencia: abono?.comprobante || '',
    origen: { modulo: 'creditos', documentoId: docId, documentoNumero: abono?.comprobante || 'abono' },
    detalles: [
      { cuentaId: cuentaDebito._id, debe: abono.monto, haber: 0, descripcion: abono?.metodoPago || 'pago' },
      { cuentaId: cuentaCxC._id, debe: 0, haber: abono.monto, descripcion: 'Disminución de cuenta por cobrar' },
    ],
    usuarioId,
  });
};

const crearAsientoDevolucionSiActivo = async ({ devolucion, usuarioId }) => {
  const config = await getConfig();
  if (!config.activa || !config.integraciones?.ventas) return null;

  const existente = await Asiento.findOne({ 'origen.modulo': 'devoluciones', 'origen.documentoId': devolucion._id, estado: 'registrado' });
  if (existente) return existente;

  const cuentas = config.cuentasPorDefecto || {};
  const cuentaDevVentas = await getCuentaByCodigo(cuentas.devolucionesVentas);
  const cuentaCaja = await getCuentaByCodigo(cuentas.caja);
  const cuentaInventario = await getCuentaByCodigo(cuentas.inventario);
  const cuentaCosto = await getCuentaByCodigo(cuentas.costoVentas);
  const detalles = [];

  const totalDevolucion = round2(devolucion.totalDevolucion || 0);
  const totalCambio = round2(devolucion.totalCambio || 0);
  const diferencia = round2(devolucion.diferenciaMonto || 0);

  if (totalDevolucion > 0) {
    detalles.push({ cuentaId: cuentaDevVentas._id, debe: totalDevolucion, haber: 0, descripcion: 'Devolución de venta' });
  }

  if (totalCambio > 0) {
    const cuentaVentas = await getCuentaByCodigo(cuentas.ventas);
    detalles.push({ cuentaId: cuentaVentas._id, debe: 0, haber: totalCambio, descripcion: 'Producto entregado en cambio' });
  }

  if (diferencia > 0) {
    detalles.push({ cuentaId: cuentaCaja._id, debe: 0, haber: diferencia, descripcion: 'Saldo a favor del cliente / nota crédito' });
  } else if (diferencia < 0) {
    detalles.push({ cuentaId: cuentaCaja._id, debe: Math.abs(diferencia), haber: 0, descripcion: 'Diferencia cobrada al cliente' });
  }

  if (config.integraciones?.inventario) {
    let costoDevuelto = 0;
    for (const item of devolucion.productos || []) {
      const producto = await Producto.findById(item.productoId).select('precioCompra controlaStock');
      if (producto?.controlaStock !== false) costoDevuelto += Number(producto.precioCompra || 0) * Number(item.cantidad || 0);
    }
    costoDevuelto = round2(costoDevuelto);
    if (costoDevuelto > 0) {
      detalles.push(
        { cuentaId: cuentaInventario._id, debe: costoDevuelto, haber: 0, descripcion: 'Reingreso inventario por devolución' },
        { cuentaId: cuentaCosto._id, debe: 0, haber: costoDevuelto, descripcion: 'Reverso costo de venta' }
      );
    }

    let costoCambio = 0;
    for (const item of devolucion.productosCambio || []) {
      const producto = await Producto.findById(item.productoId).select('precioCompra controlaStock');
      if (producto?.controlaStock !== false) costoCambio += Number(producto.precioCompra || 0) * Number(item.cantidad || 0);
    }
    costoCambio = round2(costoCambio);
    if (costoCambio > 0) {
      detalles.push(
        { cuentaId: cuentaCosto._id, debe: costoCambio, haber: 0, descripcion: 'Costo producto entregado en cambio' },
        { cuentaId: cuentaInventario._id, debe: 0, haber: costoCambio, descripcion: 'Salida inventario por cambio' }
      );
    }
  }

  if (detalles.length < 2) return null;
  return crearAsiento({
    fecha: devolucion.fechaAprobacion || new Date(),
    concepto: `Devolución ${devolucion.numeroDevolucion}`,
    referencia: devolucion.numeroVenta,
    origen: { modulo: 'devoluciones', documentoId: devolucion._id, documentoNumero: devolucion.numeroDevolucion },
    detalles,
    usuarioId,
  });
};

const anularAsientoPorOrigen = async ({ modulo, documentoId, motivo }) => {
  return Asiento.updateMany(
    { 'origen.modulo': modulo, 'origen.documentoId': documentoId, estado: 'registrado' },
    { estado: 'anulado', motivoAnulacion: motivo || 'Documento origen anulado' }
  );
};

module.exports = {
  round2,
  getConfig,
  seedCuentasIniciales,
  crearAsiento,
  crearAsientoVentaSiActivo,
  crearAsientoIngresoCajaSiActivo,
  crearAsientoEgresoCajaSiActivo,
  crearAsientoInventarioSiActivo,
  crearAsientoAbonoCreditoSiActivo,
  crearAsientoDevolucionSiActivo,
  anularAsientoPorOrigen,
};
