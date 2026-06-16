import api from './axios';

// Existentes (re-export for convenience)
export { getCreditosByCliente } from './creditos.api';

// Cuentas por Cobrar - nuevos endpoints
export const getResumenCuentasCobrar = () => api.get('/creditos/cuentas-cobrar');
export const getEstadoCuentaCliente = (clienteId) => api.get(`/creditos/cuentas-cobrar/cliente/${clienteId}`);
export const getReporteMorosidad = () => api.get('/creditos/cuentas-cobrar/morosidad');
