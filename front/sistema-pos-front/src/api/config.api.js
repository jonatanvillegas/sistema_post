import api from './axios';

export const getConfig = () => api.get('/config');
export const updateConfig = (data) => api.put('/config', data);
