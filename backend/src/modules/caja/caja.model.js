const mongoose = require('mongoose');

// 1. Esquema de Billetaje para el Arqueo
const billetajeSchema = new mongoose.Schema(
  {
    denominacion: { type: Number, required: true },
    cantidad: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    tipo: { type: String, enum: ['billete', 'moneda'], required: true },
    moneda: { type: String, enum: ['NIO', 'USD'], required: true, default: 'NIO' }
  },
  { _id: false, versionKey: false }
);

// 2. Esquema de Movimientos (Ventas, Ingresos, Egresos)
const movimientoCajaSchema = new mongoose.Schema(
  {
    concepto: { type: String, required: true },
    monto: { type: Number, required: true },
    tipo: { type: String, enum: ['venta', 'venta_credito', 'ingreso_manual', 'egreso'], default: 'ingreso_manual' },
    ventaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Venta', default: null },
    fecha: { type: Date, default: Date.now }
  },
  { _id: true, timestamps: true }
);

// 3. Esquema Principal de Caja
const cajaSchema = new mongoose.Schema(
  {
    fechaApertura: { type: Date, default: Date.now },
    fechaCierre: { type: Date, default: null },
    montoInicial: { type: Number, required: true, min: 0 },
    montoFinal: { type: Number, default: null },
    totalVentas: { type: Number, default: 0 },
    totalIngresos: { type: Number, default: 0 },
    totalEgresos: { type: Number, default: 0 },
    diferencia: { type: Number, default: null },
    tipoCambio: { type: Number, default: 36.6 },
    estado: { type: String, enum: ['abierta', 'cerrada'], default: 'abierta' },
    ingresos: [movimientoCajaSchema],
    egresos: [movimientoCajaSchema],
    billetaje: [billetajeSchema], // Campo Crítico del Arqueo
    observaciones: { type: String, default: '' },
    usuarioApertura: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    usuarioCierre: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

// HOOK DE DIAGNÓSTICO (PRE-SAVE)
cajaSchema.pre('save', function(next) {
  if (this.billetaje && this.billetaje.length > 0) {
    console.log('--- DEBUG PRE-SAVE BILLETAGE ---');
    this.billetaje.forEach((b, i) => {
      console.log(`Billetaje[${i}]: Denom=${b.denominacion}, Cant=${b.cantidad}, Moneda=${b.moneda}`);
    });
  }
  next();
});

module.exports = mongoose.model('Caja', cajaSchema);
