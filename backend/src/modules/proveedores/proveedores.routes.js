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
  getCompraById,
  updateCompra,
  deleteCompra,
} = require('./proveedor.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/', protect, getProveedores);
router.get('/compras/:id', protect, getCompraById);
router.get('/:id', protect, getProveedorById);
router.get('/:id/compras', protect, getComprasProveedor);
router.post('/', protect, authorizeRoles('admin', 'inventario'), createProveedor);
router.post('/compras', protect, authorizeRoles('admin', 'inventario'), registrarCompra);
router.put('/compras/:id', protect, authorizeRoles('admin', 'inventario'), updateCompra);
router.put('/:id', protect, authorizeRoles('admin', 'inventario'), updateProveedor);
router.delete('/compras/:id', protect, authorizeRoles('admin', 'inventario'), deleteCompra);
router.delete('/:id', protect, authorizeRoles('admin'), deleteProveedor);

module.exports = router;
