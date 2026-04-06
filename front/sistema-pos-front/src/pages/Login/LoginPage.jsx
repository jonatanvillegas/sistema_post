import { useState } from 'react';
import { Form, Input, Button, Checkbox, Alert } from 'antd';
import { UserOutlined, LockOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useCajaStore } from '../../store/cajaStore';
import { login } from '../../api/auth.api';
import { getCajaActual } from '../../api/caja.api';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login: loginStore } = useAuthStore();
  const { setCajaActual } = useCajaStore();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await login({ email: values.email, password: values.password });
      loginStore(data.token, data.usuario);

      // Verificar si hay caja abierta
      try {
        const cajaRes = await getCajaActual();
        setCajaActual(cajaRes.data.caja);
      } catch {
        setCajaActual(null);
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-icon">
            <AppstoreOutlined />
          </div>
          <div>
            <div className="login-brand-name">Sistema POS</div>
            <div className="login-tagline">Punto de Venta Profesional</div>
          </div>
        </div>

        <h1 className="login-headline">
          Gestiona tu negocio<br />de forma inteligente
        </h1>
        <p className="login-sub">
          Sistema completo de punto de venta con inventario, caja, proveedores y reportes en tiempo real.
        </p>

        <div className="login-features">
          {[
            'Punto de venta rápido con múltiples pestañas',
            'Control de inventario y kardex automático',
            'Apertura y cierre de caja con billetaje',
            'Dashboard con métricas en tiempo real',
          ].map((f) => (
            <div className="login-feature-item" key={f}>
              <div className="login-feature-dot" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="login-card-title">Bienvenido</h2>
          <p className="login-card-sub">Ingresa tus credenciales para continuar</p>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ marginBottom: 20, borderRadius: 8 }}
              closable
              onClose={() => setError('')}
            />
          )}

          <Form layout="vertical" onFinish={onFinish} size="large" autoComplete="off">
            <Form.Item
              name="email"
              label="Correo electrónico"
              rules={[
                { required: true, message: 'Ingresa tu correo' },
                { type: 'email', message: 'Formato de correo inválido' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="correo@ejemplo.com"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Contraseña"
              rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="••••••••"
              />
            </Form.Item>

            <Form.Item name="recordar" valuePropName="checked" style={{ marginBottom: 20 }}>
              <Checkbox>Recordarme en este dispositivo</Checkbox>
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{ height: 44, fontWeight: 600, fontSize: 15 }}
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </Form>

          <div style={{ textAlign: 'center', marginTop: 24, color: '#8c8c8c', fontSize: 12 }}>
            Sistema POS © {new Date().getFullYear()} — Nicaragua
          </div>
        </div>
      </div>
    </div>
  );
}
