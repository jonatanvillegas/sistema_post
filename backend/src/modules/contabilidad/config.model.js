const mongoose = require('mongoose');

const integracionesSchema = new mongoose.Schema(
  {
    ventas: { type: Boolean, default: false },
    caja: { type: Boolean, default: false },
    inventario: { type: Boolean, default: false },
    creditos: { type: Boolean, default: false },
  },
  { _id: false }
);

const cuentasPorDefectoSchema = new mongoose.Schema(
  {
    caja: { type: String, default: '1101' },
    banco: { type: String, default: '1102' },
    cuentasPorCobrar: { type: String, default: '1103' },
    inventario: { type: String, default: '1104' },
    cuentasPorPagar: { type: String, default: '2101' },
    ventas: { type: String, default: '4101' },
    descuentosVentas: { type: String, default: '4102' },
    devolucionesVentas: { type: String, default: '4103' },
    ingresosVarios: { type: String, default: '4201' },
    gastosCaja: { type: String, default: '5101' },
    productosDanados: { type: String, default: '5102' },
    costoVentas: { type: String, default: '6101' },
  },
  { _id: false }
);

const configuracionContableSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'contabilidad', unique: true },
    activa: { type: Boolean, default: true },
    integraciones: { type: integracionesSchema, default: () => ({}) },
    cuentasPorDefecto: { type: cuentasPorDefectoSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ConfiguracionContable', configuracionContableSchema);
