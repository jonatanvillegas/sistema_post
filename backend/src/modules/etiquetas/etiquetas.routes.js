const express = require('express');
const router = express.Router();
const { getProductosEtiquetas, generarEtiquetas } = require('./etiquetas.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/productos', protect, authorizeRoles('admin', 'inventario'), getProductosEtiquetas);
router.post('/generar', protect, authorizeRoles('admin', 'inventario'), generarEtiquetas);

module.exports = router;
