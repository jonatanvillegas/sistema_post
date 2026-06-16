const express = require('express');
const router = express.Router();
const {
  getOrdenes,
  getOrdenById,
  createOrden,
  updateOrden,
  recibirMercaderia,
  cancelarOrden,
  deleteOrden,
} = require('./ordenesCompra.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/', protect, getOrdenes);
router.get('/:id', protect, getOrdenById);
router.post('/', protect, authorizeRoles('admin', 'inventario'), createOrden);
router.put('/:id/recibir', protect, authorizeRoles('admin', 'inventario'), recibirMercaderia);
router.put('/:id/cancelar', protect, authorizeRoles('admin'), cancelarOrden);
router.put('/:id', protect, authorizeRoles('admin', 'inventario'), updateOrden);
router.delete('/:id', protect, authorizeRoles('admin'), deleteOrden);

module.exports = router;
