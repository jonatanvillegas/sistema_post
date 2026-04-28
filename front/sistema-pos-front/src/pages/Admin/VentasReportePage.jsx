import React, { useMemo, useState } from 'react';
import { Card, DatePicker, Button, Table, Typography, Space, Tag, Select, Modal, Divider, Tooltip, Alert, Row, Col } from 'antd';
import { EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { getVentasReporteAdmin } from '../../api/ventas.api';
import { formatCurrency } from '../../utils/formatters';
import { buildReceiptHtml } from '../../utils/receipt';
import { getPrintSettings } from '../../utils/printSettings';

const { Title, Text } = Typography;

export default function VentasReportePage() {
  const [rango, setRango] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totales, setTotales] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [filtroDescuento, setFiltroDescuento] = useState('todas');
  const [isDetalleModalVisible, setIsDetalleModalVisible] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);

  const canFetch = useMemo(() => Array.isArray(rango) && rango[0] && rango[1], [rango]);

  const ventasFiltradas = useMemo(() => {
    const list = Array.isArray(ventas) ? ventas : [];
    if (filtroDescuento === 'con') return list.filter((v) => Number(v?.descuento) > 0);
    if (filtroDescuento === 'sin') return list.filter((v) => Number(v?.descuento) === 0);
    return list;
  }, [ventas, filtroDescuento]);

  const fetchReporte = async () => {
    if (!canFetch) {
      toast.error('Seleccione un rango de fechas');
      return;
    }

    const desde = rango[0].format('YYYY-MM-DD');
    const hasta = rango[1].format('YYYY-MM-DD');

    setLoading(true);
    try {
      const { data } = await getVentasReporteAdmin({ desde, hasta });
      setTotales(data?.totales || null);
      setVentas(Array.isArray(data?.ventas) ? data.ventas : []);
    } catch (err) {
      toast.error(err?.response?.data?.mensaje || 'Error al cargar reporte');
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

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Reporte de Ventas</Title>
          <Text className="page-sub">Resumen por rango de fechas (solo Admin).</Text>
        </div>
      </div>

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Space wrap>
          <DatePicker.RangePicker
            value={rango}
            onChange={setRango}
            format="YYYY-MM-DD"
            allowClear
          />
          <Select
            value={filtroDescuento}
            onChange={setFiltroDescuento}
            style={{ width: 220 }}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'con', label: 'Con descuento' },
              { value: 'sin', label: 'Sin descuento' },
            ]}
          />
          <Button type="primary" onClick={fetchReporte} loading={loading}>
            Consultar
          </Button>
        </Space>

        {totales && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <Card size="small" bordered>
              <Text type="secondary">Total vendido</Text>
              <div><Text strong style={{ fontSize: 18 }}>{formatCurrency(totales.totalVendido || 0)}</Text></div>
            </Card>
            <Card size="small" bordered>
              <Text type="secondary">Total descuentos</Text>
              <div><Text strong style={{ fontSize: 18 }}>{formatCurrency(totales.totalDescuentos || 0)}</Text></div>
            </Card>
            <Card size="small" bordered>
              <Text type="secondary">Ventas con descuento</Text>
              <div>
                <Tag color="green">{totales.conDescuento?.count || 0}</Tag>
                <Text strong>{formatCurrency(totales.conDescuento?.total || 0)}</Text>
              </div>
            </Card>
            <Card size="small" bordered>
              <Text type="secondary">Ventas sin descuento</Text>
              <div>
                <Tag>{totales.sinDescuento?.count || 0}</Tag>
                <Text strong>{formatCurrency(totales.sinDescuento?.total || 0)}</Text>
              </div>
            </Card>
          </div>
        )}
      </Card>

      <Card bordered={false}>
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={ventasFiltradas}
          pagination={{ pageSize: 20 }}
          columns={[
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
              render: (v) => <Text>{v ? new Date(v).toLocaleString() : '-'}</Text>,
            },
            {
              title: 'Cliente',
              dataIndex: ['cliente', 'nombre'],
              key: 'cliente',
              render: (_v, r) => <Text>{r?.cliente?.nombre || 'Consumidor Final'}</Text>,
            },
            {
              title: 'Descuento',
              dataIndex: 'descuento',
              key: 'descuento',
              align: 'right',
              render: (v) => {
                const d = Number(v) || 0;
                return d > 0 ? <Text style={{ color: '#f5222d' }}>- {formatCurrency(d)}</Text> : <Text type="secondary">—</Text>;
              },
            },
            {
              title: 'Total',
              dataIndex: 'total',
              key: 'total',
              align: 'right',
              render: (v) => <Text strong>{formatCurrency(Number(v) || 0)}</Text>,
            },
            {
              title: 'Tipo',
              key: 'tipo',
              render: (_v, r) => {
                const d = Number(r?.descuento) || 0;
                return d > 0 ? <Tag color="green">Con descuento</Tag> : <Tag>Sin descuento</Tag>;
              },
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
                </Space>
              ),
            },
          ]}
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
                <Text>{new Date(ventaSeleccionada.fecha).toLocaleString()}</Text>
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
