import api from './axios';

export const getProductos = (params) => api.get('/inventario', { params });
export const getProductoById = (id) => api.get(`/inventario/${id}`);
export const getStockBajo = () => api.get('/inventario/stock-bajo');
export const getKardex = (id) => api.get(`/inventario/kardex/${id}`);
export const createProducto = (data) => api.post('/inventario', data);
export const updateProducto = (id, data) => api.put(`/inventario/${id}`, data);
export const deleteProducto = (id) => api.delete(`/inventario/${id}`);

export const exportInventarioExcel = (params) =>
	api.get('/inventario/export/excel', { params, responseType: 'blob' });
