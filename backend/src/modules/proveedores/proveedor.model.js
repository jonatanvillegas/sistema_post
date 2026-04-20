const mongoose = require('mongoose');

const proveedorSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del proveedor es requerido'],
      trim: true,
    },
    telefono: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    direccion: { type: String, trim: true, default: '' },
    nit: { type: String, trim: true, default: '' },
    contacto: { type: String, trim: true, default: '' }, // Nombre del contacto
    estado: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Registro de compras a proveedor
const compraSchema = new mongoose.Schema(
  {
    proveedorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Proveedor',
      required: true,
    },
    productos: [
      {
        productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
        nombre: String,
        cantidad: Number,
        precioUnitario: Number,
        subtotal: Number,
      },
    ],
    total: { type: Number, required: true },
    numeroFactura: { type: String, default: '' },
    fecha: { type: Date, default: Date.now },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    observaciones: { type: String, default: '' },

    // Caja: egreso registrado por esta compra (si existía caja abierta)
    cajaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Caja', default: null },
    egresoId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

const Proveedor = mongoose.model('Proveedor', proveedorSchema);
const Compra = mongoose.model('Compra', compraSchema);

module.exports = { Proveedor, Compra };
