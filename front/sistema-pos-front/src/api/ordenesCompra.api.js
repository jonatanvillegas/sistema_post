import api from './axios';

export const getOrdenesCompra = (params) => api.get('/ordenes-compra', { params });
export const getOrdenCompraById = (id) => api.get(`/ordenes-compra/${id}`);
export const createOrdenCompra = (data) => api.post('/ordenes-compra', data);
export const updateOrdenCompra = (id, data) => api.put(`/ordenes-compra/${id}`, data);
export const recibirMercaderia = (id, data) => api.put(`/ordenes-compra/${id}/recibir`, data);
export const cancelarOrdenCompra = (id, data) => api.put(`/ordenes-compra/${id}/cancelar`, data);
export const deleteOrdenCompra = (id) => api.delete(`/ordenes-compra/${id}`);
