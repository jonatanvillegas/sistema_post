import api from './axios';

export const getCotizaciones = (params) => api.get('/cotizaciones', { params });
export const getCotizacionById = (id) => api.get(`/cotizaciones/${id}`);
export const createCotizacion = (data) => api.post('/cotizaciones', data);
export const updateCotizacion = (id, data) => api.put(`/cotizaciones/${id}`, data);
export const deleteCotizacion = (id) => api.delete(`/cotizaciones/${id}`);
export const cambiarEstadoCotizacion = (id, estado) => api.put(`/cotizaciones/${id}/estado`, { estado });
export const convertirCotizacionAVenta = (id, data) => api.put(`/cotizaciones/${id}/convertir`, data);
export const duplicarCotizacion = (id) => api.post(`/cotizaciones/${id}/duplicar`);
export const getEstadisticasCotizaciones = () => api.get('/cotizaciones/estadisticas');
