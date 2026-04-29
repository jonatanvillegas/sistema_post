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
  BarChartOutlined, HistoryOutlined
} from '@ant-design/icons';
import { useAuthStore } from '../store/authStore';
import { useCajaStore } from '../store/cajaStore';

const { Sider, Header, Content } = Layout;

const adminMenuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/ventas', icon: <ShoppingCartOutlined />, label: 'Punto de Venta' },
  { key: '/inventario', icon: <InboxOutlined />, label: 'Inventario' },
  { key: '/caja', icon: <DollarOutlined />, label: 'Caja' },
  { key: '/proveedores', icon: <TruckOutlined />, label: 'Proveedores' },
  { key: '/clientes', icon: <UserOutlined />, label: 'Clientes' },
];

const cajeroMenuItems = [
  { key: '/ventas', icon: <ShoppingCartOutlined />, label: 'Punto de Venta' },
  { key: '/caja', icon: <DollarOutlined />, label: 'Caja' },
  { key: '/clientes', icon: <UserOutlined />, label: 'Clientes' },
];

const inventarioMenuItems = [
  { key: '/inventario', icon: <InboxOutlined />, label: 'Inventario' },
  { key: '/proveedores', icon: <TruckOutlined />, label: 'Proveedores' },
];

const adminItems = [
  { key: '/ventas-reporte', icon: <BarChartOutlined />, label: 'Reporte de Ventas' },
  { key: '/usuarios', icon: <UserOutlined />, label: 'Usuarios' },
  { key: '/auditoria', icon: <HistoryOutlined />, label: 'Auditoría' },
  { key: '/categorias', icon: <InboxOutlined />, label: 'Categorías' },
  { key: '/ajustes', icon: <SettingOutlined />, label: 'Ajustes' },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
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
        collapsedWidth={64}
        collapsed={collapsed}
        theme="dark"
      >
        <div className="sidebar-logo" onClick={() => navigate(getHomePath())}>
          <div className="sidebar-logo-icon">
            <AppstoreOutlined />
          </div>
          {!collapsed && (
            <span className="sidebar-logo-text">Sistema POS</span>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={allMenuItems}
          onClick={handleMenuClick}
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

      <Layout style={{ marginLeft: collapsed ? 64 : 220, transition: 'margin-left 0.2s' }}>
        <Header className="app-header" style={{ left: collapsed ? 64 : 220 }}>
          <div className="header-left">
            <span
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
