const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
      default: '',
    },
    codigo: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    precioCompra: {
      type: Number,
      required: [true, 'El precio de compra es requerido'],
      min: 0,
    },
    precioVenta: {
      type: Number,
      required: [true, 'El precio de venta es requerido'],
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    stockMinimo: {
      type: Number,
      default: 5,
    },
    controlaStock: {
      type: Boolean,
      default: true,
    },
    categoria: {
      type: String,
      trim: true,
      default: 'General',
    },
    proveedorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proveedor',
      default: null,
    },
    estado: {
      type: Boolean,
      default: true,
    },
    imagen: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Kardex — historial de movimientos de stock
const kardexSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: true,
    },
    tipo: {
      type: String,
      enum: ['entrada', 'salida', 'ajuste'],
      required: true,
    },
    cantidad: {
      type: Number,
      required: true,
    },
    stockAnterior: {
      type: Number,
      required: true,
    },
    stockNuevo: {
      type: Number,
      required: true,
    },
    motivo: {
      type: String,
      default: '',
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

const Producto = mongoose.model('Producto', productoSchema);
const Kardex = mongoose.model('Kardex', kardexSchema);

module.exports = { Producto, Kardex };
