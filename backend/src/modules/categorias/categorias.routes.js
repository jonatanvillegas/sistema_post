const express = require('express');
const router = express.Router();

const {
  getCategorias,
  createCategoria,
  updateCategoria,
  deleteCategoria,
} = require('./categorias.controller');

const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.use(protect);

// Listado para roles que gestionan inventario
router.get('/', authorizeRoles('admin', 'inventario'), getCategorias);

// Admin gestiona catálogo
router.post('/', authorizeRoles('admin'), createCategoria);
router.put('/:id', authorizeRoles('admin'), updateCategoria);
router.delete('/:id', authorizeRoles('admin'), deleteCategoria);

module.exports = router;
