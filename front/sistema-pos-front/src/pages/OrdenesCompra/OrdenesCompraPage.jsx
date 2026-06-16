import React, { useState, useEffect } from 'react';
import {
  Table, Card, Button, Input, Space, Typography, Tag, Modal, Popconfirm,
  Row, Col, Select, Tooltip, Descriptions, Divider, InputNumber, Badge, Progress,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  SyncOutlined, TruckOutlined, CheckCircleOutlined, CloseCircleOutlined,
  InboxOutlined, SendOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  getOrdenesCompra, deleteOrdenCompra, cancelarOrdenCompra, recibirMercaderia,
} from '../../api/ordenesCompra.api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;

const estadoConfig = {
  borrador: { color: 'default', label: 'Borrador' },
  enviada: { color: 'processing', label: 'Enviada' },
  parcial: { color: 'warning', label: 'Parcial' },
  recibida: { color: 'success', label: 'Recibida' },
  cancelada: { color: 'error', label: 'Cancelada' },
};

export default function OrdenesCompraPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todas');
  const { isAdmin } = useAuthStore();

  // Modal detalle
  const [detalleVisible, setDetalleVisible] = useState(false);
  const [ordenDetalle, setOrdenDetalle] = useState(null);

  // Modal recepción
  const [recepcionVisible, setRecepcionVisible] = useState(false);
  const [ordenRecepcion, setOrdenRecepcion] = useState(null);
  const [cantidadesRecepcion, setCantidadesRecepcion] = useState({});
  const [recibiendo, setRecibiendo] = useState(false);

  useEffect(() => { fetchData(); }, [page, busqueda, estadoFiltro]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getOrdenesCompra({ page, limit: 15, buscar: busqueda, estado: estadoFiltro });
      setData(res.data.ordenes);
      setTotal(res.data.total);
    } catch { toast.error('Error al cargar órdenes'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteOrdenCompra(id);
      toast.success('Orden eliminada');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al eliminar');
    }
  };

  const handleCancelar = async (orden) => {
    Modal.confirm({
      title: `Cancelar orden ${orden.numeroOrden}`,
      content: '¿Está seguro de cancelar esta orden de compra?',
      okText: 'Cancelar Orden',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await cancelarOrdenCompra(orden._id, { motivo: 'Cancelada por administrador' });
          toast.success('Orden cancelada');
          fetchData();
        } catch (err) {
          toast.error(err.response?.data?.mensaje || 'Error al cancelar');
        }
      },
    });
  };

  // ─── Recepción de mercadería ───
  const abrirRecepcion = (orden) => {
    setOrdenRecepcion(orden);
    const cantidades = {};
    orden.productos.forEach((p) => {
      const faltante = p.cantidadSolicitada - p.cantidadRecibida;
      cantidades[String(p.productoId)] = faltante > 0 ? faltante : 0;
    });
    setCantidadesRecepcion(cantidades);
    setRecepcionVisible(true);
  };

  const handleRecibirMercaderia = async () => {
    const productos = Object.entries(cantidadesRecepcion)
      .filter(([_, cant]) => cant > 0)
      .map(([productoId, cantidadRecibida]) => ({ productoId, cantidadRecibida }));

    if (productos.length === 0) {
      toast.error('Indique las cantidades recibidas');
      return;
    }

    setRecibiendo(true);
    try {
      await recibirMercaderia(ordenRecepcion._id, { productos });
      toast.success('¡Mercadería recibida exitosamente! Stock actualizado.');
      setRecepcionVisible(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al recibir mercadería');
    } finally { setRecibiendo(false); }
  };

  const getProgreso = (orden) => {
    const totalSolicitado = orden.productos.reduce((s, p) => s + p.cantidadSolicitada, 0);
    const totalRecibido = orden.productos.reduce((s, p) => s + p.cantidadRecibida, 0);
    return totalSolicitado > 0 ? Math.round((totalRecibido / totalSolicitado) * 100) : 0;
  };

  const columns = [
    {
      title: 'N° Orden',
      dataIndex: 'numeroOrden',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: '#1677ff' }}
            onClick={() => { setOrdenDetalle(record); setDetalleVisible(true); }}>
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(record.createdAt)}</Text>
        </Space>
      ),
    },
    {
      title: 'Proveedor',
      key: 'proveedor',
      render: (_, r) => <Text strong>{r.proveedor?.nombre}</Text>,
    },
    {
      title: 'Items',
      key: 'items',
      align: 'center',
      width: 60,
      render: (_, r) => <Badge count={r.productos?.length} showZero color="#1677ff" />,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      render: (v) => <Text strong>{formatCurrency(v)}</Text>,
    },
    {
      title: 'Progreso',
      key: 'progreso',
      width: 130,
      render: (_, record) => {
        const pct = getProgreso(record);
        return <Progress percent={pct} size="small"
          strokeColor={pct === 100 ? '#52c41a' : pct > 0 ? '#faad14' : '#d9d9d9'}
          status={pct === 100 ? 'success' : 'normal'} />;
      },
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      render: (v) => <Tag color={estadoConfig[v]?.color}>{estadoConfig[v]?.label || v}</Tag>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="Ver Detalle">
            <Button icon={<EyeOutlined />} size="small"
              onClick={() => { setOrdenDetalle(record); setDetalleVisible(true); }} />
          </Tooltip>
          {record.estado === 'borrador' && (
            <Tooltip title="Editar">
              <Button icon={<EditOutlined />} size="small" type="primary" ghost
                onClick={() => navigate(`/ordenes-compra/editar/${record._id}`)} />
            </Tooltip>
          )}
          {['enviada', 'parcial'].includes(record.estado) && (
            <Tooltip title="Recibir Mercadería">
              <Button icon={<InboxOutlined />} size="small" type="primary"
                onClick={() => abrirRecepcion(record)} />
            </Tooltip>
          )}
          {!['recibida', 'cancelada'].includes(record.estado) && isAdmin() && (
            <Tooltip title="Cancelar">
              <Button icon={<CloseCircleOutlined />} size="small" danger ghost
                onClick={() => handleCancelar(record)} />
            </Tooltip>
          )}
          {record.estado === 'borrador' && isAdmin() && (
            <Popconfirm title="¿Eliminar orden?" onConfirm={() => handleDelete(record._id)}>
              <Tooltip title="Eliminar">
                <Button icon={<DeleteOutlined />} size="small" danger ghost />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '0 24px', width: '100%' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={2} className="page-title">Órdenes de Compra</Title>
          <Text className="page-sub">Gestione pedidos a proveedores y reciba mercadería directamente al inventario.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />}
          onClick={() => navigate('/ordenes-compra/nueva')}>
          Nueva Orden
        </Button>
      </div>

      <Card bordered={false} bodyStyle={{ padding: 0 }} className="dashboard-card shadow-sm">
        <div style={{ padding: '20px 24px' }}>
          <Row gutter={16} align="middle">
            <Col xs={24} md={10}>
              <Input placeholder="Buscar por N° orden, proveedor..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                allowClear size="large" value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
                style={{ borderRadius: 8 }} />
            </Col>
            <Col xs={24} md={6}>
              <Select value={estadoFiltro} onChange={(v) => { setEstadoFiltro(v); setPage(1); }}
                style={{ width: '100%' }} size="large">
                <Select.Option value="todas">Todos</Select.Option>
                {Object.entries(estadoConfig).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v.label}</Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={8} style={{ textAlign: 'right' }}>
              <Tag color="blue" icon={<SyncOutlined spin={loading} />}>{total} Órdenes</Tag>
            </Col>
          </Row>
        </div>

        <Table columns={columns} dataSource={data} rowKey="_id" loading={loading}
          className="custom-table" scroll={{ x: 1000 }}
          pagination={{ current: page, pageSize: 15, total, onChange: (p) => setPage(p) }} />
      </Card>

      {/* ─── Modal Detalle ─── */}
      <Modal
        title={<Space><TruckOutlined style={{ color: '#1677ff' }} /> Orden: {ordenDetalle?.numeroOrden}</Space>}
        open={detalleVisible} onCancel={() => setDetalleVisible(false)}
        width={800} destroyOnClose
        footer={[
          <Button key="close" onClick={() => setDetalleVisible(false)}>Cerrar</Button>,
          ordenDetalle && ['enviada', 'parcial'].includes(ordenDetalle.estado) && (
            <Button key="receive" type="primary" icon={<InboxOutlined />}
              onClick={() => { setDetalleVisible(false); abrirRecepcion(ordenDetalle); }}>
              Recibir Mercadería
            </Button>
          ),
        ]}
      >
        {ordenDetalle && (
          <div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="N° Orden">{ordenDetalle.numeroOrden}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={estadoConfig[ordenDetalle.estado]?.color}>{estadoConfig[ordenDetalle.estado]?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Proveedor">{ordenDetalle.proveedor?.nombre}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{formatDateTime(ordenDetalle.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Progreso">
                <Progress percent={getProgreso(ordenDetalle)} size="small" />
              </Descriptions.Item>
              <Descriptions.Item label="Creado por">{ordenDetalle.usuarioId?.nombre || '—'}</Descriptions.Item>
            </Descriptions>

            <Divider>Productos</Divider>
            <Table dataSource={ordenDetalle.productos} rowKey="productoId" size="small" pagination={false}
              columns={[
                { title: 'Producto', dataIndex: 'nombre' },
                { title: 'Código', dataIndex: 'codigo', responsive: ['md'] },
                { title: 'Solicitado', dataIndex: 'cantidadSolicitada', align: 'center', width: 90 },
                { title: 'Recibido', dataIndex: 'cantidadRecibida', align: 'center', width: 90,
                  render: (v, r) => (
                    <Text strong style={{ color: v >= r.cantidadSolicitada ? '#52c41a' : v > 0 ? '#faad14' : '#d9d9d9' }}>
                      {v}
                    </Text>
                  ),
                },
                { title: 'P. Unit.', dataIndex: 'precioUnitario', render: (v) => formatCurrency(v) },
                { title: 'Subtotal', dataIndex: 'subtotal', align: 'right', render: (v) => <Text strong>{formatCurrency(v)}</Text> },
              ]} />

            <div style={{ textAlign: 'right', padding: '16px 0' }}>
              <Title level={4} style={{ margin: 0, color: '#1677ff' }}>Total: {formatCurrency(ordenDetalle.total)}</Title>
            </div>

            {ordenDetalle.recepciones?.length > 0 && (
              <>
                <Divider>Historial de Recepciones</Divider>
                {ordenDetalle.recepciones.map((rec, i) => (
                  <Card key={rec._id || i} size="small" style={{ marginBottom: 8, background: '#f8fafc' }}>
                    <Text strong>Recepción #{i + 1}</Text> — <Text type="secondary">{formatDateTime(rec.fecha)}</Text>
                    {rec.usuarioId && <Text type="secondary"> por {rec.usuarioId.nombre || rec.usuarioId}</Text>}
                    <div style={{ marginTop: 4 }}>
                      {rec.productos?.map((p, j) => (
                        <Tag key={j} style={{ margin: 2 }}>{p.nombre}: +{p.cantidadRecibida}</Tag>
                      ))}
                    </div>
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ─── Modal Recepción ─── */}
      <Modal
        title={<Space><InboxOutlined style={{ color: '#52c41a' }} /> Recibir Mercadería: {ordenRecepcion?.numeroOrden}</Space>}
        open={recepcionVisible} onCancel={() => setRecepcionVisible(false)}
        width={650} destroyOnClose
        footer={[
          <Button key="cancel" onClick={() => setRecepcionVisible(false)}>Cancelar</Button>,
          <Button key="receive" type="primary" loading={recibiendo} icon={<CheckCircleOutlined />}
            onClick={handleRecibirMercaderia}>
            Confirmar Recepción
          </Button>,
        ]}
      >
        {ordenRecepcion && (
          <Table dataSource={ordenRecepcion.productos} rowKey="productoId" size="small" pagination={false}
            columns={[
              { title: 'Producto', dataIndex: 'nombre' },
              { title: 'Solicitado', dataIndex: 'cantidadSolicitada', align: 'center', width: 80 },
              { title: 'Ya Recibido', dataIndex: 'cantidadRecibida', align: 'center', width: 90 },
              { title: 'Faltante', key: 'faltante', align: 'center', width: 70,
                render: (_, r) => <Text type="warning">{r.cantidadSolicitada - r.cantidadRecibida}</Text> },
              { title: 'Recibir Ahora', key: 'recibir', width: 120, align: 'center',
                render: (_, r) => {
                  const faltante = r.cantidadSolicitada - r.cantidadRecibida;
                  return faltante > 0 ? (
                    <InputNumber min={0} max={faltante} size="small" style={{ width: 80 }}
                      value={cantidadesRecepcion[String(r.productoId)] || 0}
                      onChange={(v) => setCantidadesRecepcion(prev => ({
                        ...prev, [String(r.productoId)]: v,
                      }))} />
                  ) : <Tag color="green">Completo</Tag>;
                },
              },
            ]} />
        )}
      </Modal>
    </div>
  );
}
