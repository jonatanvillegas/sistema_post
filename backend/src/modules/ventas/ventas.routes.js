const express = require('express');
const router = express.Router();
const { getVentas, getVentaById, createVenta, anularVenta } = require('./ventas.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/', protect, getVentas);
router.get('/:id', protect, getVentaById);
router.post('/', protect, createVenta);
router.put('/:id/anular', protect, authorizeRoles('admin'), anularVenta);

module.exports = router;
