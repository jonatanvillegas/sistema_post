const express = require('express');
const router = express.Router();
const {
  getCreditosByCliente,
  registrarAbono,
  getCreditosPendientes,
} = require('./creditos.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.use(protect);

router.get('/cliente/:clienteId', getCreditosByCliente);
router.post('/:id/abono', registrarAbono);
router.get('/pendientes', authorizeRoles('admin'), getCreditosPendientes);

module.exports = router;
