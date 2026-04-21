import api from './axios';

export const getVentas = (params) => api.get('/ventas', { params });
export const getVentaById = (id) => api.get(`/ventas/${id}`);
export const createVenta = (data) => api.post('/ventas', data);
export const anularVenta = (id, data) => api.put(`/ventas/${id}/anular`, data);

// Solo admin: reporte por rango de fechas (YYYY-MM-DD)
export const getVentasReporteAdmin = (params) => api.get('/ventas/reporte/admin', { params });
