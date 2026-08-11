const mongoose = require('mongoose');

const detalleAsientoSchema = new mongoose.Schema(
  {
    cuentaId: { type: mongoose.Schema.Types.ObjectId, ref: 'CuentaContable', required: true },
    codigo: { type: String, required: true },
    cuentaNombre: { type: String, required: true },
    descripcion: { type: String, default: '' },
    debe: { type: Number, default: 0, min: 0 },
    haber: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const asientoContableSchema = new mongoose.Schema(
  {
    numero: { type: String, unique: true },
    fecha: { type: Date, default: Date.now, index: true },
    concepto: { type: String, required: true, trim: true },
    referencia: { type: String, default: '', trim: true },
    origen: {
      modulo: { type: String, default: 'manual' },
      documentoId: { type: mongoose.Schema.Types.ObjectId, default: null },
      documentoNumero: { type: String, default: '' },
    },
    detalles: {
      type: [detalleAsientoSchema],
      validate: [(v) => Array.isArray(v) && v.length >= 2, 'El asiento debe tener al menos dos líneas'],
    },
    totalDebe: { type: Number, default: 0 },
    totalHaber: { type: Number, default: 0 },
    estado: { type: String, enum: ['registrado', 'anulado'], default: 'registrado', index: true },
    motivoAnulacion: { type: String, default: '' },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

asientoContableSchema.index({ 'origen.modulo': 1, 'origen.documentoId': 1 }, { sparse: true });

asientoContableSchema.pre('save', async function (next) {
  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  this.totalDebe = round2((this.detalles || []).reduce((sum, d) => sum + Number(d.debe || 0), 0));
  this.totalHaber = round2((this.detalles || []).reduce((sum, d) => sum + Number(d.haber || 0), 0));

  if (Math.abs(this.totalDebe - this.totalHaber) > 0.01) {
    return next(new Error('El comprobante no cuadra: el Debe debe ser igual al Haber'));
  }

  if (!this.numero) {
    const count = await mongoose.model('AsientoContable').countDocuments();
    this.numero = `CD-${String(count + 1).padStart(6, '0')}`;
  }

  next();
});

module.exports = mongoose.model('AsientoContable', asientoContableSchema);
