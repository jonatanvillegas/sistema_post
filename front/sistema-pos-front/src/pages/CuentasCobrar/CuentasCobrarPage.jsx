import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Typography, Table, Tag, Statistic, Space, Button, Modal,
  Descriptions, Divider, Spin, Tabs, Progress,
} from 'antd';
import {
  DollarOutlined, WarningOutlined, ClockCircleOutlined, UserOutlined,
  EyeOutlined, ExclamationCircleOutlined, FileProtectOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import {
  getResumenCuentasCobrar, getEstadoCuentaCliente, getReporteMorosidad,
} from '../../api/cuentasCobrar.api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

const { Title, Text } = Typography;

const COLORS_AGING = ['#10b981', '#f59e0b', '#ef4444', '#991b1b'];

export default function CuentasCobrarPage() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [loading, setLoading] = useState(false);
  const [resumenData, setResumenData] = useState(null);
  const [morosidadData, setMorosidadData] = useState(null);

  // Modal estado de cuenta
  const [estadoCuentaVisible, setEstadoCuentaVisible] = useState(false);
  const [estadoCuenta, setEstadoCuenta] = useState(null);
  const [loadingCuenta, setLoadingCuenta] = useState(false);

  useEffect(() => {
    if (activeTab === 'resumen') fetchResumen();
    else if (activeTab === 'morosidad') fetchMorosidad();
  }, [activeTab]);

  const fetchResumen = async () => {
    setLoading(true);
    try {
      const res = await getResumenCuentasCobrar();
      setResumenData(res.data);
    } catch { toast.error('Error al cargar cuentas por cobrar'); }
    finally { setLoading(false); }
  };

  const fetchMorosidad = async () => {
    setLoading(true);
    try {
      const res = await getReporteMorosidad();
      setMorosidadData(res.data);
    } catch { toast.error('Error al cargar reporte de morosidad'); }
    finally { setLoading(false); }
  };

  const handleVerEstadoCuenta = async (clienteId) => {
    setLoadingCuenta(true);
    setEstadoCuentaVisible(true);
    try {
      const res = await getEstadoCuentaCliente(clienteId);
      setEstadoCuenta(res.data);
    } catch { toast.error('Error al cargar estado de cuenta'); }
    finally { setLoadingCuenta(false); }
  };

  const agingChartData = resumenData ? [
    { name: '0-30 días', value: resumenData.antiguedad.rango030 },
    { name: '31-60 días', value: resumenData.antiguedad.rango3160 },
    { name: '61-90 días', value: resumenData.antiguedad.rango6190 },
    { name: '+90 días', value: resumenData.antiguedad.rangoMas90 },
  ] : [];

  // ─── Tab Resumen ───
  const renderResumen = () => {
    if (!resumenData) return null;
    const d = resumenData;
    return (
      <>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Total por Cobrar" value={d.totalPendiente} prefix="C$" precision={2}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}
                prefix={<DollarOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Créditos Activos" value={d.totalCreditos}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}
                prefix={<FileProtectOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Clientes con Deuda" value={d.clientes?.length || 0}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#8b5cf6' }}
                prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Vencidos (+90 días)" value={d.antiguedad.rangoMas90}
                prefix="C$" precision={2}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#991b1b' }}
                prefix={<WarningOutlined />} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card title={<><ClockCircleOutlined /> Antigüedad de Saldos</>} bordered={false} className="dashboard-card shadow-sm">
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false}
                      tick={{ fontSize: 12, fill: '#475569' }} width={80} />
                    <RechartsTooltip formatter={(v) => formatCurrency(v)}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                      {agingChartData.map((_, i) => <Cell key={i} fill={COLORS_AGING[i]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <Divider style={{ margin: '12px 0' }} />
              <Space direction="vertical" style={{ width: '100%' }}>
                {agingChartData.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS_AGING[i] }} />
                      <Text>{item.name}</Text>
                    </Space>
                    <Text strong>{formatCurrency(item.value)}</Text>
                  </div>
                ))}
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Card title={<><UserOutlined /> Deudores</>} bordered={false} className="dashboard-card shadow-sm">
              <Table dataSource={d.clientes} rowKey="nombre" size="small" scroll={{ x: 500 }}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Cliente', key: 'nombre', render: (_, r) => (
                    <Space direction="vertical" size={0}>
                      <Text strong>{r.nombre}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{r.nit || 'CF'} | {r.telefono || 'S/T'}</Text>
                    </Space>
                  )},
                  { title: 'Deuda Total', dataIndex: 'totalDeuda', align: 'right',
                    render: (v) => <Text strong style={{ color: '#ef4444' }}>{formatCurrency(v)}</Text>,
                    sorter: (a, b) => a.totalDeuda - b.totalDeuda, defaultSortOrder: 'descend' },
                  { title: 'Créditos', dataIndex: 'creditosActivos', align: 'center', width: 70,
                    render: (v) => <Tag color="blue">{v}</Tag> },
                  { title: '', key: 'acciones', width: 50, render: (_, r) => (
                    <Button icon={<EyeOutlined />} size="small" type="link"
                      onClick={() => handleVerEstadoCuenta(r.clienteId?._id || r.clienteId)} />
                  )},
                ]} />
            </Card>
          </Col>
        </Row>
      </>
    );
  };

  // ─── Tab Morosidad ───
  const renderMorosidad = () => {
    if (!morosidadData) return null;
    const d = morosidadData;
    return (
      <>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={8}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Total Morosidad" value={d.totalMorosidad} prefix="C$" precision={2}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }} />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Clientes Morosos" value={d.totalMorosos}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }} />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Créditos Vencidos" value={d.totalCreditos}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#991b1b' }} />
            </Card>
          </Col>
        </Row>

        <Card bordered={false} className="dashboard-card shadow-sm">
          <Table dataSource={d.morosos} rowKey="nombre" scroll={{ x: 700 }}
            pagination={{ pageSize: 15 }}
            expandable={{
              expandedRowRender: (record) => (
                <Table dataSource={record.detalle} rowKey="creditoId" size="small" pagination={false}
                  columns={[
                    { title: 'Venta', dataIndex: 'numeroVenta', render: (v) => <Tag>{v}</Tag> },
                    { title: 'Saldo', dataIndex: 'saldoPendiente', render: (v) => formatCurrency(v) },
                    { title: 'Vencimiento', dataIndex: 'fechaVencimiento', render: (v) => formatDate(v) },
                    { title: 'Días Vencido', dataIndex: 'diasVencido', align: 'center',
                      render: (v) => <Tag color={v > 90 ? 'red' : v > 60 ? 'orange' : 'gold'}>{v} días</Tag> },
                  ]} />
              ),
            }}
            columns={[
              { title: 'Cliente', key: 'nombre', render: (_, r) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{r.nombre}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{r.nit} | Tel: {r.telefono || 'S/T'}</Text>
                </Space>
              )},
              { title: 'Deuda Vencida', dataIndex: 'totalDeudaVencida', align: 'right',
                render: (v) => <Text strong style={{ color: '#ef4444', fontSize: 15 }}>{formatCurrency(v)}</Text>,
                sorter: (a, b) => a.totalDeudaVencida - b.totalDeudaVencida, defaultSortOrder: 'descend' },
              { title: 'Créditos', dataIndex: 'creditosVencidos', align: 'center', width: 70 },
              { title: 'Mayor Atraso', dataIndex: 'diasMaxVencimiento', align: 'center',
                render: (v) => <Tag color={v > 90 ? 'red' : v > 60 ? 'orange' : 'gold'}>{v} días</Tag> },
              { title: '', key: 'acciones', width: 50, render: (_, r) => (
                <Button icon={<EyeOutlined />} size="small" type="link"
                  onClick={() => handleVerEstadoCuenta(r.clienteId)} />
              )},
            ]} />
        </Card>
      </>
    );
  };

  const tabItems = [
    { key: 'resumen', label: <><DollarOutlined /> Resumen General</> },
    { key: 'morosidad', label: <><WarningOutlined /> Morosidad</> },
  ];

  return (
    <div style={{ padding: '0 24px', width: '100%' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={2} className="page-title">Cuentas por Cobrar</Title>
          <Text className="page-sub">Monitoree la cartera de créditos, antigüedad de saldos y morosidad de clientes.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => activeTab === 'resumen' ? fetchResumen() : fetchMorosidad()}>
          Actualizar
        </Button>
      </div>

      <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 0 }} style={{ marginBottom: 24 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems}
          style={{ padding: '0 24px' }} tabBarStyle={{ marginBottom: 0 }} />
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}><Text type="secondary">Cargando datos...</Text></div>
        </div>
      ) : (
        activeTab === 'resumen' ? renderResumen() : renderMorosidad()
      )}

      {/* ─── Modal Estado de Cuenta ─── */}
      <Modal
        title={<Space><UserOutlined style={{ color: '#1677ff' }} /> Estado de Cuenta</Space>}
        open={estadoCuentaVisible}
        onCancel={() => { setEstadoCuentaVisible(false); setEstadoCuenta(null); }}
        footer={<Button onClick={() => { setEstadoCuentaVisible(false); setEstadoCuenta(null); }}>Cerrar</Button>}
        width={800} destroyOnClose
      >
        {loadingCuenta ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : estadoCuenta && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Cliente">{estadoCuenta.cliente?.nombre}</Descriptions.Item>
              <Descriptions.Item label="NIT">{estadoCuenta.cliente?.nit || 'CF'}</Descriptions.Item>
              <Descriptions.Item label="Teléfono">{estadoCuenta.cliente?.telefono || '—'}</Descriptions.Item>
              <Descriptions.Item label="Dirección">{estadoCuenta.cliente?.direccion || '—'}</Descriptions.Item>
            </Descriptions>

            <Row gutter={16} style={{ margin: '16px 0' }}>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#f0f5ff' }}>
                  <Text type="secondary">Total Facturado</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>
                    {formatCurrency(estadoCuenta.resumen?.totalFacturado)}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#f6ffed' }}>
                  <Text type="secondary">Total Abonado</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#52c41a' }}>
                    {formatCurrency(estadoCuenta.resumen?.totalAbonado)}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" style={{ textAlign: 'center', background: '#fff2f0' }}>
                  <Text type="secondary">Saldo Pendiente</Text>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#ef4444' }}>
                    {formatCurrency(estadoCuenta.resumen?.totalDeuda)}
                  </div>
                </Card>
              </Col>
            </Row>

            <Divider>Créditos</Divider>
            <Table dataSource={estadoCuenta.creditos} rowKey="_id" size="small" pagination={false}
              columns={[
                { title: 'Venta', key: 'venta', render: (_, r) => <Tag>{r.ventaId?.numeroVenta || '—'}</Tag> },
                { title: 'Monto', dataIndex: 'montoTotal', render: (v) => formatCurrency(v) },
                { title: 'Saldo', dataIndex: 'saldoPendiente',
                  render: (v) => <Text strong style={{ color: v > 0 ? '#ef4444' : '#52c41a' }}>{formatCurrency(v)}</Text> },
                { title: 'Estado', dataIndex: 'estado',
                  render: (v) => <Tag color={v === 'pagado' ? 'green' : v === 'vencido' ? 'red' : 'orange'}>{v}</Tag> },
                { title: 'Vencimiento', dataIndex: 'fechaVencimiento', render: (v) => formatDate(v) },
                { title: 'Abonos', dataIndex: 'abonos', render: (v) => <Tag>{v?.length || 0}</Tag> },
              ]} />

            {estadoCuenta.historialAbonos?.length > 0 && (
              <>
                <Divider>Historial de Abonos</Divider>
                <Table dataSource={estadoCuenta.historialAbonos} rowKey={(r, i) => i} size="small"
                  pagination={{ pageSize: 5 }}
                  columns={[
                    { title: 'Fecha', dataIndex: 'fecha', render: (v) => formatDateTime(v) },
                    { title: 'Venta', dataIndex: 'numeroVenta', render: (v) => <Tag>{v}</Tag> },
                    { title: 'Monto', dataIndex: 'monto',
                      render: (v) => <Text strong style={{ color: '#52c41a' }}>{formatCurrency(v)}</Text> },
                    { title: 'Método', dataIndex: 'metodoPago',
                      render: (v) => <Tag>{v}</Tag> },
                  ]} />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
