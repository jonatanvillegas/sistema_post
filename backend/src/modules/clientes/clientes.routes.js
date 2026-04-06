const express = require('express');
const router = express.Router();
const {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
} = require('./clientes.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.use(protect);

router.get('/', getClientes);
router.get('/:id', getClienteById);
router.post('/', createCliente); // Ambos roles pueden crear clientes
router.put('/:id', updateCliente);
router.delete('/:id', authorizeRoles('admin'), deleteCliente); // Solo el admin puede desactivar clientes

module.exports = router;
