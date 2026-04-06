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
  getComprasProveedor, registrarCompra 
} from '../../api/proveedores.api';
import { getProductos } from '../../api/inventario.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

export default function ProveedoresPage() {
  const [loading, setLoading] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isModalCompraVisible, setIsModalCompraVisible] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [form] = Form.useForm();
  const [formCompra] = Form.useForm();
  const { isAdmin } = useAuthStore();

  // Carrito de compra a proveedor local state
  const [compraItems, setCompraItems] = useState([]);

  useEffect(() => {
    fetchData();
    fetchProductos();
  }, []);

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
        setIsModalCompraVisible(false);
        setCompraItems([]);
        formCompra.resetFields();
    } catch (err) {
        toast.error('Error al registrar compra');
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
    </div>
  );
}
