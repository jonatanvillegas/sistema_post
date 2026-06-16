const express = require('express');
const router = express.Router();
const {
  getDevoluciones,
  getDevolucionById,
  getProductosVenta,
  createDevolucion,
  aprobarDevolucion,
  rechazarDevolucion,
  getEstadisticas,
} = require('./devoluciones.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/estadisticas', protect, getEstadisticas);
router.get('/venta/:ventaId', protect, getProductosVenta);
router.get('/', protect, getDevoluciones);
router.get('/:id', protect, getDevolucionById);
router.post('/', protect, authorizeRoles('admin', 'cajero'), createDevolucion);
router.put('/:id/aprobar', protect, authorizeRoles('admin'), aprobarDevolucion);
router.put('/:id/rechazar', protect, authorizeRoles('admin'), rechazarDevolucion);

module.exports = router;
