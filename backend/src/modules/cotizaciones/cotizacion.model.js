const mongoose = require('mongoose');

const itemCotizacionSchema = new mongoose.Schema(
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

const cotizacionSchema = new mongoose.Schema(
  {
    numeroCotizacion: {
      type: String,
      unique: true,
    },
    cliente: {
      nombre: { type: String, default: 'Consumidor Final' },
      nit: { type: String, default: 'CF' },
      telefono: { type: String, default: '' },
      direccion: { type: String, default: '' },
    },
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      default: null,
    },
    productos: [itemCotizacionSchema],
    subtotal: { type: Number, required: true },
    descuento: { type: Number, default: 0 },
    total: { type: Number, required: true },
    estado: {
      type: String,
      enum: ['borrador', 'enviada', 'aprobada', 'convertida', 'vencida', 'cancelada'],
      default: 'borrador',
    },
    vigenciaDias: {
      type: Number,
      default: 15,
    },
    fechaVencimiento: {
      type: Date,
    },
    ventaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venta',
      default: null,
    },
    notas: {
      type: String,
      default: '',
      trim: true,
    },
    condiciones: {
      type: String,
      default: 'Precios sujetos a cambios sin previo aviso. Vigencia según fecha indicada.',
      trim: true,
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-generar número de cotización
cotizacionSchema.pre('save', async function (next) {
  if (!this.numeroCotizacion) {
    const count = await mongoose.model('Cotizacion').countDocuments();
    this.numeroCotizacion = `COT-${String(count + 1).padStart(6, '0')}`;
  }
  // Calcular fecha de vencimiento
  if (!this.fechaVencimiento) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + (this.vigenciaDias || 15));
    this.fechaVencimiento = fecha;
  }
  next();
});

module.exports = mongoose.model('Cotizacion', cotizacionSchema);
