const express = require('express');
const router = express.Router();
const { login, register, getMe, getUsuarios, updateUsuario, deleteUsuario } = require('./auth.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.post('/login', login);
router.post('/register', protect, authorizeRoles('admin'), register);
router.get('/me', protect, getMe);
router.get('/usuarios', protect, authorizeRoles('admin'), getUsuarios);
router.put('/usuarios/:id', protect, authorizeRoles('admin'), updateUsuario);
router.delete('/usuarios/:id', protect, authorizeRoles('admin'), deleteUsuario);

module.exports = router;
