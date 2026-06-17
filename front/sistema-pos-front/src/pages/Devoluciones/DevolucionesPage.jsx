import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Card, Button, Input, Space, Typography, Tag, Modal, Row, Col,
  Select, Tooltip, Descriptions, Divider, Statistic, InputNumber, Radio,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, SyncOutlined, RollbackOutlined, SafetyCertificateOutlined,
  FileProtectOutlined, SwapOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import {
  getDevoluciones, createDevolucion, aprobarDevolucion, rechazarDevolucion,
  getProductosVenta, getEstadisticasDevoluciones,
} from '../../api/devoluciones.api';
import { getProductos } from '../../api/inventario.api';
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
  garantia: 'Garantia',
  insatisfecho: 'Cliente Insatisfecho',
  danado: 'Danado',
  otro: 'Otro',
};

const estadoProductoLabels = {
  bueno: 'Buen Estado',
  danado: 'Danado',
};

const diferenciaLabels = {
  favor_cliente: { color: 'green', text: 'Favor del cliente' },
  favor_tienda: { color: 'volcano', text: 'Favor de la tienda' },
  sin_diferencia: { color: 'blue', text: 'Sin diferencia' },
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

  const [buscarCambio, setBuscarCambio] = useState('');
  const [productosCambioOptions, setProductosCambioOptions] = useState([]);
  const [loadingCambio, setLoadingCambio] = useState(false);
  const [productosCambio, setProductosCambio] = useState([]);

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

  const buscarProductosCambio = async (value) => {
    setBuscarCambio(value);
    setLoadingCambio(true);
    try {
      const res = await getProductos({ buscar: value, limit: 20 });
      setProductosCambioOptions(Array.isArray(res.data) ? res.data : []);
    } catch {
      setProductosCambioOptions([]);
    } finally {
      setLoadingCambio(false);
    }
  };

  const handleBuscarVenta = async () => {
    if (!ventaRefBuscar) return;
    try {
      const res = await getProductosVenta(ventaRefBuscar.trim().toUpperCase());
      setVentaInfo(res.data.venta);
      setProductosDisponibles(res.data.productosDisponibles);
      setProductosSeleccionados([]);
      setProductosCambio([]);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Venta no encontrada');
      setVentaInfo(null);
      setProductosDisponibles([]);
      setProductosSeleccionados([]);
      setProductosCambio([]);
    }
  };

  const handleCambiarCantidadDev = (productoId, cantidad) => {
    setProductosSeleccionados((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId) ? { ...p, cantidad: Number(cantidad || 1) } : p
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

  const handleAgregarProductoCambio = (productoId) => {
    const producto = productosCambioOptions.find((item) => String(item._id) === String(productoId));
    if (!producto) return;

    setProductosCambio((prev) => {
      const existing = prev.find((item) => String(item.productoId) === String(producto._id));
      if (existing) return prev;
      return [
        ...prev,
        {
          productoId: producto._id,
          nombre: producto.nombre,
          codigo: producto.codigo || '',
          cantidad: 1,
          stock: Number(producto.stock || 0),
          precioUnitario: Number(producto.precioVenta || 0),
        },
      ];
    });
  };

  const handleCambiarCantidadCambio = (productoId, cantidad) => {
    setProductosCambio((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId) ? { ...p, cantidad: Number(cantidad || 1) } : p
    ));
  };

  const handleEliminarProductoCambio = (productoId) => {
    setProductosCambio((prev) => prev.filter((p) => String(p.productoId) !== String(productoId)));
  };

  const totalDevolucion = useMemo(
    () => productosSeleccionados.reduce((sum, p) => sum + (Number(p.precioUnitario || 0) * Number(p.cantidad || 0)), 0),
    [productosSeleccionados]
  );

  const totalCambio = useMemo(
    () => productosCambio.reduce((sum, p) => sum + (Number(p.precioUnitario || 0) * Number(p.cantidad || 0)), 0),
    [productosCambio]
  );

  const diferenciaMonto = Number((totalDevolucion - totalCambio).toFixed(2));
  const diferenciaTipo = diferenciaMonto > 0 ? 'favor_cliente' : diferenciaMonto < 0 ? 'favor_tienda' : 'sin_diferencia';

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
        productosCambio: productosCambio.map((p) => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          precioUnitario: p.precioUnitario,
        })),
        tipo: tipoDevolucion,
        motivoGeneral,
        reingresarStock: true,
      });
      toast.success('Devolucion registrada exitosamente');
      setCrearVisible(false);
      resetForm();
      fetchData();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al crear devolucion');
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
    setBuscarCambio('');
    setProductosCambioOptions([]);
    setProductosCambio([]);
  };

  const handleAprobar = async (id) => {
    try {
      const res = await aprobarDevolucion(id);
      const resumen = res.data?.resumen;

      if (resumen?.diferenciaTipo === 'favor_tienda') {
        toast.success(`Devolucion aprobada. Ingreso en caja: ${formatCurrency(Math.abs(resumen.diferenciaMonto || 0))}`);
      } else if (resumen?.diferenciaTipo === 'favor_cliente') {
        toast.success(`Devolucion aprobada. Nota credito: ${formatCurrency(resumen.diferenciaMonto || 0)}`);
      } else {
        toast.success('Devolucion aprobada');
      }

      fetchData();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al aprobar');
    }
  };

  const handleRechazar = async (devolucion) => {
    let motivoRechazo = '';
    Modal.confirm({
      title: `Rechazar devolucion ${devolucion.numeroDevolucion}`,
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
        toast.success('Devolucion rechazada');
        fetchData();
        fetchStats();
      },
    });
  };

  const columns = [
    {
      title: 'N Devolucion',
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
        <Tag color={val === 'garantia' ? 'gold' : 'cyan'} icon={val === 'garantia' ? <SafetyCertificateOutlined /> : <RollbackOutlined />}>
          {val === 'garantia' ? 'Garantia' : 'Devolucion'}
        </Tag>
      ),
    },
    {
      title: 'Total Dev.',
      dataIndex: 'totalDevolucion',
      render: (val) => <Text strong style={{ color: '#f5222d' }}>{formatCurrency(val)}</Text>,
    },
    {
      title: 'Cambio',
      dataIndex: 'totalCambio',
      responsive: ['lg'],
      render: (val) => Number(val || 0) > 0 ? <Text strong>{formatCurrency(val)}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: 'Diferencia',
      key: 'diferencia',
      render: (_, record) => {
        const cfg = diferenciaLabels[record.diferenciaTipo || 'sin_diferencia'];
        return (
          <Space direction="vertical" size={0}>
            <Tag color={cfg.color}>{cfg.text}</Tag>
            <Text strong>{formatCurrency(Math.abs(record.diferenciaMonto || 0))}</Text>
          </Space>
        );
      },
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
      title: 'Nota Credito',
      key: 'notaCredito',
      responsive: ['lg'],
      render: (_, record) => record.notaCredito?.generada
        ? <Tag color="green" icon={<FileProtectOutlined />}>{record.notaCredito.numero}</Tag>
        : <Text type="secondary">-</Text>,
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
          <Title level={2} className="page-title">Devoluciones y Garantias</Title>
          <Text className="page-sub">Gestione devoluciones, cambios por producto equivocado y stock danado sin mezclarlo con inventario vendible.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => { resetForm(); setCrearVisible(true); }}>
          Nueva Devolucion
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
                placeholder="Buscar por devolucion, venta, cliente..."
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
                <Select.Option value="devolucion">Devolucion</Select.Option>
                <Select.Option value="garantia">Garantia</Select.Option>
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
        title={<Space><RollbackOutlined style={{ color: '#f5222d' }} /> Nueva Devolucion</Space>}
        open={crearVisible}
        onCancel={() => setCrearVisible(false)}
        width={1000}
        footer={ventaInfo ? [
          <Button key="cancel" onClick={() => setCrearVisible(false)}>Cancelar</Button>,
          <Button key="create" type="primary" danger loading={creando} disabled={productosSeleccionados.length === 0} onClick={handleCrearDevolucion}>
            Registrar Devolucion ({formatCurrency(totalDevolucion)})
          </Button>,
        ] : null}
        destroyOnClose
      >
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ display: 'block', marginBottom: 8 }}>Buscar Venta por Numero</Text>
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
                <Radio.Button value="devolucion"><RollbackOutlined /> Devolucion</Radio.Button>
                <Radio.Button value="garantia"><SafetyCertificateOutlined /> Garantia</Radio.Button>
              </Radio.Group>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Motivo General</Text>
              <Input.TextArea rows={2} value={motivoGeneral} onChange={(e) => setMotivoGeneral(e.target.value)} placeholder="Describa el motivo general..." />
            </div>

            <Text strong style={{ display: 'block', marginBottom: 8 }}>Productos a devolver</Text>
            <Table
              dataSource={productosDisponibles}
              rowKey="productoId"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
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
                    ) : '-';
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
                    ) : '-';
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
                    ) : '-';
                  },
                },
                {
                  title: 'Subtotal', key: 'subtotal', width: 100, align: 'right',
                  render: (_, record) => {
                    const sel = productosSeleccionados.find((p) => String(p.productoId) === String(record.productoId));
                    return sel ? <Text strong style={{ color: '#f5222d' }}>{formatCurrency(sel.cantidad * sel.precioUnitario)}</Text> : '-';
                  },
                },
              ]}
            />

            <Divider><Space><SwapOutlined /> Producto Correcto a Entregar</Space></Divider>

            <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
              <Select
                showSearch
                value={undefined}
                placeholder="Buscar producto para cambio"
                filterOption={false}
                onSearch={buscarProductosCambio}
                onChange={handleAgregarProductoCambio}
                loading={loadingCambio}
                style={{ width: '100%' }}
                notFoundContent={loadingCambio ? 'Buscando...' : 'Sin resultados'}
                options={productosCambioOptions.map((item) => ({
                  value: item._id,
                  label: `${item.nombre}${item.codigo ? ` - ${item.codigo}` : ''} | Stock: ${Number(item.stock || 0)} | ${formatCurrency(item.precioVenta || 0)}`,
                }))}
              />
            </Space.Compact>

            <Table
              dataSource={productosCambio}
              rowKey="productoId"
              size="small"
              pagination={false}
              locale={{ emptyText: 'No se ha agregado producto de cambio' }}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Producto', dataIndex: 'nombre' },
                { title: 'Codigo', dataIndex: 'codigo', render: (v) => v || '-' },
                { title: 'Stock', dataIndex: 'stock', width: 80, align: 'center' },
                {
                  title: 'Cant. a entregar',
                  key: 'cantidad',
                  width: 150,
                  render: (_, record) => (
                    <InputNumber
                      min={1}
                      max={Math.max(1, Number(record.stock || 0))}
                      value={record.cantidad}
                      size="small"
                      style={{ width: 90 }}
                      onChange={(v) => handleCambiarCantidadCambio(record.productoId, v)}
                    />
                  ),
                },
                { title: 'P. Venta', dataIndex: 'precioUnitario', width: 110, render: (v) => formatCurrency(v) },
                {
                  title: 'Subtotal',
                  key: 'subtotal',
                  width: 120,
                  align: 'right',
                  render: (_, record) => <Text strong>{formatCurrency(record.cantidad * record.precioUnitario)}</Text>,
                },
                {
                  title: 'Accion',
                  key: 'accion',
                  width: 90,
                  render: (_, record) => (
                    <Button size="small" danger ghost onClick={() => handleEliminarProductoCambio(record.productoId)}>
                      Quitar
                    </Button>
                  ),
                },
              ]}
            />

            <Card size="small" style={{ marginTop: 16, background: '#fff7e6' }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Statistic title="Total devolucion" value={totalDevolucion} prefix="C$" precision={2} valueStyle={{ color: '#f5222d' }} />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic title="Total cambio" value={totalCambio} prefix="C$" precision={2} />
                </Col>
                <Col xs={24} md={8}>
                  <Statistic
                    title={diferenciaTipo === 'favor_cliente' ? 'Devolver al cliente' : diferenciaTipo === 'favor_tienda' ? 'Cobrar diferencia' : 'Sin diferencia'}
                    value={Math.abs(diferenciaMonto)}
                    prefix="C$"
                    precision={2}
                    valueStyle={{
                      color: diferenciaTipo === 'favor_cliente' ? '#389e0d' : diferenciaTipo === 'favor_tienda' ? '#d4380d' : '#1677ff',
                    }}
                  />
                </Col>
              </Row>
            </Card>
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
        width={900}
        destroyOnClose
      >
        {devolucionDetalle && (
          <div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="N Devolucion">{devolucionDetalle.numeroDevolucion}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={estadoConfig[devolucionDetalle.estado]?.color}>
                  {estadoConfig[devolucionDetalle.estado]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Venta Original"><Tag>{devolucionDetalle.numeroVenta}</Tag></Descriptions.Item>
              <Descriptions.Item label="Tipo">
                <Tag color={devolucionDetalle.tipo === 'garantia' ? 'gold' : 'cyan'}>
                  {devolucionDetalle.tipo === 'garantia' ? 'Garantia' : 'Devolucion'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Cliente">{devolucionDetalle.cliente?.nombre}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{formatDateTime(devolucionDetalle.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Registrado por">{devolucionDetalle.usuarioId?.nombre || '-'}</Descriptions.Item>
              {devolucionDetalle.aprobadoPor && (
                <Descriptions.Item label="Aprobado por">{devolucionDetalle.aprobadoPor.nombre}</Descriptions.Item>
              )}
              <Descriptions.Item label="Diferencia">
                <Tag color={diferenciaLabels[devolucionDetalle.diferenciaTipo || 'sin_diferencia']?.color}>
                  {diferenciaLabels[devolucionDetalle.diferenciaTipo || 'sin_diferencia']?.text}
                </Tag>
                <Text strong style={{ marginLeft: 8 }}>{formatCurrency(Math.abs(devolucionDetalle.diferenciaMonto || 0))}</Text>
              </Descriptions.Item>
              {devolucionDetalle.notaCredito?.generada && (
                <Descriptions.Item label="Nota de Credito">
                  <Tag color="green">{devolucionDetalle.notaCredito.numero} - {formatCurrency(devolucionDetalle.notaCredito.monto)}</Tag>
                </Descriptions.Item>
              )}
              {devolucionDetalle.ingresoCaja?.registrado && (
                <Descriptions.Item label="Ingreso en Caja">
                  <Tag color="green">{formatCurrency(devolucionDetalle.ingresoCaja.monto)}</Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Stock Reingresado">
                {devolucionDetalle.stockReingresado ? <Tag color="green">Si</Tag> : <Tag color="default">No</Tag>}
              </Descriptions.Item>
            </Descriptions>

            <Divider>Productos Devueltos</Divider>
            <Table
              dataSource={devolucionDetalle.productos}
              rowKey="productoId"
              size="small"
              pagination={false}
              scroll={{ x: 'max-content' }}
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

            {Array.isArray(devolucionDetalle.productosCambio) && devolucionDetalle.productosCambio.length > 0 && (
              <>
                <Divider>Productos Entregados en Cambio</Divider>
                <Table
                  dataSource={devolucionDetalle.productosCambio}
                  rowKey="productoId"
                  size="small"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    { title: 'Producto', dataIndex: 'nombre' },
                    { title: 'Cant.', dataIndex: 'cantidad', align: 'center', width: 60 },
                    { title: 'P. Unit.', dataIndex: 'precioUnitario', render: (v) => formatCurrency(v) },
                    { title: 'Subtotal', dataIndex: 'subtotal', align: 'right', render: (v) => <Text strong>{formatCurrency(v)}</Text> },
                  ]}
                />
              </>
            )}

            <div style={{ textAlign: 'right', padding: '16px 0' }}>
              <Title level={4} style={{ margin: 0, color: '#f5222d' }}>
                Total Devolucion: {formatCurrency(devolucionDetalle.totalDevolucion)}
              </Title>
              <Title level={5} style={{ margin: '8px 0 0' }}>
                Total Cambio: {formatCurrency(devolucionDetalle.totalCambio || 0)}
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
