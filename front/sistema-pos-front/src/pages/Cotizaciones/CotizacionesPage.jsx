import React, { useState, useEffect } from 'react';
import {
  Table, Card, Button, Input, Space, Typography, Tag, Modal, Popconfirm,
  Badge, Row, Col, Select, DatePicker, Tooltip, Descriptions, Divider, Statistic,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  FileTextOutlined, ShoppingCartOutlined, CopyOutlined,
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, SyncOutlined, DollarOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  getCotizaciones, deleteCotizacion, cambiarEstadoCotizacion,
  convertirCotizacionAVenta, duplicarCotizacion, getEstadisticasCotizaciones,
} from '../../api/cotizaciones.api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';
import { useCajaStore } from '../../store/cajaStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const estadoConfig = {
  borrador: { color: 'default', label: 'Borrador' },
  enviada: { color: 'processing', label: 'Enviada' },
  aprobada: { color: 'success', label: 'Aprobada' },
  convertida: { color: 'blue', label: 'Convertida' },
  vencida: { color: 'warning', label: 'Vencida' },
  cancelada: { color: 'error', label: 'Cancelada' },
};

export default function CotizacionesPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todas');
  const [stats, setStats] = useState(null);
  const [detalleVisible, setDetalleVisible] = useState(false);
  const [cotizacionDetalle, setCotizacionDetalle] = useState(null);
  const { isAdmin } = useAuthStore();
  const { cajaActual } = useCajaStore();

  useEffect(() => {
    fetchData();
  }, [page, busqueda, estadoFiltro]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getCotizaciones({ page, limit: 15, buscar: busqueda, estado: estadoFiltro });
      setData(res.data.cotizaciones);
      setTotal(res.data.total);
    } catch {
      toast.error('Error al cargar cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await getEstadisticasCotizaciones();
      setStats(res.data);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCotizacion(id);
      toast.success('Cotización eliminada');
      fetchData();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al eliminar');
    }
  };

  const handleCambiarEstado = async (id, estado) => {
    try {
      await cambiarEstadoCotizacion(id, estado);
      toast.success(`Estado cambiado a: ${estadoConfig[estado]?.label}`);
      fetchData();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al cambiar estado');
    }
  };

  const handleConvertir = async (cotizacion) => {
    if (!cajaActual) {
      toast.error('Debe abrir caja antes de convertir cotización en venta');
      return;
    }
    Modal.confirm({
      title: `Convertir ${cotizacion.numeroCotizacion} en Venta`,
      content: (
        <div>
          <p>Se creará una venta por <strong>{formatCurrency(cotizacion.total)}</strong></p>
          <p>Se descontará el stock de los productos.</p>
          <p>¿Desea continuar?</p>
        </div>
      ),
      okText: 'Convertir en Venta',
      okButtonProps: { type: 'primary' },
      onOk: async () => {
        try {
          const res = await convertirCotizacionAVenta(cotizacion._id, {
            metodoPago: 'efectivo',
            montoRecibido: cotizacion.total,
            cajaId: cajaActual?._id,
          });
          toast.success('¡Cotización convertida en venta exitosamente!');
          fetchData();
          fetchStats();
        } catch (err) {
          toast.error(err.response?.data?.mensaje || 'Error al convertir');
        }
      },
    });
  };

  const handleDuplicar = async (id) => {
    try {
      await duplicarCotizacion(id);
      toast.success('Cotización duplicada como borrador');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al duplicar');
    }
  };

  const handleVerDetalle = (record) => {
    setCotizacionDetalle(record);
    setDetalleVisible(true);
  };

  const handleDescargarPDF = (cotizacion) => {
    const doc = new jsPDF();
    const cliente = cotizacion.cliente || {};
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(22, 119, 255); // Ant Design blue
    doc.text('COTIZACION', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`N°: ${cotizacion.numeroCotizacion}`, 14, 30);
    doc.text(`Fecha: ${formatDate(cotizacion.createdAt)}`, 14, 35);
    doc.text(`Vence: ${formatDate(cotizacion.fechaVencimiento)}`, 14, 40);
    
    // Client Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Cliente:', 14, 50);
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Nombre: ${cliente.nombre || 'Consumidor Final'}`, 14, 56);
    doc.text(`NIT: ${cliente.nit || 'CF'}`, 14, 61);
    if (cliente.telefono) doc.text(`Telefono: ${cliente.telefono}`, 14, 66);
    if (cliente.direccion) doc.text(`Direccion: ${cliente.direccion}`, 14, 71);
    
    // Company Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Empresa:', 120, 50);
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text('Ferreteria Gamma', 120, 56);
    doc.text('Tel: +505 1234 5678', 120, 61);
    
    // Table
    const tableColumn = ["Producto", "Codigo", "Cant.", "P. Unitario", "Subtotal"];
    const tableRows = [];
    
    cotizacion.productos.forEach(item => {
      const row = [
        item.nombre,
        item.codigo || '-',
        item.cantidad,
        formatCurrency(item.precioUnitario),
        formatCurrency(item.subtotal)
      ];
      tableRows.push(row);
    });
    
    doc.autoTable({
      startY: 85,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [22, 119, 255] },
      styles: { fontSize: 9 },
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' }
      }
    });
    
    const finalY = doc.lastAutoTable.finalY + 10;
    
    // Totals
    doc.setFontSize(10);
    doc.setTextColor(0);
    const rightMargin = 196;
    
    doc.text('Subtotal:', 140, finalY);
    doc.text(formatCurrency(cotizacion.subtotal), rightMargin, finalY, { align: 'right' });
    
    let currentY = finalY;
    if (cotizacion.descuento > 0) {
      currentY += 6;
      doc.text('Descuento:', 140, currentY);
      doc.setTextColor(245, 34, 45); // Red for discount
      doc.text(`-${formatCurrency(cotizacion.descuento)}`, rightMargin, currentY, { align: 'right' });
      doc.setTextColor(0);
    }
    
    currentY += 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(22, 119, 255);
    doc.text('TOTAL:', 140, currentY);
    doc.text(formatCurrency(cotizacion.total), rightMargin, currentY, { align: 'right' });
    
    // Notes
    currentY += 15;
    if (cotizacion.notas) {
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.setFont(undefined, 'bold');
      doc.text('Notas:', 14, currentY);
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.setFont(undefined, 'normal');
      
      const splitNotas = doc.splitTextToSize(cotizacion.notas, 180);
      doc.text(splitNotas, 14, currentY + 5);
      currentY += 5 + (splitNotas.length * 4);
    }
    
    if (cotizacion.condiciones) {
      currentY += 5;
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.setFont(undefined, 'bold');
      doc.text('Condiciones:', 14, currentY);
      doc.setFontSize(9);
      doc.setTextColor(80);
      doc.setFont(undefined, 'normal');
      
      const splitCondiciones = doc.splitTextToSize(cotizacion.condiciones, 180);
      doc.text(splitCondiciones, 14, currentY + 5);
    }
    
    doc.save(`Cotizacion_${cotizacion.numeroCotizacion}.pdf`);
  };

  const columns = [
    {
      title: 'N° Cotización',
      dataIndex: 'numeroCotizacion',
      key: 'numeroCotizacion',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: '#1677ff' }} onClick={() => handleVerDetalle(record)}>
            {text}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{formatDate(record.createdAt)}</Text>
        </Space>
      ),
    },
    {
      title: 'Cliente',
      key: 'cliente',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.cliente?.nombre}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.cliente?.nit || 'CF'}</Text>
        </Space>
      ),
    },
    {
      title: 'Items',
      key: 'items',
      align: 'center',
      width: 70,
      render: (_, record) => <Badge count={record.productos?.length || 0} showZero color="#1677ff" />,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      render: (val) => <Text strong style={{ color: '#1677ff' }}>{formatCurrency(val)}</Text>,
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
      title: 'Vence',
      dataIndex: 'fechaVencimiento',
      responsive: ['md'],
      render: (val, record) => {
        if (record.estado === 'convertida' || record.estado === 'cancelada') return '—';
        const vencida = new Date(val) < new Date();
        return <Text type={vencida ? 'danger' : undefined}>{formatDate(val)}</Text>;
      },
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small" wrap>
          <Tooltip title="Ver Detalle">
            <Button icon={<EyeOutlined />} size="small" onClick={() => handleVerDetalle(record)} />
          </Tooltip>
          <Tooltip title="Descargar PDF">
            <Button icon={<FilePdfOutlined />} size="small" style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }} onClick={() => handleDescargarPDF(record)} />
          </Tooltip>
          {record.estado === 'borrador' && (
            <>
              <Tooltip title="Editar">
                <Button icon={<EditOutlined />} size="small" type="primary" ghost
                  onClick={() => navigate(`/cotizaciones/editar/${record._id}`)} />
              </Tooltip>
              <Tooltip title="Enviar">
                <Button icon={<SendOutlined />} size="small"
                  onClick={() => handleCambiarEstado(record._id, 'enviada')} />
              </Tooltip>
            </>
          )}
          {record.estado === 'enviada' && (
            <Tooltip title="Aprobar">
              <Button icon={<CheckCircleOutlined />} size="small" style={{ color: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => handleCambiarEstado(record._id, 'aprobada')} />
            </Tooltip>
          )}
          {['aprobada', 'enviada', 'borrador'].includes(record.estado) && (
            <Tooltip title="Convertir en Venta">
              <Button icon={<ShoppingCartOutlined />} size="small" type="primary"
                onClick={() => handleConvertir(record)} />
            </Tooltip>
          )}
          <Tooltip title="Duplicar">
            <Button icon={<CopyOutlined />} size="small" onClick={() => handleDuplicar(record._id)} />
          </Tooltip>
          {record.estado !== 'convertida' && isAdmin() && (
            <Popconfirm title="¿Eliminar cotización?" onConfirm={() => handleDelete(record._id)}>
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
          <Title level={2} className="page-title">Cotizaciones / Presupuestos</Title>
          <Text className="page-sub">Cree y administre presupuestos para sus clientes. Conviértalos en ventas cuando estén aprobados.</Text>
        </div>
        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/cotizaciones/nueva')}>
          Nueva Cotización
        </Button>
      </div>

      {/* Estadísticas */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Este Mes" value={stats.resumenMes?.count || 0} suffix="cotizaciones"
                valueStyle={{ fontSize: 22, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Total Cotizado" value={stats.resumenMes?.total || 0}
                prefix="C$" precision={2} valueStyle={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Convertidas" value={stats.resumenMes?.convertidas || 0}
                valueStyle={{ fontSize: 22, fontWeight: 700, color: '#52c41a' }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card bordered={false} className="dashboard-card shadow-sm" bodyStyle={{ padding: 16 }}>
              <Statistic title="Tasa de Conversión"
                value={stats.resumenMes?.count > 0
                  ? ((stats.resumenMes.convertidas / stats.resumenMes.count) * 100).toFixed(0)
                  : 0}
                suffix="%" valueStyle={{ fontSize: 22, fontWeight: 700, color: '#722ed1' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Card bordered={false} bodyStyle={{ padding: 0 }} className="dashboard-card shadow-sm">
        <div style={{ padding: '20px 24px' }}>
          <Row gutter={16} align="middle">
            <Col xs={24} md={10}>
              <Input
                placeholder="Buscar por N° cotización, cliente..."
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                allowClear size="large" value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Col>
            <Col xs={24} md={6}>
              <Select value={estadoFiltro} onChange={(v) => { setEstadoFiltro(v); setPage(1); }}
                style={{ width: '100%' }} size="large">
                <Select.Option value="todas">Todos los estados</Select.Option>
                {Object.entries(estadoConfig).map(([key, cfg]) => (
                  <Select.Option key={key} value={key}>{cfg.label}</Select.Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={8} style={{ textAlign: 'right' }}>
              <Tag color="blue" icon={<SyncOutlined spin={loading} />}>{total} Cotizaciones</Tag>
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          className="custom-table"
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: 15,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `${t} cotizaciones`,
          }}
        />
      </Card>

      {/* Modal Detalle */}
      <Modal
        title={<Space><FileTextOutlined style={{ color: '#1677ff' }} /> Detalle: {cotizacionDetalle?.numeroCotizacion}</Space>}
        open={detalleVisible}
        onCancel={() => setDetalleVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetalleVisible(false)}>Cerrar</Button>,
          <Button key="pdf" icon={<FilePdfOutlined />} style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }} onClick={() => handleDescargarPDF(cotizacionDetalle)}>PDF</Button>,
          cotizacionDetalle && ['aprobada', 'enviada', 'borrador'].includes(cotizacionDetalle.estado) && (
            <Button key="convert" type="primary" icon={<ShoppingCartOutlined />}
              onClick={() => { setDetalleVisible(false); handleConvertir(cotizacionDetalle); }}>
              Convertir en Venta
            </Button>
          ),
        ]}
        width={750}
        destroyOnClose
      >
        {cotizacionDetalle && (
          <div>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="N° Cotización">{cotizacionDetalle.numeroCotizacion}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag color={estadoConfig[cotizacionDetalle.estado]?.color}>
                  {estadoConfig[cotizacionDetalle.estado]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Cliente">{cotizacionDetalle.cliente?.nombre}</Descriptions.Item>
              <Descriptions.Item label="NIT">{cotizacionDetalle.cliente?.nit || 'CF'}</Descriptions.Item>
              <Descriptions.Item label="Fecha">{formatDateTime(cotizacionDetalle.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Vence">{formatDate(cotizacionDetalle.fechaVencimiento)}</Descriptions.Item>
              <Descriptions.Item label="Creado por">{cotizacionDetalle.usuarioId?.nombre || '—'}</Descriptions.Item>
              {cotizacionDetalle.ventaId && (
                <Descriptions.Item label="Venta Generada">
                  <Tag color="blue">{cotizacionDetalle.ventaId.numeroVenta || cotizacionDetalle.ventaId}</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider>Productos</Divider>
            <Table
              dataSource={cotizacionDetalle.productos}
              rowKey="productoId"
              size="small"
              pagination={false}
              columns={[
                { title: 'Producto', dataIndex: 'nombre' },
                { title: 'Código', dataIndex: 'codigo', responsive: ['md'] },
                { title: 'Cant.', dataIndex: 'cantidad', align: 'center', width: 60 },
                { title: 'P. Unit.', dataIndex: 'precioUnitario', render: (v) => formatCurrency(v) },
                { title: 'Subtotal', dataIndex: 'subtotal', align: 'right', render: (v) => <Text strong>{formatCurrency(v)}</Text> },
              ]}
            />

            <div style={{ textAlign: 'right', padding: '16px 0' }}>
              <Space direction="vertical" size={4}>
                <Text>Subtotal: <Text strong>{formatCurrency(cotizacionDetalle.subtotal)}</Text></Text>
                {cotizacionDetalle.descuento > 0 && (
                  <Text style={{ color: '#f5222d' }}>Descuento: -{formatCurrency(cotizacionDetalle.descuento)}</Text>
                )}
                <Title level={4} style={{ margin: 0, color: '#1677ff' }}>Total: {formatCurrency(cotizacionDetalle.total)}</Title>
              </Space>
            </div>

            {cotizacionDetalle.notas && (
              <>
                <Divider>Notas</Divider>
                <Text>{cotizacionDetalle.notas}</Text>
              </>
            )}
            {cotizacionDetalle.condiciones && (
              <>
                <Divider>Condiciones</Divider>
                <Text type="secondary">{cotizacionDetalle.condiciones}</Text>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
