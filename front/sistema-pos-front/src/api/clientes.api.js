import api from './axios';

export const getClientes = (buscar = '', estado) => 
  api.get('/clientes', { params: { buscar, estado } });

export const getClienteById = (id) => 
  api.get(`/clientes/${id}`);

export const createCliente = (data) => 
  api.post('/clientes', data);

export const updateCliente = (id, data) => 
  api.put(`/clientes/${id}`, data);

export const deleteCliente = (id) => 
  api.delete(`/clientes/${id}`);
