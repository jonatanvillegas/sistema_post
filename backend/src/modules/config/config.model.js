const mongoose = require('mongoose');

const configSchema = new mongoose.Schema(
  {
    tipoSistema: {
      type: String,
      enum: ['desktop', 'online'],
      default: 'desktop',
    },
    nombreEmpresa: {
      type: String,
      default: 'Mi Negocio POS',
    },
    // Otros ajustes globales que puedan ser útiles en el futuro
    permiteVentasSinStock: {
      type: Boolean,
      default: false,
    },
    mostrarImagenesProductos: {
      type: Boolean,
      default: true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Config', configSchema);
