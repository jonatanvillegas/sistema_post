import api from './axios';

export const crearBackup = () => api.post('/admin/backup');
