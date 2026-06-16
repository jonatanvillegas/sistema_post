import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Typography, Tabs, Table, Tag, DatePicker, Button, Space, Statistic, Spin, Select,
} from 'antd';
import {
  DollarOutlined, RiseOutlined, FallOutlined, ShoppingCartOutlined,
  InboxOutlined, UserOutlined, SwapOutlined, BarChartOutlined,
  FileExcelOutlined, ReloadOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Cell, LineChart, Line,
  ComposedChart,
} from 'recharts';
import { toast } from 'react-hot-toast';
import {
  getReporteUtilidades, getReporteProductos, getReporteComprasVsVentas,
  getReporteInventarioValorizado, getReporteMovimientosStock, getReporteClientesFrecuentes,
} from '../../api/reportes.api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function ReportesPage() {
  const [activeTab, setActiveTab] = useState('utilidades');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(null);
  const [reporteData, setReporteData] = useState(null);

  const getDateParams = () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return {};
    return {
      desde: dateRange[0].format('YYYY-MM-DD'),
      hasta: dateRange[1].format('YYYY-MM-DD'),
    };
  };

  const fetchReport = async (tab = activeTab) => {
    setLoading(true);
    setReporteData(null);
    try {
      const params = getDateParams();
      let res;
      switch (tab) {
        case 'utilidades': res = await getReporteUtilidades(params); break;
        case 'productos': res = await getReporteProductos({ ...params, orden: 'mas' }); break;
        case 'compras-ventas': res = await getReporteComprasVsVentas(params); break;
        case 'inventario': res = await getReporteInventarioValorizado(params); break;
        case 'movimientos': res = await getReporteMovimientosStock(params); break;
        case 'clientes': res = await getReporteClientesFrecuentes(params); break;
        default: return;
      }
      setReporteData(res.data);
    } catch (err) {
      toast.error('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setReporteData(null);
  };

  // ─── Renderers ───
  const renderUtilidades = () => {
    if (!reporteData) return null;
    const d = reporteData;
    return (
      <>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Total Ventas" value={d.totalVentas} prefix="C$" precision={2}
                valueStyle={{ fontSize: 20, fontWeight: 700, color: '#0ea5e9' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Costo Total" value={d.totalCosto} prefix="C$" precision={2}
                valueStyle={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Utilidad Bruta" value={d.utilidadBruta} prefix="C$" precision={2}
                valueStyle={{ fontSize: 20, fontWeight: 700, color: '#10b981' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Margen %" value={d.margenPorcentaje} suffix="%"
                valueStyle={{ fontSize: 20, fontWeight: 700, color: '#8b5cf6' }} />
            </Card>
          </Col>
        </Row>

        <Card title="Tendencia de Ventas" bordered={false} className="dashboard-card shadow-sm">
          <div style={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.utilidadPorDia}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis hide />
                <RechartsTooltip formatter={(v) => formatCurrency(v)}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="ventas" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </>
    );
  };

  const renderProductos = () => {
    if (!reporteData) return null;
    return (
      <Card bordered={false} className="dashboard-card shadow-sm">
        <Table dataSource={reporteData} rowKey="_id" pagination={{ pageSize: 20 }}
          className="custom-table" scroll={{ x: 800 }}
          columns={[
            { title: '#', key: 'idx', width: 50, render: (_, __, i) => <Text strong>{i + 1}</Text> },
            {
              title: 'Producto', key: 'nombre',
              render: (_, r) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{r.nombre}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{r.codigo || 'S/C'} | {r.categoria || 'General'}</Text>
                </Space>
              ),
            },
            { title: 'Vendidos', dataIndex: 'totalVendido', align: 'center',
              render: (v) => <Tag color="blue" bordered={false} style={{ fontWeight: 600 }}>{v} und</Tag> },
            { title: 'Ingresos', dataIndex: 'ingresos', align: 'right',
              render: (v) => <Text strong style={{ color: '#10b981' }}>{formatCurrency(v)}</Text> },
            { title: 'Stock', dataIndex: 'stockActual', align: 'center',
              render: (v, r) => <Tag color={v <= (r.stockMinimo || 5) ? 'red' : 'green'}>{v}</Tag>,
              responsive: ['md'] },
            { title: 'Precio Venta', dataIndex: 'precioVenta', render: (v) => formatCurrency(v), responsive: ['lg'] },
          ]}
        />
      </Card>
    );
  };

  const renderComprasVsVentas = () => {
    if (!reporteData) return null;
    return (
      <Card bordered={false} className="dashboard-card shadow-sm">
        <div style={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={reporteData}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis hide />
              <RechartsTooltip formatter={(v) => formatCurrency(v)}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Legend />
              <Bar dataKey="ventas" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={20} name="Ventas" />
              <Bar dataKey="compras" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} name="Compras" />
              <Line type="monotone" dataKey="diferencia" stroke="#10b981" strokeWidth={2} name="Diferencia" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  };

  const renderInventarioValorizado = () => {
    if (!reporteData) return null;
    const d = reporteData;
    return (
      <>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Total Productos" value={d.resumen.totalProductos}
                valueStyle={{ fontSize: 20, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Valor a Costo" value={d.resumen.totalCosto} prefix="C$" precision={2}
                valueStyle={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Valor a Venta" value={d.resumen.totalVenta} prefix="C$" precision={2}
                valueStyle={{ fontSize: 20, fontWeight: 700, color: '#0ea5e9' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Utilidad Estimada" value={d.resumen.utilidadEstimada} prefix="C$" precision={2}
                valueStyle={{ fontSize: 20, fontWeight: 700, color: '#10b981' }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={8}>
            <Card title="Por Categoría" bordered={false} className="dashboard-card shadow-sm">
              <Table dataSource={d.categorias} rowKey="nombre" pagination={false} size="small"
                columns={[
                  { title: 'Categoría', dataIndex: 'nombre' },
                  { title: 'Uds.', dataIndex: 'unidades', align: 'center' },
                  { title: 'Valor', dataIndex: 'valorVenta', render: (v) => formatCurrency(v) },
                ]} />
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card title="Detalle de Productos" bordered={false} className="dashboard-card shadow-sm">
              <Table dataSource={d.detalle} rowKey="_id" size="small" scroll={{ x: 700 }}
                pagination={{ pageSize: 15 }}
                columns={[
                  { title: 'Producto', dataIndex: 'nombre', render: (t, r) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{t}</Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>{r.categoria}</Text>
                    </Space>
                  )},
                  { title: 'Stock', dataIndex: 'stock', align: 'center', width: 60,
                    render: (v, r) => <Tag color={r.stockBajo ? 'red' : 'green'}>{v}</Tag> },
                  { title: 'Costo', dataIndex: 'valorCosto', render: (v) => formatCurrency(v), responsive: ['md'] },
                  { title: 'Venta', dataIndex: 'valorVenta', render: (v) => <Text strong>{formatCurrency(v)}</Text> },
                  { title: 'Margen', dataIndex: 'margen', render: (v) => <Tag color={v > 30 ? 'green' : 'blue'}>{v}%</Tag>,
                    responsive: ['lg'] },
                ]} />
            </Card>
          </Col>
        </Row>
      </>
    );
  };

  const renderMovimientosStock = () => {
    if (!reporteData) return null;
    return (
      <>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {reporteData.resumen.map((r, i) => (
            <Col xs={8} key={r._id}>
              <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
                <Statistic title={r._id.charAt(0).toUpperCase() + r._id.slice(1)} value={r.movimientos}
                  suffix="mov." valueStyle={{ fontSize: 20, fontWeight: 700,
                    color: r._id === 'entrada' ? '#10b981' : r._id === 'salida' ? '#ef4444' : '#f59e0b' }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Card bordered={false} className="dashboard-card shadow-sm">
          <Table dataSource={reporteData.movimientos} rowKey="_id" scroll={{ x: 800 }}
            pagination={{ pageSize: 20 }} size="small"
            columns={[
              { title: 'Fecha', dataIndex: 'createdAt', render: (v) => formatDateTime(v), width: 160 },
              { title: 'Producto', key: 'prod', render: (_, r) => (
                <Text strong>{r.productoId?.nombre || '—'}</Text>
              )},
              { title: 'Tipo', dataIndex: 'tipo', width: 90,
                render: (v) => <Tag color={v === 'entrada' ? 'green' : v === 'salida' ? 'red' : 'orange'}>{v.toUpperCase()}</Tag> },
              { title: 'Cant.', dataIndex: 'cantidad', align: 'center', width: 70 },
              { title: 'Ant.', dataIndex: 'stockAnterior', align: 'center', width: 60, responsive: ['md'] },
              { title: 'Nuevo', dataIndex: 'stockNuevo', align: 'center', width: 70,
                render: (v) => <Text strong>{v}</Text> },
              { title: 'Motivo', dataIndex: 'motivo', ellipsis: true, responsive: ['lg'] },
              { title: 'Usuario', key: 'user', width: 100, render: (_, r) => r.usuarioId?.nombre || '—', responsive: ['md'] },
            ]} />
        </Card>
      </>
    );
  };

  const renderClientesFrecuentes = () => {
    if (!reporteData) return null;
    return (
      <Card bordered={false} className="dashboard-card shadow-sm">
        <Table dataSource={reporteData} rowKey="_id" scroll={{ x: 700 }}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: '#', key: 'idx', width: 50, render: (_, __, i) => <Text strong>{i + 1}</Text> },
            { title: 'Cliente', key: 'nombre', render: (_, r) => (
              <Space direction="vertical" size={0}>
                <Text strong>{r.nombre}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>{r.nit || 'CF'}</Text>
              </Space>
            )},
            { title: 'Compras', dataIndex: 'cantidadCompras', align: 'center',
              render: (v) => <Tag color="blue" bordered={false}>{v}</Tag> },
            { title: 'Total Compras', dataIndex: 'totalCompras', align: 'right',
              render: (v) => <Text strong style={{ color: '#10b981' }}>{formatCurrency(v)}</Text> },
            { title: 'Ticket Prom.', dataIndex: 'ticketPromedio', align: 'right',
              render: (v) => formatCurrency(v), responsive: ['md'] },
            { title: 'Última Compra', dataIndex: 'ultimaCompra', render: (v) => formatDate(v), responsive: ['lg'] },
          ]}
        />
      </Card>
    );
  };

  const tabRenderers = {
    utilidades: renderUtilidades,
    productos: renderProductos,
    'compras-ventas': renderComprasVsVentas,
    inventario: renderInventarioValorizado,
    movimientos: renderMovimientosStock,
    clientes: renderClientesFrecuentes,
  };

  const tabItems = [
    { key: 'utilidades', label: <><DollarOutlined /> Utilidades</>, icon: <DollarOutlined /> },
    { key: 'productos', label: <><ShoppingCartOutlined /> Productos</>, icon: <ShoppingCartOutlined /> },
    { key: 'compras-ventas', label: <><SwapOutlined /> Compras vs Ventas</>, icon: <SwapOutlined /> },
    { key: 'inventario', label: <><InboxOutlined /> Inventario Valorizado</>, icon: <InboxOutlined /> },
    { key: 'movimientos', label: <><BarChartOutlined /> Movimientos Stock</>, icon: <BarChartOutlined /> },
    { key: 'clientes', label: <><UserOutlined /> Clientes Frecuentes</>, icon: <UserOutlined /> },
  ];

  return (
    <div style={{ padding: '0 24px', width: '100%' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={2} className="page-title">Reportes Avanzados</Title>
          <Text className="page-sub">Análisis detallado de utilidades, productos, inventario y más.</Text>
        </div>
        <Space>
          <RangePicker onChange={setDateRange} style={{ borderRadius: 8 }} />
          <Button type="primary" icon={<ReloadOutlined />} onClick={() => fetchReport()}>
            Generar
          </Button>
        </Space>
      </div>

      <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 0 }}>
        <Tabs activeKey={activeTab} onChange={handleTabChange}
          items={tabItems} style={{ padding: '0 24px' }}
          tabBarStyle={{ marginBottom: 0 }} />
      </Card>

      <div style={{ marginTop: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}><Text type="secondary">Generando reporte...</Text></div>
          </div>
        ) : (
          tabRenderers[activeTab]?.() || null
        )}
      </div>
    </div>
  );
}
