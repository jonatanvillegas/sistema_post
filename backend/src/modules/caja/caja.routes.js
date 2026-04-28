const express = require('express');
const router = express.Router();
const {
  abrirCaja,
  cerrarCaja,
  getCajaActual,
  registrarEgreso,
  getHistorialCaja,
  getCajaById,
  exportTransaccionesCaja,
} = require('./caja.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.post('/abrir', protect, abrirCaja);
router.put('/cerrar/:id', protect, cerrarCaja);
router.get('/actual', protect, getCajaActual);
router.post('/egreso', protect, registrarEgreso);
router.get('/transacciones/export', protect, authorizeRoles('admin', 'cajero'), exportTransaccionesCaja);
router.get('/historial', protect, authorizeRoles('admin', 'cajero'), getHistorialCaja);
router.get('/:id', protect, getCajaById);

module.exports = router;
