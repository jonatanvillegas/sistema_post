import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  // En Electron o producción se puede usar la URL completa, en dev se usa el proxy /api
  // En Electron o producción usamos la URL absoluta (ajustada para localhost:5000)
  baseURL: import.meta.env.PROD ? 'http://localhost:5000/api' : '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Inyectar token JWT en cada request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Manejar 401 globalmente → logout
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  }
);

export default api;
