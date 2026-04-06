import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const PrivateRoute = ({ adminOnly = false }) => {
  const { token, usuario } = useAuthStore();

  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && usuario?.rol !== 'admin') return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};
