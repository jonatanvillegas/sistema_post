const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('./audit.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');

router.get('/', protect, authorizeRoles('admin'), getAuditLogs);

module.exports = router;
