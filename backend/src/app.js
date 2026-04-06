const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Rutas
const authRoutes = require('./modules/auth/auth.routes');
const inventarioRoutes = require('./modules/inventario/inventario.routes');
const ventasRoutes = require('./modules/ventas/ventas.routes');
const cajaRoutes = require('./modules/caja/caja.routes');
const proveedoresRoutes = require('./modules/proveedores/proveedores.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');
const clientesRoutes = require('./modules/clientes/clientes.routes');
const creditosRoutes = require('./modules/creditos/creditos.routes');
const adminRoutes = require('./modules/admin/admin.routes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '🚀 Sistema POS API funcionando' });
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/creditos', creditosRoutes);
app.use('/api/admin', adminRoutes);

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Manejo global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    mensaje: err.message || 'Error interno del servidor',
  });
});

module.exports = app;
