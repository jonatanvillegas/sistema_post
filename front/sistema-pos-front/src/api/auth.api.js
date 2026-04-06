import api from './axios';

export const login = (data) => api.post('/auth/login', data);
export const getMe = () => api.get('/auth/me');
export const register = (data) => api.post('/auth/register', data);
export const getUsuarios = () => api.get('/auth/usuarios');
export const updateUsuario = (id, data) => api.put(`/auth/usuarios/${id}`, data);
export const deleteUsuario = (id) => api.delete(`/auth/usuarios/${id}`);
