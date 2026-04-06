const mongoose = require('mongoose');

const abonoSchema = new mongoose.Schema(
  {
    monto: { type: Number, required: true },
    fecha: { type: Date, default: Date.now },
    metodoPago: { type: String, enum: ['efectivo', 'transferencia', 'tarjeta'], default: 'efectivo' },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cajaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Caja', required: true },
    comprobante: { type: String, default: '' } // Referencia de transferencia o boucher
  },
  { _id: true, timestamps: true }
);

const creditoSchema = new mongoose.Schema(
  {
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      required: true,
    },
    ventaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venta',
      required: true,
    },
    montoTotal: {
      type: Number,
      required: true,
    },
    saldoPendiente: {
      type: Number,
      required: true,
    },
    fechaVencimiento: {
      type: Date,
      required: true,
    },
    estado: {
      type: String,
      enum: ['pendiente', 'pagado', 'vencido', 'anulado'],
      default: 'pendiente',
    },
    abonos: [abonoSchema],
    notas: { type: String, default: '' }
  },
  { timestamps: true }
);

// Middleware para actualizar saldoPendiente y estado automáticamente al modificar abonos
creditoSchema.pre('save', function(next) {
  const totalAbonado = this.abonos.reduce((sum, a) => sum + a.monto, 0);
  this.saldoPendiente = Math.max(0, this.montoTotal - totalAbonado);
  
  if (this.saldoPendiente <= 0) {
    this.estado = 'pagado';
  } else if (this.estado !== 'anulado') {
    // Verificar si está vencido
    if (new Date() > this.fechaVencimiento) {
      this.estado = 'vencido';
    } else {
      this.estado = 'pendiente';
    }
  }
  next();
});

module.exports = mongoose.model('Credito', creditoSchema);
