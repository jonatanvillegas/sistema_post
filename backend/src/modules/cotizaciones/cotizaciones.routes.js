const express = require('express');
const router = express.Router();
const {
  getCotizaciones,
  getCotizacionById,
  createCotizacion,
  updateCotizacion,
  cambiarEstado,
  convertirAVenta,
  deleteCotizacion,
  duplicarCotizacion,
  getEstadisticas,
} = require('./cotizaciones.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/estadisticas', protect, getEstadisticas);
router.get('/', protect, getCotizaciones);
router.get('/:id', protect, getCotizacionById);
router.post('/', protect, authorizeRoles('admin', 'cajero'), createCotizacion);
router.post('/:id/duplicar', protect, authorizeRoles('admin', 'cajero'), duplicarCotizacion);
router.put('/:id/estado', protect, authorizeRoles('admin', 'cajero'), cambiarEstado);
router.put('/:id/convertir', protect, authorizeRoles('admin', 'cajero'), convertirAVenta);
router.put('/:id', protect, authorizeRoles('admin', 'cajero'), updateCotizacion);
router.delete('/:id', protect, authorizeRoles('admin'), deleteCotizacion);

module.exports = router;
