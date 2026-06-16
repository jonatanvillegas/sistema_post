import api from './axios';

export const getDevoluciones = (params) => api.get('/devoluciones', { params });
export const getDevolucionById = (id) => api.get(`/devoluciones/${id}`);
export const getProductosVenta = (ventaRef) => api.get(`/devoluciones/venta/${encodeURIComponent(ventaRef)}`);
export const createDevolucion = (data) => api.post('/devoluciones', data);
export const aprobarDevolucion = (id) => api.put(`/devoluciones/${id}/aprobar`);
export const rechazarDevolucion = (id, data) => api.put(`/devoluciones/${id}/rechazar`, data);
export const getEstadisticasDevoluciones = () => api.get('/devoluciones/estadisticas');
