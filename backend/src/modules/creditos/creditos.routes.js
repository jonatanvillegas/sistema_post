const express = require('express');
const router = express.Router();
const {
  getCreditosByCliente,
  registrarAbono,
  getCreditosPendientes,
  getCreditoDetalle,
  updateCreditoVentaProductos,
  getResumenCuentasCobrar,
  getEstadoCuentaCliente,
  getReporteMorosidad,
} = require('./creditos.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.use(protect);

// Cuentas por Cobrar (nuevos)
router.get('/cuentas-cobrar', authorizeRoles('admin'), getResumenCuentasCobrar);
router.get('/cuentas-cobrar/morosidad', authorizeRoles('admin'), getReporteMorosidad);
router.get('/cuentas-cobrar/cliente/:clienteId', authorizeRoles('admin'), getEstadoCuentaCliente);

// Existentes
router.get('/cliente/:clienteId', getCreditosByCliente);
router.post('/:id/abono', registrarAbono);
router.get('/:id/detalle', getCreditoDetalle);
router.put('/:id/venta', authorizeRoles('admin'), updateCreditoVentaProductos);
router.get('/pendientes', authorizeRoles('admin'), getCreditosPendientes);

module.exports = router;
