import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Input, Space, Typography, Tag, Modal, Row, Col,
  Select, Tooltip, Descriptions, Divider, Statistic, InputNumber, Radio,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, SyncOutlined, RollbackOutlined, SafetyCertificateOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import {
  getDevoluciones, createDevolucion, aprobarDevolucion, rechazarDevolucion,
  getProductosVenta, getEstadisticasDevoluciones,
} from '../../api/devoluciones.api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';

const { Title, Text, Paragraph } = Typography;

const estadoConfig = {
  pendiente: { color: 'warning', label: 'Pendiente' },
  aprobada: { color: 'processing', label: 'Aprobada' },
  rechazada: { color: 'error', label: 'Rechazada' },
  completada: { color: 'success', label: 'Completada' },
};

const motivoLabels = {
  defectuoso: 'Defectuoso',
  equivocado: 'Producto Equivocado',
  garantia: 'Garantía',
  insatisfecho: 'Cliente Insatisfecho',
  danado: 'Dañado',
  sobrante_obra: 'Sobrante de Obra',
  otro: 'Otro',
};

const estadoProductoLabels = {
  bueno: 'Buen Estado',
  danado: 'Dañado',
};

export default function DevolucionesPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todas');
  const [tipoFiltro, setTipoFiltro] = useState('todas');
  const [stats, setStats] = useState(null);

  const [crearVisible, setCrearVisible] = useState(false);
  const [ventaRefBuscar, setVentaRefBuscar] = useState('');
  const [ventaInfo, setVentaInfo] = useState(null);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [tipoDevolucion, setTipoDevolucion] = useState('devolucion');
  const [motivoGeneral, setMotivoGeneral] = useState('');
  const [creando, setCreando] = useState(false);

  const [detalleVisible, setDetalleVisible] = useState(false);
  const [devolucionDetalle, setDevolucionDetalle] = useState(null);

  const { isAdmin } = useAuthStore();

  useEffect(() => { fetchData(); }, [page, busqueda, estadoFiltro, tipoFiltro]);
  useEffect(() => { fetchStats(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getDevoluciones({ page, limit: 15, buscar: busqueda, estado: estadoFiltro, tipo: tipoFiltro });
      setData(res.data.devoluciones);
      setTotal(res.data.total);
    } catch {
      toast.error('Error al cargar devoluciones');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await getEstadisticasDevoluciones();
      setStats(res.data);
    } catch {
      setStats(null);
    }
  };

  const handleBuscarVenta = async () => {
    if (!ventaRefBuscar) return;
    try {
      const res = await getProductosVenta(ventaRefBuscar.trim().toUpperCase());
      setVentaInfo(res.data.venta);
      setProductosDisponibles(res.data.productosDisponibles);
      setProductosSeleccionados([]);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Venta no encontrada');
      setVentaInfo(null);
      setProductosDisponibles([]);
    }
  };

  const handleCambiarCantidadDev = (productoId, cantidad) => {
    setProductosSeleccionados((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId) ? { ...p, cantidad } : p
    ));
  };

  const handleCambiarMotivo = (productoId, motivo) => {
    setProductosSeleccionados((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId) ? { ...p, motivo } : p
    ));
  };

  const handleCambiarEstadoProducto = (productoId, estadoProducto) => {
    setProductosSeleccionados((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId) ? { ...p, estadoProducto } : p
    ));
  };

  const handleCrearDevolucion = async () => {
    if (productosSeleccionados.length === 0) {
      toast.error('Seleccione al menos un producto');
      return;
    }
    setCreando(true);
    try {
      await createDevolucion({
        ventaId: ventaInfo._id,
        productos: productosSeleccionados.map((p) => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          motivo: p.motivo,
          motivoDetalle: p.motivoDetalle,
          estadoProducto: p.estadoProducto || 'bueno',
        })),
        tipo: tipoDevolucion,
        motivoGeneral,
        reingresarStock: true,
      });
      toast.success('Devolución registrada exitosamente');
      setCrearVisible(false);
      resetForm();
      fetchData();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al crear devolución');
    } finally {
      setCreando(false);
    }
  };

  const resetForm = () => {
    setVentaRefBuscar('');
    setVentaInfo(null);
    setProductosDisponibles([]);
    setProductosSeleccionados([]);
    setTipoDevolucion('devolucion');
    setMotivoGeneral('');
  };

  const handleAprobar = async (id) => {
    try {
      await aprobarDevolucion(id);
      toast.success('Devolución aprobada');
      fetchData();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al aprobar');
    }
  };

  const handleRechazar = async (devolucion) => {
    let motivoRechazo = '';
    Modal.confirm({
      title: `Rechazar devolución ${devolucion.numeroDevolucion}`,
      content: (
        <div>
          <Paragraph>Ingrese el motivo del rechazo:</Paragraph>
          <Input.TextArea rows={3} placeholder="Motivo del rechazo..." onChange={(e) => { motivoRechazo = e.target.value; }} />
        </div>
      ),
      okText: 'Rechazar',
      okButtonProps: { danger: true },
      onOk: async () => {
        await rechazarDevolucion(devolucion._id, { motivo: motivoRechazo });
        toast.success('Devolución rechazada');
        fetchData();
        fetchStats();
      },
    });
  };

  const totalDevolucion = productosSeleccionados.reduce((sum, p) => sum + p.precioUnitario * p.cantidad, 0);

  const columns = [
    {
      title: 'N° Devolución',
      dataIndex: 'numeroDevolucion',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => { setDevolucionDetalle(record); setDetalleVisible(true); }}>
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(record.createdAt)}</Text>
        </Space>
      ),
    },
    {
      title: 'Venta Original',
      dataIndex: 'numeroVenta',
      render: (val) => <Tag>{val}</Tag>,
    },
    {
      title: 'Cliente',
      key: 'cliente',
      render: (_, record) => <Text>{record.cliente?.nombre}</Text>,
      responsive: ['md'],
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo',
      width: 130,
      render: (val) => (
        <Tag color={val === 'garantia' ? 'gold' : val === 'sobrante_obra' ? 'purple' : 'cyan'} icon={val === 'garantia' ? <SafetyCertificateOutlined /> : <RollbackOutlined />}>
          {val === 'garantia' ? 'Garantía' : val === 'sobrante_obra' ? 'Sobrante de Obra' : 'Devolución'}
        </Tag>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'totalDevolucion',
      render: (val) => <Text strong style={{ color: '#f5222d' }}>{formatCurrency(val)}</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      render: (val) => {
        const cfg = estadoConfig[val] || {};
        return <Tag color={cfg.color}>{cfg.label || val}</Tag>;
      },
    },
    {
      title: 'Nota Crédito',
      key: 'notaCredito',
      responsive: ['lg'],
      render: (_, record) => record.notaCredito?.generada
        ? <Tag color="green" icon={<FileProtectOutlined />}>{record.notaCredito.numero}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Ver Detalle">
            <Button icon={<EyeOutlined />} size="small" onClick={() => { setDevolucionDetalle(record); setDetalleVisible(true); }} />
          </Tooltip>
          {record.estado === 'pendiente' && isAdmin() && (
            <>
              <Tooltip title="Aprobar">
                <Button icon={<CheckCircleOutlined />} size="small" style={{ color: '#52c41a', borderColor: '#52c41a' }} onClick={() => handleAprobar(record._id)} />
              </Tooltip>
              <Tooltip title="Rechazar">
                <Button icon={<CloseCircleOutlined />} size="small" danger ghost onClick={() => handleRechazar(record)} />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={2} className="page-title">Devoluciones y Garantías</Title>
          <Text className="page-sub">Gestione devoluciones de clientes y registre producto dañado sin mezclarlo con stock vendible.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => { resetForm(); setCrearVisible(true); }}>
          Nueva Devolución
        </Button>
      </div>

      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false}><Statistic title="Este Mes" value={stats.resumenMes?.count || 0} suffix="devoluciones" /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false}><Statistic title="Total Devuelto" value={stats.resumenMes?.total || 0} prefix="C$" precision={2} valueStyle={{ color: '#f5222d' }} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false}><Statistic title="Completadas" value={stats.resumenMes?.completadas || 0} valueStyle={{ color: '#52c41a' }} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false}><Statistic title="Pendientes" value={stats.resumenMes?.pendientes || 0} valueStyle={{ color: '#faad14' }} /></Card>
          </Col>
        </Row>
      )}

      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <div style={{ padding: '20px 24px' }}>
          <Row gutter={16} align="middle">
            <Col xs={24} md={8}>
              <Input
                placeholder="Buscar por N° devolución, venta, cliente..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                allowClear
                size="large"
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
              />
            </Col>
            <Col xs={12} md={5}>
              <Select value={estadoFiltro} onChange={(v) => { setEstadoFiltro(v); setPage(1); }} style={{ width: '100%' }} size="large">
                <Select.Option value="todas">Todos</Select.Option>
                {Object.entries(estadoConfig).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v.label}</Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={12} md={5}>
              <Select value={tipoFiltro} onChange={(v) => { setTipoFiltro(v); setPage(1); }} style={{ width: '100%' }} size="large">
                <Select.Option value="todas">Todos los tipos</Select.Option>
                <Select.Option value="devolucion">Devolución</Select.Option>
                <Select.Option value="garantia">Garantía</Select.Option>
                <Select.Option value="sobrante_obra">Sobrante de Obra</Select.Option>
              </Select>
            </Col>
            <Col xs={24} md={6} style={{ textAlign: 'right' }}>
              <Tag color="blue" icon={<SyncOutlined spin={loading} />}>{total} Devoluciones</Tag>
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          pagination={{ current: page, pageSize: 15, total, onChange: (p) => setPage(p) }}
        />
      </Card>

      <Modal
        title={<Space><RollbackOutlined style={{ color: '#f5222d' }} /> Nueva Devolución</Space>}
        open={crearVisible}
        onCancel={() => setCrearVisible(false)}
        width={860}
        footer={ventaInfo ? [
          <Button key="cancel" onClick={() => setCrearVisible(false)}>Cancelar</Button>,
          <Button key="create" type="primary" danger loading={creando} disabled={productosSeleccionados.length === 0} onClick={handleCrearDevolucion}>
            Registrar Devolución ({formatCurrency(totalDevolucion)})
          </Button>,
        ] : null}
        destroyOnClose
      >
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Buscar Venta por Número</Text>
          <Space.Compact style={{ width: '100%' }}>
            <Input placeholder="Ej: VTA-000060" value={ventaRefBuscar} onChange={(e) => setVentaRefBuscar(e.target.value)} onPressEnter={handleBuscarVenta} />
            <Button type="primary" icon={<SearchOutlined />} onClick={handleBuscarVenta}>Buscar</Button>
          </Space.Compact>
        </div>

        {ventaInfo && (
          <>
            <Card size="small" style={{ marginBottom: 16, background: '#f8fafc' }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Venta">{ventaInfo.numeroVenta}</Descriptions.Item>
                <Descriptions.Item label="Total">{formatCurrency(ventaInfo.total)}</Descriptions.Item>
                <Descriptions.Item label="Cliente">{ventaInfo.cliente?.nombre}</Descriptions.Item>
                <Descriptions.Item label="Fecha">{formatDate(ventaInfo.fecha)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Tipo</Text>
              <Radio.Group value={tipoDevolucion} onChange={(e) => setTipoDevolucion(e.target.value)}>
                <Radio.Button value="devolucion"><RollbackOutlined /> Devolución</Radio.Button>
                <Radio.Button value="garantia"><SafetyCertificateOutlined /> Garantía</Radio.Button>
                <Radio.Button value="sobrante_obra"><RollbackOutlined /> Sobrante de Obra</Radio.Button>
              </Radio.Group>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Motivo General</Text>
              <Input.TextArea rows={2} value={motivoGeneral} onChange={(e) => setMotivoGeneral(e.target.value)} placeholder="Describa el motivo general..." />
            </div>

            <Text strong style={{ display: 'block', marginBottom: 8 }}>Productos disponibles para devolver</Text>
            <Table
              dataSource={productosDisponibles}
              rowKey="productoId"
              size="small"
              pagination={false}
              rowSelection={{
                selectedRowKeys: productosSeleccionados.map((p) => p.productoId),
                onChange: (_, selectedRows) => {
                  setProductosSeleccionados(selectedRows.map((prod) => {
                    const existing = productosSeleccionados.find((p) => String(p.productoId) === String(prod.productoId));
                    return existing || {
                      productoId: prod.productoId,
                      nombre: prod.nombre,
                      cantidad: 1,
                      cantidadDisponible: prod.cantidadDisponible,
                      precioUnitario: prod.precioUnitario,
                      motivo: 'otro',
                      estadoProducto: 'bueno',
                    };
                  }));
                },
              }}
              columns={[
                { title: 'Producto', dataIndex: 'nombre' },
                { title: 'Disp.', dataIndex: 'cantidadDisponible', width: 60, align: 'center' },
                {
                  title: 'Cant. a devolver', key: 'cantDev', width: 130,
                  render: (_, record) => {
                    const sel = productosSeleccionados.find((p) => String(p.productoId) === String(record.productoId));
                    return sel ? (
                      <InputNumber min={1} max={record.cantidadDisponible} value={sel.cantidad} size="small" style={{ width: 80 }} onChange={(v) => handleCambiarCantidadDev(record.productoId, v)} />
                    ) : '—';
                  },
                },
                {
                  title: 'Motivo', key: 'motivo', width: 160,
                  render: (_, record) => {
                    const sel = productosSeleccionados.find((p) => String(p.productoId) === String(record.productoId));
                    return sel ? (
                      <Select size="small" value={sel.motivo} style={{ width: 140 }} onChange={(v) => handleCambiarMotivo(record.productoId, v)}>
                        {Object.entries(motivoLabels).map(([k, v]) => (
                          <Select.Option key={k} value={k}>{v}</Select.Option>
                        ))}
                      </Select>
                    ) : '—';
                  },
                },
                {
                  title: 'Estado', key: 'estadoProducto', width: 150,
                  render: (_, record) => {
                    const sel = productosSeleccionados.find((p) => String(p.productoId) === String(record.productoId));
                    return sel ? (
                      <Select size="small" value={sel.estadoProducto || 'bueno'} style={{ width: 130 }} onChange={(v) => handleCambiarEstadoProducto(record.productoId, v)}>
                        {Object.entries(estadoProductoLabels).map(([k, v]) => (
                          <Select.Option key={k} value={k}>{v}</Select.Option>
                        ))}
                      </Select>
                    ) : '—';
                  },
                },
                {
                  title: 'Subtotal', key: 'subtotal', width: 100, align: 'right',
                  render: (_, record) => {
                    const sel = productosSeleccionados.find((p) => String(p.productoId) === String(record.productoId));
                    return sel ? <Text strong style={{ color: '#f5222d' }}>{formatCurrency(sel.cantidad * sel.precioUnitario)}</Text> : '—';
                  },
                },
              ]}
            />
          </>
        )}
      </Modal>

      <Modal
        title={<Space><RollbackOutlined style={{ color: '#f5222d' }} /> Detalle: {devolucionDetalle?.numeroDevolucion}</Space>}
        open={detalleVisible}
        onCancel={() => setDetalleVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetalleVisible(false)}>Cerrar</Button>,
          devolucionDetalle?.estado === 'pendiente' && isAdmin() && (
            <Button key="approve" type="primary" icon={<CheckCircleOutlined />} onClick={() => { setDetalleVisible(false); handleAprobar(devolucionDetalle._id); }}>
              Aprobar
            </Button>
          ),
        ]}
        width={780}
        destroyOnClose
      >
        {devolucionDetalle && (
          <div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="N° Devolución">{devolucionDetalle.numeroDevolucion}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={estadoConfig[devolucionDetalle.estado]?.color}>
                  {estadoConfig[devolucionDetalle.estado]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Venta Original"><Tag>{devolucionDetalle.numeroVenta}</Tag></Descriptions.Item>
              <Descriptions.Item label="Tipo">
                <Tag color={devolucionDetalle.tipo === 'garantia' ? 'gold' : devolucionDetalle.tipo === 'sobrante_obra' ? 'purple' : 'cyan'}>
                  {devolucionDetalle.tipo === 'garantia' ? 'Garantía' : devolucionDetalle.tipo === 'sobrante_obra' ? 'Sobrante de Obra' : 'Devolución'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Cliente">{devolucionDetalle.cliente?.nombre}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{formatDateTime(devolucionDetalle.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Registrado por">{devolucionDetalle.usuarioId?.nombre || '—'}</Descriptions.Item>
              {devolucionDetalle.aprobadoPor && (
                <Descriptions.Item label="Aprobado por">{devolucionDetalle.aprobadoPor.nombre}</Descriptions.Item>
              )}
              {devolucionDetalle.notaCredito?.generada && (
                <Descriptions.Item label="Nota de Crédito">
                  <Tag color="green">{devolucionDetalle.notaCredito.numero} — {formatCurrency(devolucionDetalle.notaCredito.monto)}</Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Stock Reingresado">
                {devolucionDetalle.stockReingresado ? <Tag color="green">Sí</Tag> : <Tag color="default">No</Tag>}
              </Descriptions.Item>
            </Descriptions>

            <Divider>Productos Devueltos</Divider>
            <Table
              dataSource={devolucionDetalle.productos}
              rowKey="productoId"
              size="small"
              pagination={false}
              columns={[
                { title: 'Producto', dataIndex: 'nombre' },
                { title: 'Cant.', dataIndex: 'cantidad', align: 'center', width: 60 },
                { title: 'P. Unit.', dataIndex: 'precioUnitario', render: (v) => formatCurrency(v) },
                { title: 'Motivo', dataIndex: 'motivo', render: (v) => <Tag>{motivoLabels[v] || v}</Tag> },
                {
                  title: 'Estado',
                  dataIndex: 'estadoProducto',
                  render: (v) => <Tag color={v === 'danado' ? 'volcano' : 'green'}>{estadoProductoLabels[v] || v}</Tag>,
                },
                { title: 'Subtotal', dataIndex: 'subtotal', align: 'right', render: (v) => <Text strong style={{ color: '#f5222d' }}>{formatCurrency(v)}</Text> },
              ]}
            />

            <div style={{ textAlign: 'right', padding: '16px 0' }}>
              <Title level={4} style={{ margin: 0, color: '#f5222d' }}>
                Total Devolución: {formatCurrency(devolucionDetalle.totalDevolucion)}
              </Title>
            </div>

            {devolucionDetalle.motivoGeneral && (
              <>
                <Divider>Motivo General</Divider>
                <Text>{devolucionDetalle.motivoGeneral}</Text>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
