const mongoose = require('mongoose');

const itemDevolucionSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
    },
    nombre: { type: String, required: true },
    codigo: { type: String, default: '' },
    cantidad: { type: Number, required: true, min: 1 },
    cantidadOriginal: { type: Number, required: true },
    precioUnitario: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    motivo: {
      type: String,
      enum: ['defectuoso', 'equivocado', 'garantia', 'insatisfecho', 'danado', 'otro'],
      default: 'otro',
    },
    motivoDetalle: { type: String, default: '' },
    estadoProducto: {
      type: String,
      enum: ['bueno', 'danado'],
      default: 'bueno',
    },
  },
  { _id: false }
);

const itemCambioSchema = new mongoose.Schema(
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
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const devolucionSchema = new mongoose.Schema(
  {
    numeroDevolucion: {
      type: String,
      unique: true,
    },
    ventaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Venta',
      required: true,
    },
    numeroVenta: {
      type: String,
      required: true,
    },
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente',
      default: null,
    },
    cliente: {
      nombre: { type: String, default: 'Consumidor Final' },
      nit: { type: String, default: 'CF' },
    },
    productos: [itemDevolucionSchema],
    productosCambio: [itemCambioSchema],
    totalDevolucion: {
      type: Number,
      required: true,
    },
    totalCambio: {
      type: Number,
      default: 0,
    },
    diferenciaMonto: {
      type: Number,
      default: 0,
    },
    diferenciaTipo: {
      type: String,
      enum: ['sin_diferencia', 'favor_cliente', 'favor_tienda'],
      default: 'sin_diferencia',
    },
    tipo: {
      type: String,
      enum: ['devolucion', 'garantia'],
      default: 'devolucion',
    },
    estado: {
      type: String,
      enum: ['pendiente', 'aprobada', 'rechazada', 'completada'],
      default: 'pendiente',
    },
    motivoGeneral: {
      type: String,
      default: '',
      trim: true,
    },
    reingresarStock: {
      type: Boolean,
      default: true,
    },
    stockReingresado: {
      type: Boolean,
      default: false,
    },
    stockDanadoRegistrado: {
      type: Boolean,
      default: false,
    },
    notaCredito: {
      numero: { type: String, default: '' },
      monto: { type: Number, default: 0 },
      generada: { type: Boolean, default: false },
    },
    ingresoCaja: {
      registrado: { type: Boolean, default: false },
      cajaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Caja',
        default: null,
      },
      monto: { type: Number, default: 0 },
      concepto: { type: String, default: '' },
    },
    garantia: {
      fechaInicioGarantia: { type: Date, default: null },
      fechaFinGarantia: { type: Date, default: null },
      descripcionProblema: { type: String, default: '' },
      resolucion: {
        type: String,
        enum: ['reemplazo', 'reparacion', 'reembolso', 'pendiente'],
        default: 'pendiente',
      },
    },
    observaciones: {
      type: String,
      default: '',
      trim: true,
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    aprobadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    fechaAprobacion: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

devolucionSchema.pre('save', async function (next) {
  if (!this.numeroDevolucion) {
    const count = await mongoose.model('Devolucion').countDocuments();
    const prefix = this.tipo === 'garantia' ? 'GAR' : 'DEV';
    this.numeroDevolucion = `${prefix}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Devolucion', devolucionSchema);
