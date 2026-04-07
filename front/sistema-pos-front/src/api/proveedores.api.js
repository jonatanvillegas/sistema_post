import api from './axios';

export const getProveedores = () => api.get('/proveedores');
export const getProveedorById = (id) => api.get(`/proveedores/${id}`);
export const createProveedor = (data) => api.post('/proveedores', data);
export const updateProveedor = (id, data) => api.put(`/proveedores/${id}`, data);
export const deleteProveedor = (id) => api.delete(`/proveedores/${id}`);
export const getComprasProveedor = (id) => api.get(`/proveedores/${id}/compras`);
export const registrarCompra = (data) => api.post('/proveedores/compras', data);
export const getCompraById = (id) => api.get(`/proveedores/compras/${id}`);
export const updateCompra = (id, data) => api.put(`/proveedores/compras/${id}`, data);
export const deleteCompra = (id) => api.delete(`/proveedores/compras/${id}`);
