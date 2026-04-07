import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import { PrivateRoute } from '../components/PrivateRoute';
import LoginPage from '../pages/Login/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import VentasPage from '../pages/Ventas/VentasPage';
import InventarioPage from '../pages/Inventario/InventarioPage';
import CajaPage from '../pages/Caja/CajaPage';
import ProveedoresPage from '../pages/Proveedores/ProveedoresPage';
import UsuariosPage from '../pages/Usuarios/UsuariosPage';
import ArqueoPage from '../pages/Caja/ArqueoPage';
import ClientesPage from '../pages/Clientes/ClientesPage';
import AjustesPage from '../pages/Usuarios/AjustesPage';

export default function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ventas" element={<VentasPage />} />
            <Route path="/inventario" element={<InventarioPage />} />
            <Route path="/caja" element={<CajaPage />} />
            <Route path="/caja/arqueo" element={<ArqueoPage />} />
            <Route path="/proveedores" element={<ProveedoresPage />} />
            <Route path="/clientes" element={<ClientesPage />} />

            {/* Solo Admin */}
            <Route element={<PrivateRoute adminOnly />}>
              <Route path="/usuarios" element={<UsuariosPage />} />
              <Route path="/ajustes" element={<AjustesPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
