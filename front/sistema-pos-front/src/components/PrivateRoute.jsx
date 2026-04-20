import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export const PrivateRoute = ({ adminOnly = false, allowedRoles = null }) => {
  const { token, usuario, getHomePath } = useAuthStore();
  const home = getHomePath();

  if (!token) return <Navigate to="/login" replace />;

  const effectiveAllowedRoles = adminOnly ? ['admin'] : allowedRoles;
  if (effectiveAllowedRoles && Array.isArray(effectiveAllowedRoles)) {
    if (!effectiveAllowedRoles.includes(usuario?.rol)) {
      return <Navigate to={home} replace />;
    }
  }

  return <Outlet />;
};
