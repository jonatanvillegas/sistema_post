const mongoose = require('mongoose');

const itemVentaSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
    },
    nombre: { type: String, required: true },
    codigo: { type: String, default: '' },
    cantidad: { type: Number, required: true, min: 1 },
    precioUnitario: { type: Number, required: true },
    subtotalBruto: { type: Number, default: 0 },
    descuentoTipo: {
      type: String,
      enum: ['ninguno', 'monto', 'porcentaje'],
      default: 'ninguno',
    },
    descuentoValor: { type: Number, default: 0 },
    descuentoMonto: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const ventaSchema = new mongoose.Schema(
  {
    numeroVenta: {
      type: String,
      unique: true,
    },
    cliente: {
      nombre: { type: String, default: 'Consumidor Final' },
      nit: { type: String, default: 'CF' },
    },
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      default: null,
    },
    productos: [itemVentaSchema],
    // subtotal = subtotal bruto (antes de cualquier descuento)
    subtotal: { type: Number, required: true },
    // descuento = descuento total (líneas + descuento general)
    descuento: { type: Number, default: 0 },
    total: { type: Number, required: true },

    // Desglose opcional (para reportes/auditoría)
    descuentoLineas: { type: Number, default: 0 },
    descuentoGeneralTipo: {
      type: String,
      enum: ['ninguno', 'monto', 'porcentaje'],
      default: 'ninguno',
    },
    descuentoGeneralValor: { type: Number, default: 0 },
    descuentoGeneralMonto: { type: Number, default: 0 },
    metodoPago: {
      type: String,
      enum: ['efectivo', 'tarjeta', 'transferencia', 'mixto', 'credito'],
      default: 'efectivo',
    },
    montoRecibido: { type: Number, default: 0 },
    vuelto: { type: Number, default: 0 },
    estado: {
      type: String,
      enum: ['completada', 'anulada'],
      default: 'completada',
    },
    motivoAnulacion: { type: String, default: '' },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cajaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caja',
      default: null,
    },
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Auto-generar número de venta
ventaSchema.pre('save', async function (next) {
  if (!this.numeroVenta) {
    const count = await mongoose.model('Venta').countDocuments();
    this.numeroVenta = `VTA-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Venta', ventaSchema);
