import React, { useEffect, useState } from 'react';
import { Card, Typography, Button, Space, Table, Modal, Form, Input, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TagsOutlined } from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { getCategorias, createCategoria, updateCategoria, deleteCategoria } from '../../api/categorias.api';

const { Title, Text } = Typography;

export default function CategoriasPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getCategorias();
      setData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = (categoria = null) => {
    setEditing(categoria);
    if (categoria) {
      form.setFieldsValue({ nombre: categoria.nombre });
    } else {
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const onFinish = async (values) => {
    try {
      const payload = { nombre: String(values?.nombre || '').trim() };
      if (!payload.nombre) {
        toast.error('El nombre es requerido');
        return;
      }

      if (editing?._id) {
        await updateCategoria(editing._id, payload);
        toast.success('Categoría actualizada');
      } else {
        await createCategoria(payload);
        toast.success('Categoría creada');
      }

      setIsModalVisible(false);
      setEditing(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar categoría');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCategoria(id);
      toast.success('Categoría eliminada');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al eliminar categoría');
    }
  };

  const columns = [
    {
      title: 'Nombre',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (val) => <Text strong>{val}</Text>,
    },
    {
      title: 'Estado',
      key: 'estado',
      width: 120,
      render: () => <Tag color="green">ACTIVA</Tag>,
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Popconfirm title="¿Eliminar categoría?" onConfirm={() => handleDelete(record._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Categorías</Title>
          <Text className="page-sub">Solo administradores pueden crear o editar categorías.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Nueva Categoría
        </Button>
      </div>

      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <TagsOutlined />
            <span>{editing ? 'Editar Categoría' : 'Crear Categoría'}</span>
          </Space>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        okText={editing ? 'Actualizar' : 'Crear'}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item name="nombre" label="Nombre" rules={[{ required: true, message: 'Ingrese el nombre' }]}>
            <Input placeholder="Ej: Bebidas" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
