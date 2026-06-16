import React, { useState, useEffect } from 'react';
import {
  Card, Button, Input, Space, Typography, Form, InputNumber, Select, Row, Col,
  Table, Divider, AutoComplete, DatePicker,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, SearchOutlined, PlusOutlined,
  DeleteOutlined, TruckOutlined, SendOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { createOrdenCompra, getOrdenCompraById, updateOrdenCompra } from '../../api/ordenesCompra.api';
import { getProductos } from '../../api/inventario.api';
import { getProveedores } from '../../api/proveedores.api';
import { formatCurrency } from '../../utils/formatters';

const { Title, Text } = Typography;

export default function OrdenCompraFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [productos, setProductos] = useState([]);
  const [busquedaProd, setBusquedaProd] = useState('');
  const [resultadosProd, setResultadosProd] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);

  useEffect(() => {
    fetchProveedores();
    if (isEditing) loadOrden();
  }, [id]);

  const loadOrden = async () => {
    try {
      const res = await getOrdenCompraById(id);
      const orden = res.data;
      setProductos(orden.productos.map((p) => ({ ...p, key: p.productoId })));
      setProveedorSeleccionado({ _id: orden.proveedorId?._id || orden.proveedorId, ...orden.proveedor });
      form.setFieldsValue({
        notas: orden.notas,
        impuestos: orden.impuestos,
        descuento: orden.descuento,
      });
    } catch {
      toast.error('Error al cargar orden');
      navigate('/ordenes-compra');
    }
  };

  const fetchProveedores = async () => {
    try {
      const res = await getProveedores();
      setProveedores(res.data);
    } catch { /* ignore */ }
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
          ? { ...p, cantidadSolicitada: p.cantidadSolicitada + 1, subtotal: (p.cantidadSolicitada + 1) * p.precioUnitario }
          : p
      ));
    } else {
      setProductos((prev) => [...prev, {
        key: producto._id,
        productoId: producto._id,
        nombre: producto.nombre,
        codigo: producto.codigo || '',
        cantidadSolicitada: 1,
        cantidadRecibida: 0,
        precioUnitario: producto.precioCompra,
        subtotal: producto.precioCompra,
      }]);
    }
    setBusquedaProd('');
    setResultadosProd([]);
  };

  const handleCambiarCantidad = (productoId, cantidad) => {
    setProductos((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId)
        ? { ...p, cantidadSolicitada: cantidad, subtotal: cantidad * p.precioUnitario }
        : p
    ));
  };

  const handleCambiarPrecio = (productoId, precio) => {
    setProductos((prev) => prev.map((p) =>
      String(p.productoId) === String(productoId)
        ? { ...p, precioUnitario: precio, subtotal: p.cantidadSolicitada * precio }
        : p
    ));
  };

  const handleQuitarProducto = (productoId) => {
    setProductos((prev) => prev.filter((p) => String(p.productoId) !== String(productoId)));
  };

  const subtotal = productos.reduce((sum, p) => sum + p.precioUnitario * p.cantidadSolicitada, 0);
  const impuestos = Form.useWatch('impuestos', form) || 0;
  const descuento = Form.useWatch('descuento', form) || 0;
  const total = subtotal + impuestos - descuento;

  const handleGuardar = async (estado = 'borrador') => {
    if (!proveedorSeleccionado) {
      toast.error('Seleccione un proveedor');
      return;
    }
    if (productos.length === 0) {
      toast.error('Agregue al menos un producto');
      return;
    }
    setSaving(true);
    try {
      const values = form.getFieldsValue();
      const payload = {
        proveedorId: proveedorSeleccionado._id,
        proveedor: {
          nombre: proveedorSeleccionado.nombre,
          telefono: proveedorSeleccionado.telefono || '',
          email: proveedorSeleccionado.email || '',
        },
        productos: productos.map((p) => ({
          productoId: p.productoId,
          cantidadSolicitada: p.cantidadSolicitada,
          precioUnitario: p.precioUnitario,
        })),
        impuestos: Number(values.impuestos || 0),
        descuento: Number(values.descuento || 0),
        notas: values.notas || '',
        fechaEstimadaEntrega: values.fechaEstimadaEntrega?.toISOString() || null,
        estado,
      };

      if (isEditing) {
        await updateOrdenCompra(id, payload);
        toast.success('Orden actualizada');
      } else {
        await createOrdenCompra(payload);
        toast.success('Orden de compra creada');
      }
      navigate('/ordenes-compra');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: '0 24px', maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/ordenes-compra')} style={{ marginBottom: 8 }}>
            Volver
          </Button>
          <Title level={2} className="page-title">
            {isEditing ? 'Editar Orden de Compra' : 'Nueva Orden de Compra'}
          </Title>
        </div>
        <Space>
          <Button size="large" onClick={() => handleGuardar('borrador')} loading={saving} icon={<SaveOutlined />}>
            Guardar Borrador
          </Button>
          <Button type="primary" size="large" onClick={() => handleGuardar('enviada')} loading={saving} icon={<SendOutlined />}>
            Guardar y Enviar
          </Button>
        </Space>
      </div>

      <Row gutter={24}>
        <Col xs={24} lg={16}>
          <Card title="Productos a Solicitar" bordered={false} className="dashboard-card shadow-sm" style={{ marginBottom: 24 }}>
            <AutoComplete style={{ width: '100%', marginBottom: 16 }}
              value={busquedaProd} onSearch={handleBuscarProducto} onChange={setBusquedaProd}
              options={resultadosProd.map((p) => ({
                value: p._id,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{p.nombre} <small style={{ color: '#8c8c8c' }}>({p.codigo || 'S/C'})</small></span>
                    <Space>
                      <Text type="secondary">Stock: {p.stock}</Text>
                      <Text strong>{formatCurrency(p.precioCompra)}</Text>
                    </Space>
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

            <Table columns={[
              { title: 'Producto', dataIndex: 'nombre', render: (t, r) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{t}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{r.codigo || 'S/C'}</Text>
                </Space>
              )},
              { title: 'Cantidad', dataIndex: 'cantidadSolicitada', width: 100, align: 'center',
                render: (val, r) => <InputNumber min={1} value={val} size="small" style={{ width: 80 }}
                  onChange={(v) => handleCambiarCantidad(r.productoId, v)} /> },
              { title: 'Precio Compra', dataIndex: 'precioUnitario', width: 130,
                render: (val, r) => <InputNumber min={0} value={val} size="small" style={{ width: 110 }}
                  prefix="C$" controls={false}
                  onChange={(v) => handleCambiarPrecio(r.productoId, v)} /> },
              { title: 'Subtotal', key: 'subtotal', width: 120, align: 'right',
                render: (_, r) => <Text strong>{formatCurrency(r.cantidadSolicitada * r.precioUnitario)}</Text> },
              { title: '', key: 'del', width: 50, render: (_, r) => (
                <Button type="text" danger size="small" icon={<DeleteOutlined />}
                  onClick={() => handleQuitarProducto(r.productoId)} />
              )},
            ]} dataSource={productos} rowKey="productoId" pagination={false} size="small"
              locale={{ emptyText: 'Agregue productos usando el buscador' }} />

            <Divider />
            <Row justify="end">
              <Col>
                <Space direction="vertical" size={4} style={{ textAlign: 'right' }}>
                  <Text>Subtotal: <Text strong>{formatCurrency(subtotal)}</Text></Text>
                  <Form form={form} layout="inline">
                    <Space direction="vertical" size={4}>
                      <Space>
                        <Text>Impuestos:</Text>
                        <Form.Item name="impuestos" initialValue={0} noStyle>
                          <InputNumber min={0} size="small" prefix="C$" controls={false} style={{ width: 100 }} />
                        </Form.Item>
                      </Space>
                      <Space>
                        <Text>Descuento:</Text>
                        <Form.Item name="descuento" initialValue={0} noStyle>
                          <InputNumber min={0} size="small" prefix="C$" controls={false} style={{ width: 100 }} />
                        </Form.Item>
                      </Space>
                    </Space>
                  </Form>
                  <Title level={3} style={{ margin: 0, color: '#1677ff' }}>Total: {formatCurrency(total)}</Title>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<><TruckOutlined /> Proveedor</>} bordered={false} className="dashboard-card shadow-sm" style={{ marginBottom: 24 }}>
            <Select style={{ width: '100%', marginBottom: 16 }}
              placeholder="Seleccionar proveedor..."
              showSearch optionFilterProp="children"
              value={proveedorSeleccionado?._id}
              onChange={(val) => {
                const prov = proveedores.find((p) => p._id === val);
                setProveedorSeleccionado(prov);
              }}>
              {proveedores.map((p) => (
                <Select.Option key={p._id} value={p._id}>{p.nombre}</Select.Option>
              ))}
            </Select>

            {proveedorSeleccionado && (
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                <Text strong>{proveedorSeleccionado.nombre}</Text><br />
                {proveedorSeleccionado.telefono && <Text type="secondary">Tel: {proveedorSeleccionado.telefono}</Text>}
                {proveedorSeleccionado.email && <><br /><Text type="secondary">{proveedorSeleccionado.email}</Text></>}
              </div>
            )}
          </Card>

          <Card title="Datos Adicionales" bordered={false} className="dashboard-card shadow-sm">
            <Form form={form} layout="vertical">
              <Form.Item name="fechaEstimadaEntrega" label="Fecha Estimada de Entrega">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="notas" label="Notas / Observaciones">
                <Input.TextArea rows={3} placeholder="Notas internas..." />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
