import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Typography, Tag, Modal, 
  Form, Input, Select, Space, Popconfirm, Avatar, Badge,
  Alert, Row, Col
} from 'antd';
import { 
  PlusOutlined, UserOutlined, EditOutlined, 
  DeleteOutlined, LockOutlined, MailOutlined,
  CheckCircleOutlined, StopOutlined, KeyOutlined
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { 
  getUsuarios, register, updateUsuario, deleteUsuario 
} from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

export default function UsuariosPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form] = Form.useForm();
  
  const { usuario: currentUser } = useAuthStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getUsuarios();
      setData(res.data);
    } catch (err) {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    setEditingUser(user);
    if (user) {
      form.setFieldsValue({
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        estado: user.estado,
      });
    } else {
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const onFinish = async (values) => {
    try {
      if (editingUser) {
        await updateUsuario(editingUser._id, values);
        toast.success('Usuario actualizado con éxito');
      } else {
        await register(values);
        toast.success('Nuevo usuario registrado');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al procesar solicitud');
    }
  };

  const handleDelete = async (id) => {
    if (id === currentUser._id) {
        toast.error('No puedes eliminarte a ti mismo');
        return;
    }
    try {
      await deleteUsuario(id);
      toast.success('Usuario eliminado');
      fetchData();
    } catch (err) {
      toast.error('Error al eliminar usuario');
    }
  };

  const columns = [
    {
      title: 'Usuario',
      dataIndex: 'nombre',
      render: (text, record) => (
        <Space>
           <Avatar style={{ backgroundColor: record.estado ? '#1677ff' : '#d9d9d9' }} icon={<UserOutlined />} />
           <Space orientation="vertical" size={0}>
              <Text strong>{text}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}><MailOutlined /> {record.email}</Text>
           </Space>
        </Space>
      )
    },
    {
      title: 'Rol',
      dataIndex: 'rol',
      render: (rol) => (
        <Tag color={rol === 'admin' ? 'purple' : rol === 'inventario' ? 'geekblue' : 'blue'} icon={<KeyOutlined />}>
           {rol.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      render: (estado) => (
        <Badge status={estado ? 'success' : 'error'} text={estado ? 'Activo' : 'Inactivo'} />
      )
    },
    {
      title: 'Creación',
      dataIndex: 'createdAt',
      render: (val) => new Date(val).toLocaleDateString(),
      responsive: ['md']
    },
    {
      title: 'Acciones',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            size="small" 
            type="primary" 
            ghost 
            onClick={() => handleOpenModal(record)} 
          />
          {record._id !== currentUser._id && (
            <Popconfirm title="¿Eliminar este usuario?" onConfirm={() => handleDelete(record._id)}>
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
          <Title level={2} className="page-title">Personal y Usuarios</Title>
          <Text className="page-sub">Gestión de accesos, roles y seguridad del sistema.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Nuevo Usuario
        </Button>
      </div>

      <Alert 
        message="Seguridad del Sistema"
        description="Roles: Cajero (Punto de Venta, Caja, Clientes), Inventario (Inventario, Proveedores) y Admin (todo el sistema + configuración)."
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />

      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="_id" 
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingUser ? 'Editar Perfil de Usuario' : 'Registrar Nuevo Usuario'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText={editingUser ? 'Guardar Cambios' : 'Registrar'}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="nombre" label="Nombre Completo" rules={[{ required: true }]}>
             <Input prefix={<UserOutlined />} placeholder="Juan Pérez" />
          </Form.Item>
          
          <Form.Item name="email" label="Correo Electrónico" rules={[{ required: true, type: 'email' }]}>
             <Input prefix={<MailOutlined />} placeholder="juan@negocio.com" />
          </Form.Item>

          <Form.Item 
            name="password" 
            label={editingUser ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña Temporal"} 
            rules={[{ required: !editingUser }]}
          >
             <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
          </Form.Item>

          <Row gutter={16}>
             <Col span={12}>
                <Form.Item name="rol" label="Rol de Usuario" initialValue="cajero">
                   <Select>
                      <Option value="cajero">Cajero / Operario</Option>
                   <Option value="inventario">Encargado de Inventario</Option>
                      <Option value="admin">Administrador</Option>
                   </Select>
                </Form.Item>
             </Col>
             <Col span={12}>
                <Form.Item name="estado" label="Estado de Cuenta" initialValue={true}>
                   <Select>
                      <Option value={true}>Activo / Habilitado</Option>
                      <Option value={false}>Inactivo / Bloqueado</Option>
                   </Select>
                </Form.Item>
             </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
