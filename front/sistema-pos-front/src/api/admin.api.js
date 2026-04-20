import api from './axios';

export const crearBackup = () => api.post('/admin/backup');

export const previewRestore = (folderPath) => api.post('/admin/backup/preview', { folderPath });

export const restoreFromFolder = (folderPath, confirmText) =>
	api.post('/admin/backup/restore', { folderPath, confirmText });
