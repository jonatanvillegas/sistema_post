import React, { useState, useEffect } from 'react';
import { 
  Table, Typography, Tag, Button, Space, Input, DatePicker, 
  Card, Tooltip, Modal, Divider, Alert, Row, Col, Select
} from 'antd';
import { 
  SearchOutlined, EyeOutlined, PrinterOutlined, 
  DeleteOutlined, HistoryOutlined, ReloadOutlined
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import { getVentas, anularVenta } from '../../api/ventas.api';
import { formatCurrency } from '../../utils/formatters';
import { buildReceiptHtml } from '../../utils/receipt';
import { getPrintSettings } from '../../utils/printSettings';
import { useAuthStore } from '../../store/authStore';

const { Title, Text, Paragraph } = Typography;

export default function VentasHistoryPage() {
  const [loading, setLoading] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  
  // Filtros: Default hoy a hoy
  const [filtroBuscar, setFiltroBuscar] = useState('');
  const [filtroEstado, setFiltroEstado] = useState(undefined);
  const [filtroRango, setFiltroRango] = useState([dayjs(), dayjs()]);

  const [isDetalleModalVisible, setIsDetalleModalVisible] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);

  const isAdmin = useAuthStore((s) => s.isAdmin);

  useEffect(() => {
    loadVentas();
  }, [page, limit]);

  const loadVentas = async () => {
    setLoading(true);
    try {
      const [d0, d1] = Array.isArray(filtroRango) ? filtroRango : [];
      const desde = d0?.format ? d0.format('YYYY-MM-DD') : undefined;
      const hasta = d1?.format ? d1.format('YYYY-MM-DD') : undefined;

      const { data } = await getVentas({
        page,
        limit,
        buscar: filtroBuscar || undefined,
        estado: filtroEstado || undefined,
        desde,
        hasta,
      });
      
      setVentas(Array.isArray(data?.ventas) ? data.ventas : []);
      setTotal(Number(data?.total) || 0);
    } catch (err) {
      toast.error(err?.response?.data?.mensaje || 'Error cargando historial');
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = (venta) => {
    setVentaSeleccionada(venta);
    setIsDetalleModalVisible(true);
  };

  const handleReimprimirVenta = async (venta) => {
    try {
      const settings = getPrintSettings();
      const html = buildReceiptHtml(venta, {
        widthMm: settings.paperWidthMm || 58,
        storeName: 'Sistema POS',
      });
      
      if (window?.electronAPI?.printReceipt) {
        const r = await window.electronAPI.printReceipt(html, {
          silent: Boolean(settings.silent),
          deviceName: settings.deviceName || undefined,
          copies: settings.copies || 1,
          printBackground: true,
        });
        if (r && r.ok === false) throw new Error(r.error || 'No se pudo imprimir');
      } else {
        const w = window.open('', '_blank');
        if (!w) throw new Error('Ventana de impresión bloqueada');
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
        w.close();
      }
      toast.success('Enviado a impresión');
    } catch (err) {
      toast.error(err?.message || 'Error al imprimir');
    }
  };

  const anularVentaHistorial = async (venta) => {
    if (!venta?._id) return;
    if (!isAdmin()) {
      toast.error('Solo un administrador puede corregir/anular ventas');
      return;
    }

    let motivoValue = '';
    Modal.confirm({
      title: `Anular venta ${venta.numeroVenta}`,
      content: (
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Se anulará la venta. Solo se permite si la caja donde se registró sigue abierta.
          </Paragraph>
          <Input placeholder="Motivo (obligatorio)" onChange={(e) => (motivoValue = e.target.value)} />
        </div>
      ),
      okText: 'Anular',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        if (!motivoValue || !motivoValue.trim()) {
          toast.error('Debe ingresar un motivo');
          throw new Error('Motivo requerido');
        }

        await anularVenta(venta._id, { motivo: motivoValue.trim() });
        toast.success('Venta anulada correctamente');
        loadVentas();
      },
    });
  };

  const columns = [
    {
      title: 'Venta',
      dataIndex: 'numeroVenta',
      key: 'numeroVenta',
      render: (v, record) => (
        <Button 
          type="link" 
          onClick={() => handleVerDetalle(record)} 
          style={{ padding: 0, fontWeight: 'bold' }}
        >
          {v}
        </Button>
      ),
    },
    {
      title: 'Fecha',
      dataIndex: 'fecha',
      key: 'fecha',
      render: (v) => <Text>{v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '-'}</Text>,
    },
    {
      title: 'Cliente',
      dataIndex: ['cliente', 'nombre'],
      key: 'cliente',
      render: (_v, r) => <Text>{r?.cliente?.nombre || 'Consumidor Final'}</Text>,
    },
    {
      title: 'Pago',
      dataIndex: 'metodoPago',
      key: 'metodoPago',
      render: (v) => <Tag>{String(v || '').toUpperCase()}</Tag>,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (v) => <Text strong>{formatCurrency(Number(v) || 0)}</Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      render: (v) => (
        <Tag color={v === 'anulada' ? 'red' : 'green'}>{v === 'anulada' ? 'ANULADA' : 'COMPLETADA'}</Tag>
      ),
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="Ver Detalles">
            <Button 
              size="small" 
              icon={<EyeOutlined />} 
              onClick={() => handleVerDetalle(record)} 
            />
          </Tooltip>
          <Tooltip title="Reimprimir Recibo">
            <Button 
              size="small" 
              icon={<PrinterOutlined />} 
              onClick={() => handleReimprimirVenta(record)} 
            />
          </Tooltip>
          {isAdmin() && record.estado !== 'anulada' && (
            <Tooltip title="Anular Venta">
              <Button 
                size="small" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={() => anularVentaHistorial(record)} 
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <Title level={2} className="page-title">Historial de Ventas</Title>
          <Text className="page-sub">Consulta y gestión de ventas realizadas.</Text>
        </div>
      </div>

      <Card bordered={false} style={{ marginBottom: 20 }}>
        <Space wrap size={16}>
          <div style={{ width: 260 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Buscar</Text>
            <Input
              placeholder="VTA-000... / Cliente / NIT"
              prefix={<SearchOutlined />}
              value={filtroBuscar}
              onChange={(e) => setFiltroBuscar(e.target.value)}
              onPressEnter={() => { setPage(1); loadVentas(); }}
              allowClear
            />
          </div>
          
          <div style={{ width: 260 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Rango de Fechas</Text>
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              value={filtroRango}
              onChange={(r) => setFiltroRango(r)}
              format="YYYY-MM-DD"
              allowClear
            />
          </div>

          <div style={{ width: 160 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Estado</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Estado"
              value={filtroEstado}
              onChange={(v) => setFiltroEstado(v)}
              allowClear
              options={[
                { value: 'completada', label: 'Completada' },
                { value: 'anulada', label: 'Anulada' },
              ]}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: 20 }}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={() => { setPage(1); loadVentas(); }}>
                Buscar
              </Button>
              <Button icon={<ReloadOutlined />} onClick={() => {
                setFiltroBuscar('');
                setFiltroEstado(undefined);
                setFiltroRango([dayjs(), dayjs()]);
                setPage(1);
                setTimeout(() => loadVentas(), 100);
              }}>
                Limpiar
              </Button>
            </Space>
          </div>
        </Space>
      </Card>

      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={ventas}
          loading={loading}
          pagination={{
            current: page,
            pageSize: limit,
            total: total,
            showSizeChanger: true,
            onChange: (p, s) => { setPage(p); setLimit(s); },
          }}
          size="middle"
        />
      </Card>

      {/* Modal Detalle de Venta */}
      <Modal
        title={`Detalle de Venta: ${ventaSeleccionada?.numeroVenta}`}
        open={isDetalleModalVisible}
        onCancel={() => setIsDetalleModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetalleModalVisible(false)}>
            Cerrar
          </Button>,
          <Button 
            key="print" 
            type="primary" 
            icon={<PrinterOutlined />} 
            onClick={() => handleReimprimirVenta(ventaSeleccionada)}
          >
            Reimprimir Recibo
          </Button>
        ]}
        width={700}
        destroyOnClose
      >
        {ventaSeleccionada && (
          <div>
            <Row gutter={16} style={{ marginBottom: 20 }}>
              <Col span={12}>
                <Text type="secondary">Cliente:</Text>
                <br />
                <Text strong>{ventaSeleccionada.cliente?.nombre || 'Consumidor Final'}</Text>
                <br />
                <Text type="secondary">Fecha:</Text>
                <br />
                <Text>{dayjs(ventaSeleccionada.fecha).format('DD/MM/YYYY HH:mm:ss')}</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Text type="secondary">Estado:</Text>
                <br />
                <Tag color={ventaSeleccionada.estado === 'anulada' ? 'red' : 'green'}>
                  {ventaSeleccionada.estado?.toUpperCase() || 'COMPLETADA'}
                </Tag>
                <br />
                <Text type="secondary">Método de Pago:</Text>
                <br />
                <Tag>{ventaSeleccionada.metodoPago?.toUpperCase()}</Tag>
              </Col>
            </Row>

            <Table
              dataSource={ventaSeleccionada.productos || []}
              rowKey={(r) => r.productoId?._id || r.productoId}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Producto',
                  dataIndex: ['productoId', 'nombre'],
                  key: 'nombre',
                  render: (v, r) => v || r.nombre || 'Producto'
                },
                {
                  title: 'Cant.',
                  dataIndex: 'cantidad',
                  key: 'cantidad',
                  align: 'center',
                },
                {
                  title: 'Precio',
                  dataIndex: 'precioUnitario',
                  key: 'precio',
                  align: 'right',
                  render: (v) => formatCurrency(v)
                },
                {
                  title: 'Desc.',
                  key: 'descuento',
                  align: 'right',
                  render: (_, r) => formatCurrency(r.descuentoMonto || 0)
                },
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  align: 'right',
                  render: (v) => <Text strong>{formatCurrency(v)}</Text>
                }
              ]}
            />

            <Divider />

            <div style={{ textAlign: 'right' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Row justify="end">
                  <Col span={8}><Text>Subtotal:</Text></Col>
                  <Col span={6}><Text>{formatCurrency(ventaSeleccionada.subtotal)}</Text></Col>
                </Row>
                <Row justify="end">
                  <Col span={8}><Text>Descuento:</Text></Col>
                  <Col span={6}><Text style={{ color: '#f5222d' }}>-{formatCurrency(ventaSeleccionada.descuentoTotal || ventaSeleccionada.descuento || 0)}</Text></Col>
                </Row>
                <Row justify="end">
                  <Col span={8}><Title level={4} style={{ margin: 0 }}>TOTAL:</Title></Col>
                  <Col span={6}><Title level={4} style={{ margin: 0, color: '#1677ff' }}>{formatCurrency(ventaSeleccionada.total)}</Title></Col>
                </Row>
              </Space>
            </div>
            
            {ventaSeleccionada.estado === 'anulada' && (
              <Alert
                message="Venta Anulada"
                description={`Motivo: ${ventaSeleccionada.motivoAnulacion || 'No especificado'}`}
                type="error"
                showIcon
                style={{ marginTop: 20 }}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
