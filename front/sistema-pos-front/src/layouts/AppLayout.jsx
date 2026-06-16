import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Avatar, Dropdown, Badge, Typography, Space, Tag,
} from 'antd';
import {
  DashboardOutlined, ShoppingCartOutlined, InboxOutlined,
  DollarOutlined, TruckOutlined, UserOutlined, LogoutOutlined,
  SettingOutlined, BellOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  AppstoreOutlined, ExclamationCircleOutlined,
  BarChartOutlined, HistoryOutlined, FileTextOutlined, RollbackOutlined,
  TagOutlined, FileDoneOutlined, CreditCardOutlined, PieChartOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useCajaStore } from '../store/cajaStore';

const { Sider, Header, Content } = Layout;

const adminMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/ventas', icon: <ShoppingCartOutlined />, label: 'Punto de Venta' },
  { key: '/cotizaciones', icon: <FileTextOutlined />, label: 'Cotizaciones' },
  { key: '/devoluciones', icon: <RollbackOutlined />, label: 'Devoluciones' },
  { key: '/inventario', icon: <InboxOutlined />, label: 'Inventario' },
  { key: '/caja', icon: <DollarOutlined />, label: 'Caja' },
  { key: '/proveedores', icon: <TruckOutlined />, label: 'Proveedores' },
  { key: '/ordenes-compra', icon: <FileDoneOutlined />, label: 'Órdenes Compra' },
  { key: '/clientes', icon: <UserOutlined />, label: 'Clientes' },
  { key: '/etiquetas', icon: <TagOutlined />, label: 'Etiquetas' },
];

const cajeroMenuItems = [
  { key: '/ventas', icon: <ShoppingCartOutlined />, label: 'Punto de Venta' },
  { key: '/cotizaciones', icon: <FileTextOutlined />, label: 'Cotizaciones' },
  { key: '/devoluciones', icon: <RollbackOutlined />, label: 'Devoluciones' },
  { key: '/caja', icon: <DollarOutlined />, label: 'Caja' },
  { key: '/clientes', icon: <UserOutlined />, label: 'Clientes' },
];

const inventarioMenuItems = [
  { key: '/inventario', icon: <InboxOutlined />, label: 'Inventario' },
  { key: '/proveedores', icon: <TruckOutlined />, label: 'Proveedores' },
  { key: '/ordenes-compra', icon: <FileDoneOutlined />, label: 'Órdenes Compra' },
  { key: '/etiquetas', icon: <TagOutlined />, label: 'Etiquetas' },
];

const adminItems = [
  { key: '/reportes', icon: <PieChartOutlined />, label: 'Reportes Avanzados' },
  { key: '/cuentas-cobrar', icon: <CreditCardOutlined />, label: 'Cuentas por Cobrar' },
  { key: '/ventas-reporte', icon: <BarChartOutlined />, label: 'Reporte de Ventas' },
  { key: '/usuarios', icon: <UserOutlined />, label: 'Usuarios' },
  { key: '/auditoria', icon: <HistoryOutlined />, label: 'Auditoría' },
  { key: '/categorias', icon: <InboxOutlined />, label: 'Categorías' },
  { key: '/ajustes', icon: <SettingOutlined />, label: 'Ajustes' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout, isAdmin, isCajero, isInventario, getHomePath } = useAuthStore();
  const { cajaActual } = useCajaStore();

  const handleMenuClick = ({ key }) => navigate(key);

  const userMenu = {
    items: [
      { key: 'perfil', icon: <SettingOutlined />, label: 'Mi perfil' },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Cerrar sesión',
        danger: true,
      },
    ],
    onClick: ({ key }) => {
      if (key === 'logout') {
        logout();
        navigate('/login');
      }
    },
  };

  const baseMenu = isAdmin()
    ? adminMenuItems
    : isInventario()
      ? inventarioMenuItems
      : isCajero()
        ? cajeroMenuItems
        : cajeroMenuItems;

  const allMenuItems = isAdmin()
    ? [
        ...baseMenu,
        { type: 'divider' },
        { key: 'admin-group', label: 'Administración', type: 'group' },
        ...adminItems,
      ]
    : baseMenu;

  return (
    <Layout className="app-layout" style={{ minHeight: '100vh' }}>
      <Sider
        className="app-sidebar"
        width={220}
        collapsedWidth={0}
        breakpoint="lg"
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        onBreakpoint={(broken) => setIsMobile(broken)}
        theme="dark"
        trigger={null}
        style={{
          position: isMobile ? 'fixed' : 'fixed',
          zIndex: 1001,
          height: '100vh',
        }}
      >
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }} onClick={() => { navigate(getHomePath()); if(isMobile) setCollapsed(true); }}>
            <div className="sidebar-logo-icon">
              <AppstoreOutlined />
            </div>
            {!collapsed && (
              <span className="sidebar-logo-text">Sistema POS</span>
            )}
          </div>
          {isMobile && !collapsed && (
            <MenuFoldOutlined 
              style={{ color: '#fff', fontSize: 20, cursor: 'pointer' }} 
              onClick={() => setCollapsed(true)} 
            />
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={allMenuItems}
          onClick={(e) => { handleMenuClick(e); if(isMobile) setCollapsed(true); }}
          style={{ flex: 1, borderRight: 0, paddingTop: 8 }}
        />

        {!collapsed && cajaActual && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Tag color="success" style={{ width: '100%', textAlign: 'center', borderRadius: 6 }}>
              ● Caja Abierta
            </Tag>
          </div>
        )}
        {!collapsed && !cajaActual && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <Tag color="warning" icon={<ExclamationCircleOutlined />} style={{ width: '100%', textAlign: 'center', borderRadius: 6, fontSize: 11 }}>
              Sin caja abierta
            </Tag>
          </div>
        )}
      </Sider>

      <Layout className="main-layout-container" style={{ 
        marginLeft: (collapsed || isMobile) ? 0 : 220, 
        transition: 'margin-left 0.2s',
        width: '100%',
        minWidth: 0
      }}>
        <Header className="app-header" style={{ 
          left: (collapsed || isMobile) ? 0 : 220,
          width: (collapsed || isMobile) ? '100%' : 'calc(100% - 220px)',
          transition: 'all 0.2s',
          zIndex: 1000
        }}>
          <div className="header-left">
            <span
              className="sidebar-trigger"
              style={{ cursor: 'pointer', fontSize: 18, color: '#595959' }}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
          </div>

          <div className="header-right">
            <Badge count={0} size="small">
              <BellOutlined style={{ fontSize: 18, color: '#595959', cursor: 'pointer' }} />
            </Badge>

            <Dropdown menu={userMenu} trigger={['click']}>
              <div className="header-user">
                <Avatar
                  size={32}
                  style={{ background: '#1677ff', fontSize: 13, fontWeight: 600 }}
                >
                  {usuario?.nombre?.charAt(0).toUpperCase()}
                </Avatar>
                <Space orientation="vertical" size={0} style={{ lineHeight: 1 }}>
                  <Typography.Text strong style={{ fontSize: 13, lineHeight: '16px' }}>
                    {usuario?.nombre}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: '14px', textTransform: 'capitalize' }}>
                    {usuario?.rol}
                  </Typography.Text>
                </Space>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content className="app-content">
          <div className="page-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
