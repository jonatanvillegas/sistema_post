import api from './axios';

export const getAuditLogs = (params) => api.get('/audit', { params });
