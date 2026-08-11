const mongoose = require('mongoose');

const cuentaContableSchema = new mongoose.Schema(
  {
    codigo: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    tipo: {
      type: String,
      enum: ['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo'],
      required: true,
    },
    nivel: { type: Number, default: 1, min: 1 },
    cuentaPadre: { type: mongoose.Schema.Types.ObjectId, ref: 'CuentaContable', default: null },
    aceptaMovimientos: { type: Boolean, default: true },
    estado: { type: Boolean, default: true },
  },
  { timestamps: true }
);

cuentaContableSchema.index({ tipo: 1, codigo: 1 });

module.exports = mongoose.model('CuentaContable', cuentaContableSchema);
