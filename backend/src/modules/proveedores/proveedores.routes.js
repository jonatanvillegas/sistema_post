const express = require('express');
const router = express.Router();
const {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  getComprasProveedor,
  registrarCompra,
} = require('./proveedor.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/', protect, getProveedores);
router.get('/:id', protect, getProveedorById);
router.get('/:id/compras', protect, getComprasProveedor);
router.post('/', protect, authorizeRoles('admin', 'cajero'), createProveedor);
router.post('/compras', protect, authorizeRoles('admin', 'cajero'), registrarCompra);
router.put('/:id', protect, authorizeRoles('admin', 'cajero'), updateProveedor);
router.delete('/:id', protect, authorizeRoles('admin'), deleteProveedor);

module.exports = router;
