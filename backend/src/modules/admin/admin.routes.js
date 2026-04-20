const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

// Todas las rutas de administración requieren estar autenticado y ser administrador
router.use(protect);
router.use(authorizeRoles('admin'));

// Endpoint para crear backup manual en el escritorio
router.post('/backup', adminController.crearBackupManual);

// Preview y restore desde carpeta con .bson/.json (mongodump)
router.post('/backup/preview', adminController.previewRestore);
router.post('/backup/restore', adminController.restoreFromFolder);

module.exports = router;
