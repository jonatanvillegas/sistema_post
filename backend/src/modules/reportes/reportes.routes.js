const express = require('express');
const router = express.Router();
const {
  getReporteUtilidades,
  getReporteProductos,
  getReporteComprasVsVentas,
  getReporteInventarioValorizado,
  getReporteMovimientosStock,
  getReporteClientesFrecuentes,
  getReporteDevoluciones,
} = require('./reportes.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/utilidades', protect, authorizeRoles('admin'), getReporteUtilidades);
router.get('/productos', protect, authorizeRoles('admin'), getReporteProductos);
router.get('/compras-ventas', protect, authorizeRoles('admin'), getReporteComprasVsVentas);
router.get('/inventario-valorizado', protect, authorizeRoles('admin', 'inventario'), getReporteInventarioValorizado);
router.get('/movimientos-stock', protect, authorizeRoles('admin', 'inventario'), getReporteMovimientosStock);
router.get('/clientes-frecuentes', protect, authorizeRoles('admin'), getReporteClientesFrecuentes);
router.get('/devoluciones', protect, authorizeRoles('admin'), getReporteDevoluciones);

module.exports = router;
