const express = require('express');
const router = express.Router();
const { getResumen, getVentasDashboard, getInventarioDashboard } = require('./dashboard.controller');
const { protect } = require('../../middlewares/auth.middleware');

router.get('/resumen', protect, getResumen);
router.get('/ventas', protect, getVentasDashboard);
router.get('/inventario', protect, getInventarioDashboard);

module.exports = router;
