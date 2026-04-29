const express = require('express');
const router = express.Router();
const configController = require('./config.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/', protect, configController.getConfig);
router.put('/', protect, authorizeRoles('admin'), configController.updateConfig);

module.exports = router;
