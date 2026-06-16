import React, { useState, useEffect } from 'react';
import {
  Card, Button, Input, Space, Typography, Form, InputNumber, Select, Row, Col,
  Table, Divider, Tooltip, AutoComplete,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, SearchOutlined, PlusOutlined,
  DeleteOutlined, UserOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { createCotizacion, getCotizacionById, updateCotizacion } from '../../api/cotizaciones.api';
import { getProductos } from '../../api/inventario.api';
import { getClientes } from '../../api/clientes.api';
import { formatCurrency } from '../../utils/formatters';

const { Title, Text } = Typography;

export default function CotizacionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [productos, setProductos] = useState([]);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [resultadosProd, setResultadosProd] = useState([]);
  const [clientesBusqueda, setClientesBusqueda] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  useEffect(() => {
    if (isEditing) loadCotizacion();
  }, [id]);

  const loadCotizacion = async () => {
    try {
      const res = await getCotizacionById(id);
      const cot = res.data;
      setProductos(cot.productos.map((p) => ({
        ...p,
        key: p.productoId,
      })));
      setClienteSeleccionado(cot.cliente);
      form.setFieldsValue({
        vigenciaDias: cot.vigenciaDias,
        notas: cot.notas,
        condiciones: cot.condiciones,
        descuento: cot.descuento,
      });
    } catch {
      toast.error('Error al cargar cotización');
      navigate('/cotizaciones');
    }
  };

  const handleBuscarProducto = async (value) => {
    if (!value || value.length < 2) { setResultadosProd([]); return; }
    try {
      const res = await getProductos({ buscar: value, limit: 10 });
      setResultadosProd(res.data);
    } catch { /* ignore */ }
  };

  const handleAgregarProducto = (producto) => {
    const exists = productos.find((p) => String(p.productoId) === String(producto._id));
    if (exists) {
      setProductos((prev) => prev.map((p) =>
        String(p.productoId) === String(producto._id)
          ? { ...p, cantidad: p.cantidad + 1, subtotal: (p.cantidad + 1) * p.precioUnitario }
          : p
      ));
    } else {
      setProductos((prev) => [...prev, {
        key: producto._id,
        productoId: producto._id,
        nombre: producto.nombre,
        codigo: producto.codigo || '',
        cantidad: 1,
        precioUnitario: producto.precioVenta,
        descuentoTipo: 'ninguno',
        descuentoValor: 0,
        descuentoMonto: 0,
        subtotal: producto.precioVenta,
      }]);
    }
    setBusquedaProd('');
    setResultadosProd([]);
  };

  const handleCambiarCantidad = (productoId, cantidad) => {
    setProductos((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId)
        ? { ...p, cantidad, subtotal: cantidad * p.precioUnitario - (p.descuentoMonto || 0) }
        : p
    ));
  };

  const handleCambiarPrecio = (productoId, precio) => {
    setProductos((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId)
        ? { ...p, precioUnitario: precio, subtotal: p.cantidad * precio - (p.descuentoMonto || 0) }
        : p
    ));
  };

  const handleQuitarProducto = (productoId) => {
    setProductos((prev) => prev.filter((p) => String(p.productoId) !== String(productoId)));
  };

  const handleSearchCliente = async (value) => {
    if (!value || value.length < 2) return;
    try {
      const res = await getClientes(value);
      setClientesBusqueda(res.data);
    } catch { /* ignore */ }
  };

  const subtotal = productos.reduce((sum, p) => sum + p.precioUnitario * p.cantidad, 0);
  const descuento = Form.useWatch('descuento', form) || 0;
  const total = subtotal - descuento;

  const handleGuardar = async (estado = 'borrador') => {
    if (productos.length === 0) {
      toast.error('Agregue al menos un producto');
      return;
    }
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const payload = {
        cliente: clienteSeleccionado || { nombre: 'Consumidor Final', nit: 'CF' },
        clienteId: clienteSeleccionado?._id || null,
        productos: productos.map((p) => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          precioUnitario: p.precioUnitario,
          descuentoTipo: p.descuentoTipo || 'ninguno',
          descuentoValor: p.descuentoValor || 0,
        })),
        descuento: Number(values.descuento || 0),
        vigenciaDias: values.vigenciaDias || 15,
        notas: values.notas || '',
        condiciones: values.condiciones || '',
        estado,
      };

      if (isEditing) {
        await updateCotizacion(id, payload);
        toast.success('Cotización actualizada');
      } else {
        await createCotizacion(payload);
        toast.success('Cotización creada');
      }
      navigate('/cotizaciones');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const productColumns = [
    { title: 'Producto', dataIndex: 'nombre', render: (t, r) => (
      <Space direction="vertical" size={0}>
        <Text strong>{t}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{r.codigo || 'S/C'}</Text>
      </Space>
    )},
    {
      title: 'Cant.', dataIndex: 'cantidad', width: 100, align: 'center',
      render: (val, record) => (
        <InputNumber min={1} value={val} size="small" style={{ width: 80 }}
          onChange={(v) => handleCambiarCantidad(record.productoId, v)} />
      ),
    },
    {
      title: 'P. Unit.', dataIndex: 'precioUnitario', width: 130,
      render: (val, record) => (
        <InputNumber min={0} value={val} size="small" style={{ width: 110 }}
          prefix="C$" controls={false}
          onChange={(v) => handleCambiarPrecio(record.productoId, v)} />
      ),
    },
    {
      title: 'Subtotal', key: 'subtotal', width: 120, align: 'right',
      render: (_, record) => <Text strong>{formatCurrency(record.cantidad * record.precioUnitario)}</Text>,
    },
    {
      title: '', key: 'acciones', width: 50, align: 'center',
      render: (_, record) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />}
          onClick={() => handleQuitarProducto(record.productoId)} />
      ),
    },
  ];

  return (
    <div style={{ padding: '0 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/cotizaciones')} style={{ marginBottom: 8 }}>
            Volver
          </Button>
          <Title level={2} className="page-title">
            {isEditing ? 'Editar Cotización' : 'Nueva Cotización'}
          </Title>
        </div>
        <Space>
          <Button size="large" onClick={() => handleGuardar('borrador')} loading={saving} icon={<SaveOutlined />}>
            Guardar Borrador
          </Button>
          <Button type="primary" size="large" onClick={() => handleGuardar('enviada')} loading={saving}>
            Guardar y Enviar
          </Button>
        </Space>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          {/* Buscar y agregar productos */}
          <Card title="Productos" bordered={false} className="dashboard-card shadow-sm" style={{ marginBottom: 24 }}>
            <AutoComplete
              style={{ width: '100%', marginBottom: 16 }}
              value={busquedaProd}
              onSearch={handleBuscarProducto}
              onChange={setBusquedaProd}
              options={resultadosProd.map((p) => ({
                value: p._id,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.nombre} <small style={{ color: '#8c8c8c' }}>({p.codigo || 'S/C'})</small></span>
                    <Text strong style={{ color: '#1677ff' }}>{formatCurrency(p.precioVenta)}</Text>
                  </div>
                ),
              }))}
              onSelect={(val) => {
                const prod = resultadosProd.find((p) => p._id === val);
                if (prod) handleAgregarProducto(prod);
              }}
            >
              <Input size="large" placeholder="Buscar producto por nombre o código..."
                prefix={<SearchOutlined />} suffix={<PlusOutlined />} />
            </AutoComplete>

            <Table
              columns={productColumns}
              dataSource={productos}
              rowKey="productoId"
              pagination={false}
              size="small"
              locale={{ emptyText: 'Agregue productos usando el buscador' }}
            />

            <Divider />
            <Row justify="end">
              <Col>
                <Space direction="vertical" size={4} style={{ textAlign: 'right' }}>
                  <Text>Subtotal: <Text strong>{formatCurrency(subtotal)}</Text></Text>
                  <Space>
                    <Text>Descuento:</Text>
                    <Form form={form} layout="inline">
                      <Form.Item name="descuento" initialValue={0} noStyle>
                        <InputNumber min={0} size="small" prefix="C$" controls={false} style={{ width: 100 }} />
                      </Form.Item>
                    </Form>
                  </Space>
                  <Title level={3} style={{ margin: 0, color: '#1677ff' }}>Total: {formatCurrency(total)}</Title>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* Datos del cliente */}
          <Card title={<><UserOutlined /> Cliente</>} bordered={false} className="dashboard-card shadow-sm" style={{ marginBottom: 24 }}>
            <Select
              showSearch
              style={{ width: '100%', marginBottom: 16 }}
              placeholder="Buscar cliente..."
              onSearch={handleSearchCliente}
              filterOption={false}
              value={clienteSeleccionado?.nombre || undefined}
              onSelect={(val, option) => setClienteSeleccionado(option.data)}
              allowClear
              onClear={() => setClienteSeleccionado({ nombre: 'Consumidor Final', nit: 'CF' })}
            >
              <Select.Option value="cf" data={{ nombre: 'Consumidor Final', nit: 'CF' }}>
                Consumidor Final
              </Select.Option>
              {clientesBusqueda.map((c) => (
                <Select.Option key={c._id} value={c._id} data={c}>
                  {c.nombre} <small style={{ color: '#8c8c8c' }}>({c.nit})</small>
                </Select.Option>
              ))}
            </Select>

            {clienteSeleccionado && (
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <Text strong>{clienteSeleccionado.nombre}</Text><br />
                <Text type="secondary">NIT: {clienteSeleccionado.nit || 'CF'}</Text><br />
                {clienteSeleccionado.telefono && (
                  <Text type="secondary">Tel: {clienteSeleccionado.telefono}</Text>
                )}
              </div>
            )}
          </Card>

          {/* Configuración */}
          <Card title="Configuración" bordered={false} className="dashboard-card shadow-sm" style={{ marginBottom: 24 }}>
            <Form form={form} layout="vertical">
              <Form.Item name="vigenciaDias" label="Vigencia (días)" initialValue={15}>
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="notas" label="Notas / Observaciones">
                <Input.TextArea rows={3} placeholder="Notas internas..." />
              </Form.Item>
              <Form.Item name="condiciones" label="Condiciones"
                initialValue="Precios sujetos a cambios sin previo aviso. Vigencia según fecha indicada.">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
