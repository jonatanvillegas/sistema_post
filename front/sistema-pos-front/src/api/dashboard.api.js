import api from './axios';

export const getResumen = () => api.get('/dashboard/resumen');
export const getVentasDashboard = (params) => api.get('/dashboard/ventas', { params });
export const getInventarioDashboard = () => api.get('/dashboard/inventario');
