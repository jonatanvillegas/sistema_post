const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre completo es requerido'],
      trim: true,
    },
    nit: {
      type: String,
      required: [true, 'El NIT o Cédula es requerido'],
      unique: true,
      trim: true,
    },
    telefono: {
      type: String,
      trim: true,
      default: '',
    },
    direccion: {
      type: String,
      trim: true,
      default: '',
    },
    limiteCredito: {
      type: Number,
      default: 0, // 0 significa que no tiene crédito habilitado
    },
    saldoActual: {
      type: Number,
      default: 0, // Sumatoria de deudas pendientes
    },
    estado: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cliente', clienteSchema);
