import api from './axios';

export const getConfiguracionContable = () => api.get('/contabilidad/configuracion');
export const updateConfiguracionContable = (data) => api.put('/contabilidad/configuracion', data);

export const getCuentasContables = (params) => api.get('/contabilidad/cuentas', { params });
export const createCuentaContable = (data) => api.post('/contabilidad/cuentas', data);
export const updateCuentaContable = (id, data) => api.put(`/contabilidad/cuentas/${id}`, data);

export const getAsientosContables = (params) => api.get('/contabilidad/asientos', { params });
export const createAsientoContable = (data) => api.post('/contabilidad/asientos', data);
export const anularAsientoContable = (id, data) => api.put(`/contabilidad/asientos/${id}/anular`, data);

export const getBalanceGeneral = (params) => api.get('/contabilidad/reportes/balance-general', { params });
export const getCuentasT = (params) => api.get('/contabilidad/reportes/cuentas-t', { params });
export const getAnexosContables = (params) => api.get('/contabilidad/reportes/anexos', { params });
export const getEstadoCuentaContable = (cuentaId, params) =>
  api.get(`/contabilidad/reportes/estado-cuenta/${cuentaId}`, { params });
