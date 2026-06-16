const mongoose = require('mongoose');

const itemOrdenSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
    },
    nombre: { type: String, required: true },
    codigo: { type: String, default: '' },
    cantidadSolicitada: { type: Number, required: true, min: 1 },
    cantidadRecibida: { type: Number, default: 0 },
    precioUnitario: { type: Number, required: true },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const recepcionSchema = new mongoose.Schema(
  {
    fecha: { type: Date, default: Date.now },
    productos: [
      {
        productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
        nombre: { type: String },
        cantidadRecibida: { type: Number, required: true },
      },
    ],
    observaciones: { type: String, default: '' },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { _id: true }
);

const ordenCompraSchema = new mongoose.Schema(
  {
    numeroOrden: {
      type: String,
      unique: true,
    },
    proveedorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proveedor',
      required: true,
    },
    proveedor: {
      nombre: { type: String, required: true },
      telefono: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    productos: [itemOrdenSchema],
    subtotal: { type: Number, required: true },
    impuestos: { type: Number, default: 0 },
    descuento: { type: Number, default: 0 },
    total: { type: Number, required: true },
    estado: {
      type: String,
      enum: ['borrador', 'enviada', 'parcial', 'recibida', 'cancelada'],
      default: 'borrador',
    },
    fechaEstimadaEntrega: {
      type: Date,
      default: null,
    },
    recepciones: [recepcionSchema],
    notas: {
      type: String,
      default: '',
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

// Auto-generar número de orden
ordenCompraSchema.pre('save', async function (next) {
  if (!this.numeroOrden) {
    const count = await mongoose.model('OrdenCompra').countDocuments();
    this.numeroOrden = `OC-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('OrdenCompra', ordenCompraSchema);
