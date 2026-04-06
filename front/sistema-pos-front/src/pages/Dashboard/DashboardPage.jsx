import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Spin, Table, Tag, Space } from 'antd';
import { 
  RiseOutlined, 
  FallOutlined, 
  ShoppingCartOutlined, 
  InboxOutlined, 
  UserOutlined,
  StockOutlined,
  DollarOutlined
} from '@ant-design/icons';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, Cell
} from 'recharts';
import { getResumen, getVentasDashboard } from '../../api/dashboard.api';
import { formatCurrency, formatNumber } from '../../utils/formatters';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState(null);
  const [ventasStats, setVentasStats] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resResumen, resVentas] = await Promise.all([
          getResumen(),
          getVentasDashboard({ periodo: '7dias' })
        ]);
        setResumen(resResumen.data);
        setVentasStats(resVentas.data);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" description="Cargando panel de control..." />
      </div>
    );
  }

  const COLORS = ['#1677ff', '#52c41a', '#faad14', '#f5222d', '#722ed1'];

  const StatCard = ({ title, value, icon, color, subValue, subLabel, trend }) => (
    <Card className="stat-card" bordered={false}>
      <div className="stat-card-inner">
        <div className="stat-header">
          <div className="stat-info">
            <div className="stat-label">{title}</div>
            <div className="stat-value">{value}</div>
          </div>
          <div className="stat-icon" style={{ background: `${color}12`, color: color }}>
            {icon}
          </div>
        </div>
        
        {subValue && (
          <div className="stat-footer">
            <Tag color={color} bordered={false} style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
              {subValue}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>{subLabel}</Text>
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ marginBottom: 4, fontWeight: 800 }}>Panel de Control</Title>
          <Text type="secondary" style={{ fontSize: 15 }}>Bienvenido de nuevo. Aquí tienes un resumen del estado actual del negocio.</Text>
        </div>
      </div>

      {/* Primary Stats */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard 
            title="Ventas de Hoy" 
            value={formatCurrency(resumen?.ventasHoy?.totalVentas)} 
            icon={<RiseOutlined />} 
            color="#0ea5e9"
            subValue={`+${resumen?.ventasHoy?.cantidad || 0}`}
            subLabel="transacciones hoy"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard 
            title="Ventas del Mes" 
            value={formatCurrency(resumen?.ventasMes?.totalVentas)} 
            icon={<ShoppingCartOutlined />} 
            color="#10b981"
            subValue={formatCurrency(resumen?.ventasMes?.totalVentas / 30)}
            subLabel="promedio diario"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard 
            title="Stock Crítico" 
            value={resumen?.stockBajo} 
            icon={<FallOutlined />} 
            color="#f59e0b"
            subValue="Acción requerida"
            subLabel="productos agotándose"
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <StatCard 
            title="Caja Actual" 
            value={resumen?.cajaActiva ? "Abierta" : "Cerrada"} 
            icon={<DollarOutlined />} 
            color={resumen?.cajaActiva ? "#6366f1" : "#94a3b8"}
            subValue={resumen?.cajaActiva ? resumen?.cajaActiva.usuarioApertura?.nombre : "Sin actividad"}
            subLabel={resumen?.cajaActiva ? "Cajero asignado" : "Caja cerrada"}
          />
        </Col>
      </Row>
      {/* Charts Row */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <Card 
            title={<Space><StockOutlined /> Tendencia de Ventas (7 días)</Space>} 
            extra={<Text type="secondary">Cordobas (C$)</Text>} 
            className="dashboard-card"
          >
            <div style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ventasStats?.ventasPorDia}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} dy={10} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Space><DollarOutlined /> Métodos de Pago</Space>} className="dashboard-card">
            <div style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasStats?.ventasPorMetodo} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="_id" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{fontSize: 12, fill: '#1e293b', fontWeight: 600}}
                    width={100}
                  />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]} barSize={20}>
                    {ventasStats?.ventasPorMetodo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Bottom Row */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={<Space><InboxOutlined /> Top 5 Productos Más Vendidos</Space>} className="dashboard-card">
            <Table 
              dataSource={ventasStats?.topProductos} 
              pagination={false}
              size="middle"
              rowKey="_id"
              columns={[
                { 
                  title: 'Producto', 
                  dataKey: 'nombre', 
                  render: (text, record) => <Text strong style={{ color: '#1e293b' }}>{record.nombre}</Text> 
                },
                { 
                  title: 'Vendidos', 
                  dataIndex: 'totalVendido', 
                  align: 'center', 
                  render: (val) => <Tag color="blue" bordered={false} style={{ borderRadius: 6, padding: '2px 10px', fontWeight: 600 }}>{val} und</Tag> 
                },
                { 
                  title: 'Ingresos', 
                  dataIndex: 'ingresos', 
                  align: 'right', 
                  render: (val) => <Text strong style={{ color: '#10b981' }}>{formatCurrency(val)}</Text>
                }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card 
            title={<Space><StockOutlined /> Estado del Inventario</Space>} 
            className="dashboard-card" 
            extra={<Space><Text type="secondary">Total:</Text><Tag color="default" style={{ borderRadius: 6, fontWeight: 700 }}>{formatNumber(resumen?.totalProductos)} items</Tag></Space>}
          >
             <div style={{ padding: '8px 0' }}>
               <Row gutter={[24, 24]}>
                 <Col span={12}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.02)' }}>
                      <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase' }}>Valor Venta</Text>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#0ea5e9', marginTop: 4 }}>
                        {formatCurrency(resumen?.valorInventario?.valorVenta || 0)}
                      </div>
                    </div>
                 </Col>
                 <Col span={12}>
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.02)' }}>
                      <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase' }}>Costo Estimado</Text>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                        {formatCurrency(resumen?.valorInventario?.valorCosto || 0)}
                      </div>
                    </div>
                 </Col>
               </Row>
               <div style={{ marginTop: 24 }}>
                 <Title level={5} style={{ marginBottom: 16 }}>Distribución por Categorías</Title>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                   {resumen?.porCategoria?.slice(0, 4).map((cat, idx) => (
                     <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid rgba(0,0,0,0.02)' }}>
                       <Text style={{ fontWeight: 500, color: '#475569' }}>{cat._id || 'General'}</Text>
                       <Text strong style={{ color: '#1e293b' }}>{cat.cantidad}</Text>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
