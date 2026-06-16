import api from './axios';

export const getCajaActual = () => api.get('/caja/actual');
export const abrirCaja = (data) => api.post('/caja/abrir', data);
export const cerrarCaja = (id, data) => api.put(`/caja/cerrar/${id}`, data);
export const registrarIngreso = (data) => api.post('/caja/ingreso', data);
export const registrarEgreso = (data) => api.post('/caja/egreso', data);
export const getHistorialCaja = (params) => api.get('/caja/historial', { params });
export const getCajaById = (id) => api.get(`/caja/${id}`);

export const exportTransaccionesCaja = (params) =>
	api.get('/caja/transacciones/export', { params, responseType: 'blob' });
