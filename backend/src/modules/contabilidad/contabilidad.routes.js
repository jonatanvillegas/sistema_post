const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');
const { authorizeRoles } = require('../../middlewares/role.middleware');
const controller = require('./contabilidad.controller');

router.use(protect, authorizeRoles('admin'));

router.get('/configuracion', controller.getConfiguracion);
router.put('/configuracion', controller.updateConfiguracion);

router.get('/cuentas', controller.getCuentas);
router.post('/cuentas', controller.createCuenta);
router.put('/cuentas/:id', controller.updateCuenta);

router.get('/asientos', controller.getAsientos);
router.post('/asientos', controller.createAsiento);
router.put('/asientos/:id/anular', controller.anularAsiento);

router.get('/reportes/cuentas-t', controller.getCuentasT);
router.get('/reportes/balance-general', controller.getBalanceGeneral);
router.get('/reportes/anexos', controller.getAnexos);
router.get('/reportes/estado-cuenta/:cuentaId', controller.getEstadoCuenta);

module.exports = router;
