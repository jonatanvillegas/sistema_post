import React, { useState, useEffect, useMemo } from 'react';
import { 
  Row, Col, Card, Typography, Button, Table, Tag, Modal, 
  Form, InputNumber, Space, Divider, Statistic, Input,
  Tabs, DatePicker, Empty
} from 'antd';
import { 
  CheckCircleOutlined, LockOutlined, UnlockOutlined, 
  HistoryOutlined, DollarOutlined, RiseOutlined, FallOutlined,
  CalculatorOutlined, SearchOutlined, EyeOutlined, SwapOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import { 
  getCajaActual, abrirCaja, getHistorialCaja, registrarEgreso, exportTransaccionesCaja
} from '../../api/caja.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { useCajaStore } from '../../store/cajaStore';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export default function CajaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [historialData, setHistorialData] = useState({ total: 0, cajas: [] });
  const [filtrosHistorial, setFiltrosHistorial] = useState({ desde: null, hasta: null, page: 1 });
  const [stats, setStats] = useState(null);
  const [isModalAbrirVisible, setIsModalAbrirVisible] = useState(false);
  const [isModalEgresoVisible, setIsModalEgresoVisible] = useState(false);
  const [isModalDetalleVisible, setIsModalDetalleVisible] = useState(false);
  const [selectedCajaHistorial, setSelectedCajaHistorial] = useState(null);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [loadingEgreso, setLoadingEgreso] = useState(false);
  
  const [form] = Form.useForm();
  const { cajaActual, setCajaActual, limpiarCaja } = useCajaStore();
  const { isAdmin, isCajero } = useAuthStore();

  useEffect(() => {
    fetchCajaActual();
    fetchHistorial();
  }, [filtrosHistorial.page]);

  const fetchCajaActual = async () => {
    try {
      const resActual = await getCajaActual();
      if (resActual.data) {
        setCajaActual(resActual.data.caja);
        setStats(resActual.data.resumen);
      } else {
        limpiarCaja();
        setStats(null);
      }
    } catch {
      limpiarCaja();
      setStats(null);
    }
  };

  const fetchHistorial = async () => {
    setLoading(true);
    try {
      const res = await getHistorialCaja({
        page: filtrosHistorial.page,
        desde: filtrosHistorial.desde ? filtrosHistorial.desde.format('YYYY-MM-DD') : undefined,
        hasta: filtrosHistorial.hasta ? filtrosHistorial.hasta.format('YYYY-MM-DD') : undefined
      });
      setHistorialData({ total: res.data.total, cajas: res.data.cajas });
    } catch {
      toast.error('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirCaja = async (values) => {
    try {
      const res = await abrirCaja(values);
      setCajaActual(res.data.caja);
      setIsModalAbrirVisible(false);
      toast.success('Caja abierta correctamente');
      fetchCajaActual();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al abrir caja');
    }
  };

  const handleEgreso = async (values) => {
    if (loadingEgreso) return;
    setLoadingEgreso(true);
    try {
      await registrarEgreso(values);
      toast.success('Egreso registrado correctamente');
      setIsModalEgresoVisible(false);
      form.resetFields();
      fetchCajaActual();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al registrar egreso');
    } finally {
      setLoadingEgreso(false);
    }
  };

  const descargarReporteTransacciones = async () => {
    const desde = filtrosHistorial.desde ? filtrosHistorial.desde.format('YYYY-MM-DD') : null;
    const hasta = filtrosHistorial.hasta ? filtrosHistorial.hasta.format('YYYY-MM-DD') : null;

    if (!desde || !hasta) {
      toast.error('Seleccione un rango de fechas para el reporte');
      return;
    }

    setLoadingReporte(true);
    try {
      const res = await exportTransaccionesCaja({ desde, hasta });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transacciones_caja_${desde}_a_${hasta}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Reporte descargado');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo descargar el reporte');
    } finally {
      setLoadingReporte(false);
    }
  };

  const movimientosTurno = useMemo(() => {
    if (!cajaActual) return [];
    const ingresos = (cajaActual.ingresos || []).map(m => ({
      ...m,
      realTipo: m.tipo === 'venta_credito' ? 'info' : 'ingreso',
      key: `ing-${m._id}`
    }));
    const egresos = (cajaActual.egresos || []).map(m => ({ ...m, realTipo: 'egreso', key: `egr-${m._id}` }));
    return [...ingresos, ...egresos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [cajaActual]);

  const columnsMovimientos = [
    { 
      title: 'Hora', 
      dataIndex: 'createdAt', 
      width: 100,
      render: val => dayjs(val).format('HH:mm') 
    },
    { 
      title: 'Concepto / Detalles', 
      dataIndex: 'concepto',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13 }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.tipo === 'venta_credito' ? 'PEDIDO (CRÉDITO)' : record.tipo.toUpperCase()}
          </Text>
        </Space>
      )
    },
    { 
      title: 'Monto', 
      dataIndex: 'monto', 
      align: 'right',
      render: (val, record) => (
        <Text
          strong
          style={{
            color:
              record.realTipo === 'ingreso'
                ? '#52c41a'
                : record.realTipo === 'egreso'
                ? '#f5222d'
                : '#8c8c8c',
          }}
        >
          {record.realTipo === 'ingreso' ? '+' : record.realTipo === 'egreso' ? '-' : '•'} {formatCurrency(val)}
        </Text>
      )
    }
  ];

  const columnsHistorial = [
    { title: 'Apertura', dataIndex: 'fechaApertura', render: val => formatDateTime(val) },
    { title: 'Cierre', dataIndex: 'fechaCierre', render: val => val ? formatDateTime(val) : <Tag color="green">ACTIVA</Tag> },
    { title: 'Cajero', dataIndex: 'usuarioApertura', render: val => val?.nombre },
    { title: 'Físico (Arqueado)', dataIndex: 'montoFinal', render: val => val ? formatCurrency(val) : '—' },
    { 
      title: 'Diferencia', 
      dataIndex: 'diferencia',
      render: val => val === null ? '—' : (
        <Tag color={Math.abs(val) < 0.1 ? 'green' : (val < 0 ? 'red' : 'orange')}>
          {formatCurrency(val)}
        </Tag>
      )
    },
    {
      title: 'Acciones',
      align: 'right',
      render: (_, record) => record.fechaCierre && (
        <Button 
          icon={<EyeOutlined />} 
          size="small" 
          onClick={() => { setSelectedCajaHistorial(record); setIsModalDetalleVisible(true); }}
        >
          Detalle
        </Button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <Title level={2} className="page-title">Gestión de Caja</Title>
          <Text className="page-sub">Arqueo multimoneda, movimientos y control de jornadas laborales.</Text>
        </div>
      </div>

      <Tabs 
        defaultActiveKey="1"
        items={[
          {
            key: '1',
            label: <span><CalculatorOutlined /> Sesión Actual</span>,
            children: (
              <Row gutter={[24, 24]}>
                <Col xs={24} lg={9}>
                  {!cajaActual ? (
                    <Card style={{ textAlign: 'center', padding: '40px 0' }}>
                      <Empty description="No hay jornada activa" />
                      <Button 
                        type="primary" 
                        size="large" 
                        icon={<UnlockOutlined />} 
                        style={{ marginTop: 20 }}
                        onClick={() => setIsModalAbrirVisible(true)}
                      >
                        Abrir Nueva Caja
                      </Button>
                    </Card>
                  ) : (
                    <Space direction="vertical" style={{ width: '100%' }} size={16}>
                      <Card bordered={false} className="caja-status-card">
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Space direction="vertical" size={0}>
                               <Text strong style={{ color: '#52c41a' }}><CheckCircleOutlined /> CAJA ABIERTA</Text>
                               <Text type="secondary" style={{ fontSize: 12 }}>Por: {cajaActual.usuarioApertura?.nombre}</Text>
                               <Text type="secondary" style={{ fontSize: 11 }}>Desde: {formatDateTime(cajaActual.fechaApertura)}</Text>
                            </Space>
                            <Button danger type="primary" icon={<LockOutlined />} onClick={() => navigate('/caja/arqueo')}>Cerrar Turno</Button>
                         </div>
                         <Divider style={{ margin: '15px 0' }} />
                         <Row gutter={[12, 12]}>
                            <Col span={12}><Statistic title="Inicial" value={cajaActual.montoInicial} prefix="C$" valueStyle={{ fontSize: 18 }} /></Col>
                            <Col span={12}><Statistic title="Ventas (+)" value={stats?.totalVentas || 0} prefix="C$" valueStyle={{ fontSize: 18, color: '#52c41a' }} /></Col>
                            <Col span={12}><Statistic title="Egresos (-)" value={stats?.totalEgresos || 0} prefix="C$" valueStyle={{ fontSize: 18, color: '#f5222d' }} /></Col>
                            <Col span={12}><Statistic title="EN CAJA" value={stats?.saldoActual || 0} prefix="C$" valueStyle={{ fontSize: 20, fontWeight: 800, color: '#1677ff' }} /></Col>
                         </Row>
                         <Button 
                          block 
                          icon={<FallOutlined />} 
                          style={{ marginTop: 20 }}
                          onClick={() => setIsModalEgresoVisible(true)}
                         >
                            Registrar Salida / Egreso
                         </Button>
                      </Card>
                    </Space>
                  )}
                </Col>
                <Col xs={24} lg={15}>
                  <Card title={<span><SwapOutlined /> Movimientos del Turno</span>} bordered={false} bodyStyle={{ padding: 0 }}>
                    <Table 
                      columns={columnsMovimientos} 
                      dataSource={movimientosTurno} 
                      pagination={{ pageSize: 15 }}
                      size="middle"
                      locale={{ emptyText: 'Sin movimientos registrados' }}
                      loading={loading}
                    />
                  </Card>
                </Col>
              </Row>
            )
          },
          {
            key: '2',
            label: <span><HistoryOutlined /> Historial de Jornadas</span>,
            children: (
              <Card bordered={false}>
                <div style={{ marginBottom: 20, display: 'flex', gap: 15, alignItems: 'center' }}>
                    <DatePicker.RangePicker 
                        onChange={(dates) => setFiltrosHistorial({ ...filtrosHistorial, desde: dates?.[0], hasta: dates?.[1] })}
                        placeholder={['Fecha Inicio', 'Fecha Fin']}
                    />
                    <Button icon={<SearchOutlined />} type="primary" onClick={fetchHistorial}>Filtrar</Button>
                    <Button loading={loadingReporte} onClick={descargarReporteTransacciones}>Descargar CSV</Button>
                </div>
                <Table 
                  columns={columnsHistorial} 
                  dataSource={historialData.cajas} 
                  rowKey="_id" 
                  loading={loading}
                  pagination={{ 
                    total: historialData.total, 
                    current: filtrosHistorial.page,
                    onChange: (p) => setFiltrosHistorial({ ...filtrosHistorial, page: p })
                  }}
                />
              </Card>
            )
          }
        ]}
      />

      {/* Modal Historial Detalle */}
      <Modal
        title={<span><EyeOutlined /> Detalle de Jornada: {selectedCajaHistorial && formatDateTime(selectedCajaHistorial.fechaApertura)}</span>}
        open={isModalDetalleVisible}
        onCancel={() => setIsModalDetalleVisible(false)}
        footer={null}
        width={650}
      >
        {selectedCajaHistorial && (
            <div>
                <Row gutter={16}>
                    <Col span={6}><Statistic title="Inicial" value={selectedCajaHistorial.montoInicial} prefix="C$" /></Col>
                    <Col span={6}><Statistic title="Arqueado" value={selectedCajaHistorial.montoFinal} prefix="C$" valueStyle={{ color: '#1677ff' }} /></Col>
                    <Col span={6}><Statistic title="Tasa Cambio" value={selectedCajaHistorial.tipoCambio || 36.6} prefix="1$ =" precision={2} valueStyle={{ fontSize: 16 }} /></Col>
                    <Col span={6}><Statistic title="Diferencia" value={selectedCajaHistorial.diferencia} prefix="C$" valueStyle={{ color: selectedCajaHistorial.diferencia < 0 ? '#f5222d' : '#52c41a' }} /></Col>
                </Row>
                {Number(selectedCajaHistorial.depositoTransferencia || 0) > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <Text strong>Depósito / Transferencia:</Text>{' '}
                    <Text>{formatCurrency(selectedCajaHistorial.depositoTransferencia)}</Text>
                  </div>
                )}
                <Divider orientation="left">Desglose de Billetaje (Arqueo)</Divider>
                <Row gutter={24}>
                    <Col span={12}>
                        <Title level={5} style={{ fontSize: 14 }}>NIO - Córdobas</Title>
                        <Table 
                            size="small" 
                            pagination={false} 
                            rowKey={record => `nio-${record.denominacion}`}
                            dataSource={(selectedCajaHistorial.billetaje || []).filter(b => b.moneda === 'NIO')}
                            columns={[
                                { title: 'Moneda', dataIndex: 'moneda', render: m => <Tag color={m === 'USD' ? 'green' : 'blue'}>{m || 'NIO'}</Tag> },
                                { title: 'Denom.', dataIndex: 'denominacion', render: v => v >= 1 ? v : `${(v*100).toFixed(0)}c` },
                                { title: 'Cant.', dataIndex: 'cantidad' },
                              { title: 'Total', align: 'right', render: (_, r) => formatCurrency(round2(r.denominacion * r.cantidad)) }
                            ]}
                            summary={data => (
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0} colSpan={2}><Text strong>Total NIO</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={1} align="right">
                                  <Text strong>{formatCurrency(round2(data.reduce((sum, r) => round2(sum + round2(r.denominacion * r.cantidad)), 0)))}</Text>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            )}
                        />
                    </Col>
                    <Col span={12}>
                        <Title level={5} style={{ fontSize: 14, color: '#52c41a' }}>USD - Dólares</Title>
                        <Table 
                            size="small" 
                            pagination={false} 
                            rowKey={record => `usd-${record.denominacion}`}
                            dataSource={(selectedCajaHistorial.billetaje || []).filter(b => b.moneda === 'USD')}
                            columns={[
                                { title: 'Denom.', dataIndex: 'denominacion', render: v => `$${v}` },
                                { title: 'Cant.', dataIndex: 'cantidad' },
                                { title: 'Total', align: 'right', render: (_, r) => `$${(r.denominacion * r.cantidad).toFixed(2)}` }
                            ]}
                            summary={data => (
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0} colSpan={2}><Text strong>Total USD</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={1} align="right">
                                        <Text strong style={{ color: '#52c41a' }}>${data.reduce((sum, r) => sum + (r.denominacion * r.cantidad), 0).toFixed(2)}</Text>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            )}
                        />
                    </Col>
                </Row>
                {selectedCajaHistorial.observaciones && (
                    <div style={{ marginTop: 20 }}>
                        <Text strong>Observaciones:</Text>
                        <p>{selectedCajaHistorial.observaciones}</p>
                    </div>
                )}
            </div>
        )}
      </Modal>

      {/* Modal Apertura */}
      <Modal
        title="Apertura de Caja"
        open={isModalAbrirVisible}
        onCancel={() => setIsModalAbrirVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleAbrirCaja}>
          <Form.Item name="montoInicial" label="Efectivo Inicial" initialValue={0}>
             <InputNumber 
               style={{ width: '100%' }} 
               size="large" 
               formatter={val => `C$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
               parser={val => val.replace(/C\$\s?|(,*)/g, '')}
             />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Egreso */}
      <Modal
        title="Registrar Egreso"
        open={isModalEgresoVisible}
        onCancel={() => setIsModalEgresoVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsModalEgresoVisible(false)}>
            Cancelar
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={loadingEgreso} 
            onClick={() => form.submit()}
          >
            Registrar Egreso
          </Button>
        ]}
      >
        <Form form={form} layout="vertical" onFinish={handleEgreso}>
          <Form.Item name="monto" label="Monto" rules={[{ required: true }]}>
             <InputNumber 
               style={{ width: '100%' }} 
               size="large" 
               formatter={val => `C$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
               parser={val => val.replace(/C\$\s?|(,*)/g, '')}
             />
          </Form.Item>
          <Form.Item name="concepto" label="Concepto" rules={[{ required: true }]}>
             <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
