const express = require('express');
const router = express.Router();
const {
  getProductos,
  getStockBajo,
  getProductoById,
  darBajaStockDanado,
  createProducto,
  updateProducto,
  deleteProducto,
  getKardex,
  importInventarioMasivo,
  descargarPlantillaImportInventario,
  exportInventarioExcel,
} = require('./inventario.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/stock-bajo', protect, getStockBajo);
router.get('/kardex/:id', protect, getKardex);
router.get('/export/excel', protect, authorizeRoles('admin', 'inventario'), exportInventarioExcel);
router.get('/import/plantilla', protect, authorizeRoles('admin', 'inventario'), descargarPlantillaImportInventario);
router.post('/import', protect, authorizeRoles('admin', 'inventario'), importInventarioMasivo);
router.get('/', protect, getProductos);
router.get('/:id', protect, getProductoById);
router.put('/:id/dar-baja-danado', protect, authorizeRoles('admin'), darBajaStockDanado);
router.post('/', protect, authorizeRoles('admin', 'inventario'), createProducto);
router.put('/:id', protect, authorizeRoles('admin', 'inventario'), updateProducto);
router.delete('/:id', protect, authorizeRoles('admin'), deleteProducto);

module.exports = router;
