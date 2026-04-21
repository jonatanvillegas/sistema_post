import React, { useMemo, useState } from 'react';
import { Card, DatePicker, Button, Table, Typography, Space, Tag, Select } from 'antd';
import { toast } from 'react-hot-toast';
import { getVentasReporteAdmin } from '../../api/ventas.api';
import { formatCurrency } from '../../utils/formatters';

const { Title, Text } = Typography;

export default function VentasReportePage() {
  const [rango, setRango] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totales, setTotales] = useState(null);
  const [ventas, setVentas] = useState([]);
  const [filtroDescuento, setFiltroDescuento] = useState('todas');

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
              render: (v) => <Text strong>{v}</Text>,
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
          ]}
        />
      </Card>
    </div>
  );
}
