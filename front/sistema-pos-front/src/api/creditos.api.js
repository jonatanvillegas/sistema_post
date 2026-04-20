import api from './axios';

export const getCreditosByCliente = (clienteId, estado) => 
  api.get(`/creditos/cliente/${clienteId}`, { params: { estado } });

export const registrarAbono = (id, data) => 
  api.post(`/creditos/${id}/abono`, data);

export const getCreditoDetalle = (id) =>
  api.get(`/creditos/${id}/detalle`);

export const updateCreditoVentaProductos = (id, data) =>
  api.put(`/creditos/${id}/venta`, data);

export const getCreditosPendientes = () => 
  api.get('/creditos/pendientes');
