import api from './axios';

export const getProductosEtiquetas = (params) => api.get('/etiquetas/productos', { params });
export const generarEtiquetas = (data) => api.post('/etiquetas/generar', data);
