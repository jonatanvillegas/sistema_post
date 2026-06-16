import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import { PrivateRoute } from '../components/PrivateRoute';
import LoginPage from '../pages/Login/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import VentasPage from '../pages/Ventas/VentasPage';
import VentasHistoryPage from '../pages/Ventas/VentasHistoryPage';
import InventarioPage from '../pages/Inventario/InventarioPage';
import CajaPage from '../pages/Caja/CajaPage';
import ProveedoresPage from '../pages/Proveedores/ProveedoresPage';
import UsuariosPage from '../pages/Usuarios/UsuariosPage';
import ArqueoPage from '../pages/Caja/ArqueoPage';
import ClientesPage from '../pages/Clientes/ClientesPage';
import AjustesPage from '../pages/Usuarios/AjustesPage';
import CategoriasPage from '../pages/Categorias/CategoriasPage';
import VentasReportePage from '../pages/Admin/VentasReportePage';
import AuditPage from '../pages/Admin/AuditPage';
import ProductoFormPage from '../pages/Inventario/ProductoFormPage';
import { useAuthStore } from '../store/authStore';

// Nuevos módulos
import CotizacionesPage from '../pages/Cotizaciones/CotizacionesPage';
import CotizacionFormPage from '../pages/Cotizaciones/CotizacionFormPage';
import DevolucionesPage from '../pages/Devoluciones/DevolucionesPage';
import ReportesPage from '../pages/Reportes/ReportesPage';
import EtiquetasPage from '../pages/Etiquetas/EtiquetasPage';
import OrdenesCompraPage from '../pages/OrdenesCompra/OrdenesCompraPage';
import OrdenCompraFormPage from '../pages/OrdenesCompra/OrdenCompraFormPage';
import CuentasCobrarPage from '../pages/CuentasCobrar/CuentasCobrarPage';

const HomeRedirect = () => {
  const { getHomePath } = useAuthStore();
  return <Navigate to={getHomePath()} replace />;
};

export default function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            {/* Admin */}
            <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>

            {/* Cajero */}
            <Route element={<PrivateRoute allowedRoles={["admin", "cajero"]} />}>
              <Route path="/ventas" element={<VentasPage />} />
              <Route path="/ventas/historial" element={<VentasHistoryPage />} />
              <Route path="/caja" element={<CajaPage />} />
              <Route path="/caja/arqueo" element={<ArqueoPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              {/* Cotizaciones — accesible por cajero y admin */}
              <Route path="/cotizaciones" element={<CotizacionesPage />} />
              <Route path="/cotizaciones/nueva" element={<CotizacionFormPage />} />
              <Route path="/cotizaciones/editar/:id" element={<CotizacionFormPage />} />
              {/* Devoluciones — accesible por cajero y admin */}
              <Route path="/devoluciones" element={<DevolucionesPage />} />
            </Route>

            {/* Encargado de Inventario */}
            <Route element={<PrivateRoute allowedRoles={["admin", "inventario"]} />}>
              <Route path="/inventario" element={<InventarioPage />} />
              <Route path="/inventario/nuevo" element={<ProductoFormPage />} />
              <Route path="/inventario/editar/:id" element={<ProductoFormPage />} />
              <Route path="/proveedores" element={<ProveedoresPage />} />
              {/* Etiquetas — accesible por inventario y admin */}
              <Route path="/etiquetas" element={<EtiquetasPage />} />
              {/* Órdenes de Compra — accesible por inventario y admin */}
              <Route path="/ordenes-compra" element={<OrdenesCompraPage />} />
              <Route path="/ordenes-compra/nueva" element={<OrdenCompraFormPage />} />
              <Route path="/ordenes-compra/editar/:id" element={<OrdenCompraFormPage />} />
            </Route>

            {/* Solo Admin */}
            <Route element={<PrivateRoute adminOnly />}>
              <Route path="/usuarios" element={<UsuariosPage />} />
              <Route path="/ajustes" element={<AjustesPage />} />
              <Route path="/categorias" element={<CategoriasPage />} />
              <Route path="/ventas-reporte" element={<VentasReportePage />} />
              <Route path="/auditoria" element={<AuditPage />} />
              {/* Reportes Avanzados — solo admin */}
              <Route path="/reportes" element={<ReportesPage />} />
              {/* Cuentas por Cobrar — solo admin */}
              <Route path="/cuentas-cobrar" element={<CuentasCobrarPage />} />
            </Route>

            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  );
}
