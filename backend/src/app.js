const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

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
const categoriasRoutes = require('./modules/categorias/categorias.routes');
const devolucionesRoutes = require('./modules/devoluciones/devoluciones.routes');
const contabilidadRoutes = require('./modules/contabilidad/contabilidad.routes');

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
app.use('/api/categorias', categoriasRoutes);
app.use('/api/devoluciones', devolucionesRoutes);
app.use('/api/contabilidad', contabilidadRoutes);

// Servir frontend (build Vite) si existe.
// Esto permite desplegar en un solo servicio (Coolify) con UI + API en el mismo dominio.
const frontDistPath = process.env.FRONT_DIST_PATH
  ? path.resolve(process.env.FRONT_DIST_PATH)
  : path.join(__dirname, '..', '..', 'front', 'sistema-pos-front', 'dist');
const frontIndexPath = path.join(frontDistPath, 'index.html');
const hasFrontend = fs.existsSync(frontIndexPath);

if (hasFrontend) {
  app.use(express.static(frontDistPath));

  // Fallback SPA: cualquier ruta que NO sea /api/* sirve index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(frontIndexPath);
  });
}

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
