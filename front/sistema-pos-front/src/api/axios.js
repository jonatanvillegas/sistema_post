import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const isFileProtocol = () => {
  try {
    return typeof window !== 'undefined' && window.location?.protocol === 'file:';
  } catch {
    return false;
  }
};

const api = axios.create({
  // DEV: proxy de Vite → /api
  // PROD (Web): usa VITE_API_URL si existe, si no /api (mismo dominio)
  // PROD (Electron/file://): backend embebido en localhost:5000
  baseURL: import.meta.env.DEV
    ? '/api'
    : isFileProtocol()
      ? 'http://localhost:5000/api'
      : (import.meta.env.VITE_API_URL || '/api'),
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
