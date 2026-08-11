import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Input,
  InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table,
  Tabs, Tag, Typography,
} from 'antd';
import {
  FileTextOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';
import {
  anularAsientoContable,
  createAsientoContable,
  createCuentaContable,
  getAnexosContables,
  getAsientosContables,
  getBalanceGeneral,
  getConfiguracionContable,
  getCuentasContables,
  getCuentasT,
  getEstadoCuentaContable,
  updateConfiguracionContable,
  updateCuentaContable,
} from '../../api/contabilidad.api';

const { Title, Text } = Typography;

const tipoLabels = {
  activo: 'Activo',
  pasivo: 'Pasivo',
  patrimonio: 'Patrimonio',
  ingreso: 'Ingreso',
  gasto: 'Gasto',
  costo: 'Costo',
};

const money = (value) => `C$ ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (value) => (value ? dayjs(value).format('DD/MM/YYYY') : '');

function RangoFechas({ rango, setRango, onBuscar }) {
  return (
    <Space wrap>
      <DatePicker
        placeholder="Desde"
        value={rango.desde ? dayjs(rango.desde) : null}
        onChange={(v) => setRango((r) => ({ ...r, desde: v ? v.format('YYYY-MM-DD') : undefined }))}
      />
      <DatePicker
        placeholder="Hasta"
        value={rango.hasta ? dayjs(rango.hasta) : null}
        onChange={(v) => setRango((r) => ({ ...r, hasta: v ? v.format('YYYY-MM-DD') : undefined }))}
      />
      <Button icon={<ReloadOutlined />} onClick={onBuscar}>Actualizar</Button>
    </Space>
  );
}

export default function ContabilidadPage() {
  const [loading, setLoading] = useState(false);
  const [cuentas, setCuentas] = useState([]);
  const [asientos, setAsientos] = useState([]);
  const [config, setConfig] = useState(null);
  const [balance, setBalance] = useState(null);
  const [cuentasT, setCuentasT] = useState([]);
  const [anexos, setAnexos] = useState(null);
  const [estadoCuenta, setEstadoCuenta] = useState(null);
  const [cuentaEstadoId, setCuentaEstadoId] = useState(null);
  const [rango, setRango] = useState({});
  const [modalCuenta, setModalCuenta] = useState(false);
  const [modalAsiento, setModalAsiento] = useState(false);
  const [editingCuenta, setEditingCuenta] = useState(null);
  const [cuentaForm] = Form.useForm();
  const [asientoForm] = Form.useForm();

  const cuentaOptions = useMemo(() => cuentas
    .filter((c) => c.estado && c.aceptaMovimientos)
    .map((c) => ({ value: c._id, label: `${c.codigo} - ${c.nombre}` })), [cuentas]);

  const cuentaCodigoOptions = useMemo(() => cuentas
    .filter((c) => c.estado && c.aceptaMovimientos)
    .map((c) => ({ value: c.codigo, label: `${c.codigo} - ${c.nombre}` })), [cuentas]);

  const loadBase = async () => {
    setLoading(true);
    try {
      const [cuentasRes, asientosRes, configRes] = await Promise.all([
        getCuentasContables(),
        getAsientosContables({ limit: 50 }),
        getConfiguracionContable(),
      ]);
      setCuentas(cuentasRes.data || []);
      setAsientos(asientosRes.data?.asientos || []);
      setConfig(configRes.data);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al cargar contabilidad');
    } finally {
      setLoading(false);
    }
  };

  const loadReportes = async () => {
    setLoading(true);
    try {
      const [balanceRes, tRes, anexosRes] = await Promise.all([
        getBalanceGeneral(rango),
        getCuentasT(rango),
        getAnexosContables(rango),
      ]);
      setBalance(balanceRes.data);
      setCuentasT(tRes.data || []);
      setAnexos(anexosRes.data);
      if (cuentaEstadoId) {
        const estadoRes = await getEstadoCuentaContable(cuentaEstadoId, rango);
        setEstadoCuenta(estadoRes.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al cargar reportes contables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    loadReportes();
  }, []);

  const openCuenta = (cuenta = null) => {
    setEditingCuenta(cuenta);
    cuentaForm.setFieldsValue(cuenta || { tipo: 'activo', nivel: 1, aceptaMovimientos: true, estado: true });
    setModalCuenta(true);
  };

  const saveCuenta = async (values) => {
    try {
      if (editingCuenta?._id) {
        await updateCuentaContable(editingCuenta._id, values);
        toast.success('Cuenta actualizada');
      } else {
        await createCuentaContable(values);
        toast.success('Cuenta creada');
      }
      setModalCuenta(false);
      setEditingCuenta(null);
      loadBase();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar cuenta');
    }
  };

  const saveAsiento = async (values) => {
    try {
      const detalles = (values.detalles || []).map((d) => ({
        cuentaId: d.cuentaId,
        descripcion: d.descripcion,
        debe: Number(d.debe || 0),
        haber: Number(d.haber || 0),
      }));
      await createAsientoContable({
        fecha: values.fecha ? values.fecha.toISOString() : new Date().toISOString(),
        concepto: values.concepto,
        referencia: values.referencia,
        detalles,
      });
      toast.success('Comprobante creado');
      setModalAsiento(false);
      asientoForm.resetFields();
      loadBase();
      loadReportes();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al crear comprobante');
    }
  };

  const saveConfig = async (patch) => {
    try {
      const res = await updateConfiguracionContable(patch);
      setConfig(res.data);
      toast.success('Configuración actualizada');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al actualizar configuración');
    }
  };

  const saveCuentaDefecto = (key, value) => {
    saveConfig({
      cuentasPorDefecto: {
        ...(config?.cuentasPorDefecto || {}),
        [key]: value,
      },
    });
  };

  const cuentaColumns = [
    { title: 'Código', dataIndex: 'codigo', width: 110 },
    { title: 'Nombre', dataIndex: 'nombre' },
    { title: 'Tipo', dataIndex: 'tipo', render: (v) => tipoLabels[v] || v },
    { title: 'Mov.', dataIndex: 'aceptaMovimientos', render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Sí' : 'No'}</Tag> },
    { title: 'Estado', dataIndex: 'estado', render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Activa' : 'Inactiva'}</Tag> },
    { title: 'Acciones', align: 'right', render: (_, r) => <Button size="small" onClick={() => openCuenta(r)}>Editar</Button> },
  ];

  const asientoColumns = [
    { title: 'Número', dataIndex: 'numero', width: 120 },
    { title: 'Fecha', dataIndex: 'fecha', width: 120, render: date },
    { title: 'Concepto', dataIndex: 'concepto' },
    { title: 'Origen', dataIndex: ['origen', 'modulo'], width: 110, render: (v) => <Tag>{v || 'manual'}</Tag> },
    { title: 'Debe', dataIndex: 'totalDebe', align: 'right', render: money },
    { title: 'Haber', dataIndex: 'totalHaber', align: 'right', render: money },
    { title: 'Estado', dataIndex: 'estado', render: (v) => <Tag color={v === 'registrado' ? 'green' : 'red'}>{v}</Tag> },
    {
      title: 'Acciones',
      align: 'right',
      render: (_, r) => r.estado === 'registrado' && (
        <Popconfirm title="¿Anular comprobante?" onConfirm={async () => {
          await anularAsientoContable(r._id, { motivo: 'Anulado desde contabilidad' });
          toast.success('Comprobante anulado');
          loadBase();
          loadReportes();
        }}>
          <Button size="small" danger>Anular</Button>
        </Popconfirm>
      ),
    },
  ];

  const balanceRows = balance ? [
    ...Object.entries(balance.secciones || {}).flatMap(([tipo, items]) =>
      items.map((item) => ({ ...item, tipo: tipoLabels[tipo] || tipo }))
    ),
  ] : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Contabilidad</Title>
          <Text className="page-sub">Funciona independiente del POS, con integración opcional a ventas.</Text>
        </div>
        <Space wrap>
          <RangoFechas rango={rango} setRango={setRango} onBuscar={loadReportes} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalAsiento(true)}>
            Nuevo Comprobante
          </Button>
        </Space>
      </div>

      <Tabs
        items={[
          {
            key: 'config',
            label: 'Configuración',
            children: (
              <Card loading={loading} bordered={false}>
                <Alert
                  type="info"
                  showIcon
                  message="Integración opcional"
                  description="Si Ventas está apagado, contabilidad sigue funcionando con comprobantes manuales. Si está encendido, cada venta completada genera un asiento automático."
                  style={{ marginBottom: 16 }}
                />
                <Descriptions bordered column={1}>
                  <Descriptions.Item label="Contabilidad activa">
                    <Switch checked={!!config?.activa} onChange={(v) => saveConfig({ activa: v })} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Relacionar con ventas">
                    <Switch
                      checked={!!config?.integraciones?.ventas}
                      onChange={(v) => saveConfig({ integraciones: { ...(config?.integraciones || {}), ventas: v } })}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="Relacionar con caja">
                    <Switch
                      checked={!!config?.integraciones?.caja}
                      onChange={(v) => saveConfig({ integraciones: { ...(config?.integraciones || {}), caja: v } })}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="Relacionar con inventario">
                    <Switch
                      checked={!!config?.integraciones?.inventario}
                      onChange={(v) => saveConfig({ integraciones: { ...(config?.integraciones || {}), inventario: v } })}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="Relacionar con créditos">
                    <Switch
                      checked={!!config?.integraciones?.creditos}
                      onChange={(v) => saveConfig({ integraciones: { ...(config?.integraciones || {}), creditos: v } })}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="Estado rápido">
                    <Space>
                      {['ventas', 'caja', 'inventario', 'creditos'].map((key) => (
                        <Tag key={key} color={config?.integraciones?.[key] ? 'green' : 'default'}>
                          {key}: {config?.integraciones?.[key] ? 'activo' : 'apagado'}
                        </Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
                <Divider />
                <Title level={4}>Cuentas por defecto para pólizas automáticas</Title>
                <Row gutter={[12, 12]}>
                  {[
                    ['caja', 'Caja'],
                    ['banco', 'Banco'],
                    ['cuentasPorCobrar', 'Cuentas por cobrar'],
                    ['inventario', 'Inventario'],
                    ['cuentasPorPagar', 'Cuentas por pagar'],
                    ['ventas', 'Ingresos por ventas'],
                    ['devolucionesVentas', 'Devoluciones sobre ventas'],
                    ['ingresosVarios', 'Ingresos varios'],
                    ['gastosCaja', 'Gastos / egresos de caja'],
                    ['productosDanados', 'Pérdida por productos dañados'],
                    ['costoVentas', 'Costo de ventas'],
                  ].map(([key, label]) => (
                    <Col xs={24} md={12} lg={8} key={key}>
                      <Text strong>{label}</Text>
                      <Select
                        showSearch
                        optionFilterProp="label"
                        style={{ width: '100%', marginTop: 6 }}
                        value={config?.cuentasPorDefecto?.[key]}
                        options={cuentaCodigoOptions}
                        onChange={(value) => saveCuentaDefecto(key, value)}
                      />
                    </Col>
                  ))}
                </Row>
              </Card>
            ),
          },
          {
            key: 'cuentas',
            label: 'Catálogo',
            children: (
              <Card bordered={false} extra={<Button icon={<PlusOutlined />} onClick={() => openCuenta()}>Nueva cuenta</Button>}>
                <Table columns={cuentaColumns} dataSource={cuentas} rowKey="_id" loading={loading} pagination={{ pageSize: 20 }} />
              </Card>
            ),
          },
          {
            key: 'asientos',
            label: 'Comprobantes diarios',
            children: (
              <Card bordered={false}>
                <Table
                  columns={asientoColumns}
                  dataSource={asientos}
                  rowKey="_id"
                  loading={loading}
                  expandable={{
                    expandedRowRender: (record) => (
                      <Table
                        size="small"
                        pagination={false}
                        rowKey={(r, i) => `${record._id}-${i}`}
                        dataSource={record.detalles || []}
                        columns={[
                          { title: 'Cuenta', render: (_, r) => `${r.codigo} - ${r.cuentaNombre}` },
                          { title: 'Descripción', dataIndex: 'descripcion' },
                          { title: 'Debe', dataIndex: 'debe', align: 'right', render: money },
                          { title: 'Haber', dataIndex: 'haber', align: 'right', render: money },
                        ]}
                      />
                    ),
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'balance',
            label: 'Balance general',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}><Card><Statistic title="Activo" value={balance?.totales?.activo || 0} prefix="C$" precision={2} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="Pasivo + Patrimonio + Resultado" value={balance?.totales?.pasivoPatrimonioResultado || 0} prefix="C$" precision={2} /></Card></Col>
                  <Col xs={24} md={8}><Card><Statistic title="Diferencia" value={balance?.totales?.diferencia || 0} prefix="C$" precision={2} /></Card></Col>
                </Row>
                <Card bordered={false}>
                  <Table
                    dataSource={balanceRows}
                    rowKey={(r) => r.cuentaId}
                    pagination={false}
                    columns={[
                      { title: 'Sección', dataIndex: 'tipo' },
                      { title: 'Código', dataIndex: 'codigo' },
                      { title: 'Cuenta', dataIndex: 'nombre' },
                      { title: 'Saldo', dataIndex: 'saldo', align: 'right', render: money },
                    ]}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'cuentas-t',
            label: 'Cuentas T',
            children: (
              <Row gutter={[16, 16]}>
                {cuentasT.map((c) => (
                  <Col xs={24} lg={12} key={c.cuentaId}>
                    <Card title={`${c.codigo} - ${c.nombre}`} extra={<Text strong>Saldo: {money(c.saldo)}</Text>}>
                      <Row gutter={12}>
                        <Col span={12}>
                          <Text strong>Debe</Text>
                          <Divider style={{ margin: '8px 0' }} />
                          {(c.debe || []).map((m) => <div key={`${m.asientoId}-d`}>{date(m.fecha)} {money(m.debe)}</div>)}
                        </Col>
                        <Col span={12}>
                          <Text strong>Haber</Text>
                          <Divider style={{ margin: '8px 0' }} />
                          {(c.haber || []).map((m) => <div key={`${m.asientoId}-h`}>{date(m.fecha)} {money(m.haber)}</div>)}
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                ))}
              </Row>
            ),
          },
          {
            key: 'estado',
            label: 'Estado de cuenta',
            children: (
              <Card bordered={false}>
                <Space wrap style={{ marginBottom: 16 }}>
                  <Select
                    showSearch
                    style={{ minWidth: 320 }}
                    placeholder="Seleccione cuenta"
                    options={cuentaOptions}
                    optionFilterProp="label"
                    value={cuentaEstadoId}
                    onChange={async (v) => {
                      setCuentaEstadoId(v);
                      const res = await getEstadoCuentaContable(v, rango);
                      setEstadoCuenta(res.data);
                    }}
                  />
                  <Button onClick={loadReportes}>Actualizar</Button>
                </Space>
                <Table
                  dataSource={estadoCuenta?.movimientos || []}
                  rowKey={(r) => `${r.asientoId}-${r.debe}-${r.haber}`}
                  pagination={{ pageSize: 20 }}
                  columns={[
                    { title: 'Fecha', dataIndex: 'fecha', render: date },
                    { title: 'Comprobante', dataIndex: 'numero' },
                    { title: 'Concepto', dataIndex: 'concepto' },
                    { title: 'Debe', dataIndex: 'debe', align: 'right', render: money },
                    { title: 'Haber', dataIndex: 'haber', align: 'right', render: money },
                    { title: 'Saldo', dataIndex: 'saldo', align: 'right', render: money },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'anexos',
            label: 'Anexos',
            children: (
              <Card bordered={false}>
                <Table
                  title={() => 'Resumen por origen'}
                  dataSource={anexos?.porOrigen || []}
                  rowKey="modulo"
                  pagination={false}
                  columns={[
                    { title: 'Origen', dataIndex: 'modulo', render: (v) => <Tag>{v}</Tag> },
                    { title: 'Movimientos', dataIndex: 'cantidad' },
                    { title: 'Debe', dataIndex: 'debe', align: 'right', render: money },
                    { title: 'Haber', dataIndex: 'haber', align: 'right', render: money },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal title={editingCuenta ? 'Editar cuenta' : 'Nueva cuenta'} open={modalCuenta} onCancel={() => setModalCuenta(false)} onOk={() => cuentaForm.submit()}>
        <Form form={cuentaForm} layout="vertical" onFinish={saveCuenta}>
          <Form.Item name="codigo" label="Código" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
            <Select options={Object.entries(tipoLabels).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="nivel" label="Nivel"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="aceptaMovimientos" label="Acepta mov." valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={8}><Form.Item name="estado" label="Activa" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal width={900} title={<Space><FileTextOutlined />Nuevo comprobante diario</Space>} open={modalAsiento} onCancel={() => setModalAsiento(false)} onOk={() => asientoForm.submit()} okText="Registrar">
        <Form form={asientoForm} layout="vertical" onFinish={saveAsiento} initialValues={{ fecha: dayjs(), detalles: [{}, {}] }}>
          <Row gutter={12}>
            <Col xs={24} md={8}><Form.Item name="fecha" label="Fecha" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col xs={24} md={16}><Form.Item name="referencia" label="Referencia"><Input placeholder="Factura, recibo, nota..." /></Form.Item></Col>
          </Row>
          <Form.Item name="concepto" label="Concepto" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.List name="detalles">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Row gutter={8} key={field.key} align="middle">
                    <Col xs={24} md={9}><Form.Item {...field} name={[field.name, 'cuentaId']} rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={cuentaOptions} placeholder="Cuenta" /></Form.Item></Col>
                    <Col xs={24} md={5}><Form.Item {...field} name={[field.name, 'descripcion']}><Input placeholder="Detalle" /></Form.Item></Col>
                    <Col xs={12} md={4}><Form.Item {...field} name={[field.name, 'debe']}><InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="Debe" /></Form.Item></Col>
                    <Col xs={12} md={4}><Form.Item {...field} name={[field.name, 'haber']}><InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="Haber" /></Form.Item></Col>
                    <Col xs={24} md={2}><Button danger disabled={fields.length <= 2} onClick={() => remove(field.name)}>Quitar</Button></Col>
                  </Row>
                ))}
                <Button icon={<PlusOutlined />} onClick={() => add()}>Agregar línea</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
