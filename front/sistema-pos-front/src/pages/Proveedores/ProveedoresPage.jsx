import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Space, Typography, Tag, 
  Modal, Form, InputNumber, Select, Row, Col, Divider, 
  List, message, Alert, Popconfirm
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, TruckOutlined, ShoppingCartOutlined,
  PhoneOutlined, MailOutlined, BankOutlined, PlusCircleOutlined
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { 
  getProveedores, createProveedor, updateProveedor, deleteProveedor, 
  getComprasProveedor, registrarCompra, updateCompra, deleteCompra 
} from '../../api/proveedores.api';
import { getProductos } from '../../api/inventario.api';
import { getCajaActual } from '../../api/caja.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';
import { useCajaStore } from '../../store/cajaStore';

const { Title, Text } = Typography;
const { Option } = Select;

const normalize = (v) => String(v ?? '').toLowerCase();

const filterProductoOption = (input, option) => {
  const raw = option?.children;
  // children puede ser ReactNode; en este caso es texto interpolado.
  const text = Array.isArray(raw) ? raw.join(' ') : String(raw ?? '');
  return normalize(text).includes(normalize(input));
};

export default function ProveedoresPage() {
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isModalCompraVisible, setIsModalCompraVisible] = useState(false);
  const [isModalComprasVisible, setIsModalComprasVisible] = useState(false);
  const [isModalEditarCompraVisible, setIsModalEditarCompraVisible] = useState(false);
  const [loadingCompras, setLoadingCompras] = useState(false);
  const [comprasProveedor, setComprasProveedor] = useState([]);
  const [selectedProveedor, setSelectedProveedor] = useState(null);
  const [editingCompra, setEditingCompra] = useState(null);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [form] = Form.useForm();
  const [formCompra] = Form.useForm();
  const [formEditarCompra] = Form.useForm();
  const { isAdmin } = useAuthStore();
  const { setCajaActual, limpiarCaja } = useCajaStore();

  // Carrito de compra a proveedor local state
  const [compraItems, setCompraItems] = useState([]);

  useEffect(() => {
    fetchData();
    fetchProductos();
  }, []);

  const refreshCajaActual = async () => {
    try {
      const res = await getCajaActual();
      if (res?.data?.caja) setCajaActual(res.data.caja);
    } catch (err) {
      // Si no hay caja abierta o falla, limpiamos el estado para que la UI sea consistente
      limpiarCaja();
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getProveedores();
      setProveedores(res.data);
    } catch (err) {
      toast.error('Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductos = async () => {
    const res = await getProductos();
    setProductos(res.data);
  };

  const handleOpenModal = (proveedor = null) => {
    setEditingProveedor(proveedor);
    if (proveedor) form.setFieldsValue(proveedor);
    else form.resetFields();
    setIsModalVisible(true);
  };

  const onFinish = async (values) => {
    try {
      if (editingProveedor) {
        await updateProveedor(editingProveedor._id, values);
        toast.success('Proveedor actualizado');
      } else {
        await createProveedor(values);
        toast.success('Proveedor creado');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (err) {
      toast.error('Error al guardar proveedor');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProveedor(id);
      toast.success('Proveedor desactivado');
      fetchData();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  // Lógica de Compras a Proveedor
  const onAgregarItemCompra = (productoId) => {
    const p = productos.find(x => x._id === productoId);
    if (!p) return;
    
    if (compraItems.find(x => x.productoId === productoId)) {
        toast.error('El producto ya está en la lista de compra');
        return;
    }
    
    setCompraItems([...compraItems, {
        productoId: p._id,
        nombre: p.nombre,
        cantidad: 1,
        precioCompra: p.precioCompra || 0,
        subtotal: p.precioCompra || 0
    }]);
  };

  const handleUpdateItemCompra = (id, field, value) => {
    setCompraItems(prev => prev.map(item => {
        if (item.productoId === id) {
            const up = { ...item, [field]: value };
            up.subtotal = up.cantidad * up.precioCompra;
            return up;
        }
        return item;
    }));
  };

  const totalCompra = compraItems.reduce((s, i) => s + i.subtotal, 0);

  const fetchCompras = async (proveedorId) => {
    setLoadingCompras(true);
    try {
      const res = await getComprasProveedor(proveedorId);
      setComprasProveedor(res.data);
    } catch (err) {
      toast.error('Error al cargar compras del proveedor');
    } finally {
      setLoadingCompras(false);
    }
  };

  const openComprasProveedor = async (proveedor) => {
    setSelectedProveedor(proveedor);
    setIsModalComprasVisible(true);
    await fetchCompras(proveedor._id);
  };

  const openEditarCompra = (compra) => {
    setEditingCompra(compra);
    setCompraItems(
      (compra.productos || []).map((p) => ({
        productoId: p.productoId,
        nombre: p.nombre,
        cantidad: p.cantidad,
        precioCompra: p.precioUnitario,
        subtotal: p.subtotal,
      }))
    );
    formEditarCompra.setFieldsValue({
      numeroFactura: compra.numeroFactura,
      observaciones: compra.observaciones,
    });
    setIsModalEditarCompraVisible(true);
  };

  const onGuardarEdicionCompra = async (values) => {
    if (!editingCompra) return;
    if (compraItems.length === 0) {
      toast.error('Debe agregar productos a la compra');
      return;
    }
    try {
      await updateCompra(editingCompra._id, {
        ...values,
        productos: compraItems,
      });
      toast.success('Compra corregida e inventario recalculado');
      await refreshCajaActual();
      setIsModalEditarCompraVisible(false);
      setEditingCompra(null);
      setCompraItems([]);
      formEditarCompra.resetFields();
      if (selectedProveedor?._id) await fetchCompras(selectedProveedor._id);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al actualizar compra');
    }
  };

  const onAnularCompra = async (compraId) => {
    try {
      await deleteCompra(compraId);
      toast.success('Compra anulada y stock revertido');
      await refreshCajaActual();
      if (selectedProveedor?._id) await fetchCompras(selectedProveedor._id);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al anular compra');
    }
  };

  const onRegistrarCompra = async (values) => {
    if (compraItems.length === 0) {
        toast.error('Debe agregar productos a la compra');
        return;
    }
    try {
        await registrarCompra({
            ...values,
            productos: compraItems,
            total: totalCompra
        });
        toast.success('¡Compra registrada e inventario actualizado!');
      await refreshCajaActual();
        setIsModalCompraVisible(false);
        setCompraItems([]);
        formCompra.resetFields();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al registrar compra');
    }
  };

  const columns = [
    {
      title: 'Proveedor',
      dataIndex: 'nombre',
      render: (text, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.nit || 'Sin NIT'}</Text>
        </Space>
      )
    },
    {
      title: 'Contacto',
      dataIndex: 'contacto',
      render: (text, record) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ fontSize: 13 }}>{text || 'N/A'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}><PhoneOutlined /> {record.telefono}</Text>
        </Space>
      )
    },
    {
      title: 'Email',
      dataIndex: 'email',
      render: (text) => text || '—'
    },
    {
      title: 'Acciones',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleOpenModal(record)} />
          <Button icon={<ShoppingCartOutlined />} size="small" onClick={() => openComprasProveedor(record)} />
          {isAdmin() && (
            <Popconfirm title="¿Desactivar proveedor?" onConfirm={() => handleDelete(record._id)}>
              <Button icon={<DeleteOutlined />} size="small" danger ghost />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Proveedores y Compras</Title>
          <Text className="page-sub">Centralice la gestión de abastecimiento y compras directas.</Text>
        </div>
        <Space>
            <Button 
                type="dashed" 
                icon={<PlusCircleOutlined />} 
                onClick={() => setIsModalCompraVisible(true)}
            >
                Registrar Compra / Factura
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                Nuevo Proveedor
            </Button>
        </Space>
      </div>

      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <Table 
          columns={columns} 
          dataSource={proveedores} 
          rowKey="_id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Modal CRUD Proveedor */}
      <Modal
        title={editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="nombre" label="Nombre de la Empresa" rules={[{ required: true }]}>
            <Input prefix={<TruckOutlined />} placeholder="Distribuidora S.A." />
          </Form.Item>
          <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="nit" label="RUC / NIT / Cédula">
                   <Input prefix={<BankOutlined />} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="contacto" label="Persona de Contacto">
                   <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="telefono" label="Teléfono">
                   <Input prefix={<PhoneOutlined />} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="email" label="Correo Electrónico">
                   <Input prefix={<MailOutlined />} />
                </Form.Item>
              </Col>
          </Row>
          <Form.Item name="direccion" label="Dirección Física">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de Registro de Compra */}
      <Modal
        title="Registrar Compra de Inventario"
        open={isModalCompraVisible}
        onCancel={() => { setIsModalCompraVisible(false); setCompraItems([]); }}
        onOk={() => formCompra.submit()}
        width={800}
        okText="Registrar Factura y Cargar Stock"
      >
        <Form form={formCompra} layout="vertical" onFinish={onRegistrarCompra}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="proveedorId" label="Proveedor" rules={[{ required: true }]}>
                <Select placeholder="Seleccionar emisor de factura...">
                  {proveedores.map(p => <Option key={p._id} value={p._id}>{p.nombre}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="numeroFactura" label="Número de Factura / Ticket">
                <Input placeholder="Ej: FAC-001-2024" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Productos a Cargar</Divider>
          
          <div style={{ marginBottom: 15 }}>
            <Select
              showSearch
              placeholder="Escriba para buscar producto y agregar a la lista..."
              style={{ width: '100%' }}
              optionFilterProp="children"
              filterOption={filterProductoOption}
              onSelect={onAgregarItemCompra}
              value={null}
            >
               {productos.map(p => (
                   <Option key={p._id} value={p._id}>
                       {p.nombre} ({p.codigo || 'S/C'}) - Stock: {p.stock}
                   </Option>
               ))}
            </Select>
          </div>

          <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, minHeight: 150 }}>
             {compraItems.length === 0 ? (
                 <div style={{ textAlign: 'center', padding: 40, color: '#bfbfbf' }}>
                     <ShoppingCartOutlined style={{ fontSize: 32 }} />
                     <p>Lista de compra vacía</p>
                 </div>
             ) : (
                <Table 
                    size="small"
                    dataSource={compraItems}
                    rowKey="productoId"
                    pagination={false}
                    columns={[
                        { title: 'Producto', dataIndex: 'nombre' },
                        { 
                            title: 'Cantidad', 
                            render: (_, record) => (
                                <InputNumber 
                                    min={1} 
                                    value={record.cantidad} 
                                    onChange={v => handleUpdateItemCompra(record.productoId, 'cantidad', v)} 
                                />
                            )
                        },
                        { 
                            title: 'Costo Unit.', 
                            render: (_, record) => (
                                <InputNumber 
                                    min={0} 
                                    value={record.precioCompra} 
                                    onChange={v => handleUpdateItemCompra(record.productoId, 'precioCompra', v)}
                                    formatter={val => `C$ ${val}`}
                                />
                            )
                        },
                        { title: 'Subtotal', dataIndex: 'subtotal', align: 'right', render: v => formatCurrency(v) },
                        { 
                            title: '', 
                            render: (_, r) => (
                                <Button 
                                    type="text" 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    onClick={() => setCompraItems(prev => prev.filter(x => x.productoId !== r.productoId))} 
                                />
                            ) 
                        }
                    ]}
                    footer={() => (
                        <div style={{ textAlign: 'right', paddingRight: 50 }}>
                            <Title level={4} style={{ margin: 0 }}>Total Compra: {formatCurrency(totalCompra)}</Title>
                        </div>
                    )}
                />
             )}
          </div>
          
          <Form.Item name="observaciones" label="Notas de la compra" style={{ marginTop: 20 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Historial de Compras */}
      <Modal
        title={selectedProveedor ? `Compras: ${selectedProveedor.nombre}` : 'Compras'}
        open={isModalComprasVisible}
        onCancel={() => { setIsModalComprasVisible(false); setComprasProveedor([]); setSelectedProveedor(null); }}
        footer={null}
        width={900}
      >
        <Table
          size="small"
          rowKey="_id"
          loading={loadingCompras}
          dataSource={comprasProveedor}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Fecha', dataIndex: 'fecha', render: (v) => formatDateTime(v) },
            { title: 'Factura', dataIndex: 'numeroFactura', render: (v) => v || '—' },
            { title: 'Total', dataIndex: 'total', align: 'right', render: (v) => formatCurrency(v) },
            { title: 'Usuario', dataIndex: 'usuarioId', render: (u) => u?.nombre || '—' },
            {
              title: 'Acciones',
              align: 'right',
              render: (_, record) => (
                <Space>
                  {isAdmin() && (
                    <>
                      <Button
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setIsModalComprasVisible(false);
                          openEditarCompra(record);
                        }}
                      >
                        Editar
                      </Button>
                      <Popconfirm
                        title="¿Anular esta compra? Esto revertirá stock."
                        onConfirm={() => onAnularCompra(record._id)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />}>Anular</Button>
                      </Popconfirm>
                    </>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      {/* Modal Editar Compra */}
      <Modal
        title={editingCompra ? `Editar Compra (${editingCompra.numeroFactura || 'S/F'})` : 'Editar Compra'}
        open={isModalEditarCompraVisible}
        onCancel={() => { setIsModalEditarCompraVisible(false); setEditingCompra(null); setCompraItems([]); formEditarCompra.resetFields(); }}
        onOk={() => formEditarCompra.submit()}
        width={800}
        okText="Guardar Corrección"
      >
        <Form form={formEditarCompra} layout="vertical" onFinish={onGuardarEdicionCompra}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="numeroFactura" label="Número de Factura / Ticket">
                <Input placeholder="Ej: FAC-001-2024" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Alert
                type="info"
                showIcon
                message="La corrección ajusta stock por diferencia y registra Kardex."
              />
            </Col>
          </Row>

          <Divider orientation="left">Productos</Divider>

          <div style={{ marginBottom: 15 }}>
            <Select
              showSearch
              placeholder="Buscar producto y agregar a la compra..."
              style={{ width: '100%' }}
              optionFilterProp="children"
              filterOption={filterProductoOption}
              onSelect={onAgregarItemCompra}
              value={null}
            >
              {productos.map((p) => (
                <Option key={p._id} value={p._id}>
                  {p.nombre} ({p.codigo || 'S/C'}) - Stock: {p.stock}
                </Option>
              ))}
            </Select>
          </div>

          <div style={{ background: '#fafafa', borderRadius: 8, padding: 10, minHeight: 150 }}>
            {compraItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#bfbfbf' }}>
                <ShoppingCartOutlined style={{ fontSize: 32 }} />
                <p>Lista de compra vacía</p>
              </div>
            ) : (
              <Table
                size="small"
                dataSource={compraItems}
                rowKey="productoId"
                pagination={false}
                columns={[
                  { title: 'Producto', dataIndex: 'nombre' },
                  {
                    title: 'Cantidad',
                    render: (_, record) => (
                      <InputNumber
                        min={1}
                        value={record.cantidad}
                        onChange={(v) => handleUpdateItemCompra(record.productoId, 'cantidad', v)}
                      />
                    ),
                  },
                  {
                    title: 'Costo Unit.',
                    render: (_, record) => (
                      <InputNumber
                        min={0}
                        value={record.precioCompra}
                        onChange={(v) => handleUpdateItemCompra(record.productoId, 'precioCompra', v)}
                        formatter={(val) => `C$ ${val}`}
                      />
                    ),
                  },
                  { title: 'Subtotal', dataIndex: 'subtotal', align: 'right', render: (v) => formatCurrency(v) },
                  {
                    title: '',
                    render: (_, r) => (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => setCompraItems((prev) => prev.filter((x) => x.productoId !== r.productoId))}
                      />
                    ),
                  },
                ]}
                footer={() => (
                  <div style={{ textAlign: 'right', paddingRight: 50 }}>
                    <Title level={4} style={{ margin: 0 }}>
                      Total Compra: {formatCurrency(totalCompra)}
                    </Title>
                  </div>
                )}
              />
            )}
          </div>

          <Form.Item name="observaciones" label="Notas" style={{ marginTop: 20 }}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
