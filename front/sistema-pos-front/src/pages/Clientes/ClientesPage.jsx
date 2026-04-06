import React, { useState, useEffect } from 'react';
import { 
  Table, Card, Button, Input, Space, Typography, Tag, 
  Modal, Form, InputNumber, Row, Col, Divider, 
  List, message, Alert, Tabs, Badge
} from 'antd';
import { 
  UserOutlined, SearchOutlined, PlusOutlined, 
  EditOutlined, CreditCardOutlined, HistoryOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { getClientes, createCliente, updateCliente } from '../../api/clientes.api';
import { getCreditosByCliente, registrarAbono } from '../../api/creditos.api';
import { formatCurrency } from '../../utils/formatters';

const { Title, Text } = Typography;

export default function ClientesPage() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buscar, setBuscar] = useState('');
  
  // Cliente Modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [form] = Form.useForm();

  // Estado de Cuenta Modal
  const [isStatementVisible, setIsStatementVisible] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState(null);
  const [creditos, setCreditos] = useState([]);
  const [loadingCreditos, setLoadingCreditos] = useState(false);

  // Abono Modal
  const [isAbonoVisible, setIsAbonoVisible] = useState(false);
  const [selectedCredito, setSelectedCredito] = useState(null);
  const [abonoForm] = Form.useForm();

  useEffect(() => {
    cargarClientes();
  }, [buscar]);

  const cargarClientes = async () => {
    setLoading(true);
    try {
      const res = await getClientes(buscar);
      setClientes(res.data);
    } catch (err) {
      message.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (values) => {
    try {
      if (editingCliente) {
        await updateCliente(editingCliente._id, values);
        message.success('Cliente actualizado');
      } else {
        await createCliente(values);
        message.success('Cliente creado');
      }
      setIsModalVisible(false);
      cargarClientes();
    } catch (err) {
      message.error(err.response?.data?.mensaje || 'Error al procesar');
    }
  };

  const showStatement = async (cliente) => {
    setSelectedCliente(cliente);
    setIsStatementVisible(true);
    setLoadingCreditos(true);
    try {
      const res = await getCreditosByCliente(cliente._id);
      setCreditos(res.data);
    } catch (err) {
      message.error('Error al cargar créditos');
    } finally {
      setLoadingCreditos(false);
    }
  };

  const handleAbono = async (values) => {
    try {
      await registrarAbono(selectedCredito._id, values);
      message.success('Abono registrado correctamente');
      setIsAbonoVisible(false);
      // Recargar datos
      showStatement(selectedCliente);
      cargarClientes();
    } catch (err) {
      message.error(err.response?.data?.mensaje || 'Error al registrar abono');
    }
  };

  const columns = [
    {
      title: 'Cliente',
      dataIndex: 'nombre',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>ID/NIT: {record.nit}</Text>
        </Space>
      )
    },
    { title: 'Telf.', dataIndex: 'telefono' },
    {
      title: 'Límite Crédito',
      dataIndex: 'limiteCredito',
      render: (v) => <Text>{formatCurrency(v)}</Text>
    },
    {
      title: 'Saldo Actual',
      dataIndex: 'saldoActual',
      render: (v) => (
        <Tag color={v > 0 ? 'red' : 'green'} style={{ fontSize: 13, padding: '2px 10px' }}>
          {formatCurrency(v)}
        </Tag>
      )
    },
    {
      title: 'Acciones',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => { 
              setEditingCliente(record); 
              form.setFieldsValue(record); 
              setIsModalVisible(true); 
            }} 
          />
          <Button 
            type="primary" 
            icon={<HistoryOutlined />} 
            onClick={() => showStatement(record)}
          >
            Estado Cuenta
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              <UserOutlined /> Gestión de Clientes
            </Title>
          </Col>
          <Col>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => { setEditingCliente(null); form.resetFields(); setIsModalVisible(true); }}>
              Nuevo Cliente
            </Button>
          </Col>
        </Row>

        <Input
          placeholder="Buscar cliente por nombre o NIT..."
          prefix={<SearchOutlined />}
          size="large"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          style={{ marginBottom: 20 }}
        />

        <Table 
          columns={columns} 
          dataSource={clientes} 
          loading={loading}
          rowKey="_id"
        />
      </Card>

      {/* MODAL CLIENTE */}
      <Modal
        title={editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate}>
          <Form.Item name="nombre" label="Nombre Completo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Row gutter={16}>
             <Col span={12}>
                <Form.Item name="nit" label="NIT / Cédula" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
             </Col>
             <Col span={12}>
                <Form.Item name="telefono" label="Teléfono">
                  <Input />
                </Form.Item>
             </Col>
          </Row>
          <Form.Item name="direccion" label="Dirección">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="limiteCredito" label="Límite de Crédito (C$)" initialValue={0}>
            <InputNumber style={{ width: '100%' }} precision={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">
            {editingCliente ? 'Guardar Cambios' : 'Crear Cliente'}
          </Button>
        </Form>
      </Modal>

      {/* MODAL ESTADO DE CUENTA */}
      <Modal
        title={`Estado de Cuenta: ${selectedCliente?.nombre}`}
        open={isStatementVisible}
        onCancel={() => setIsStatementVisible(false)}
        width={900}
        footer={null}
      >
        <Alert 
          message={`Deuda Total: ${formatCurrency(selectedCliente?.saldoActual || 0)}`}
          type={selectedCliente?.saldoActual > 0 ? "warning" : "success"}
          showIcon
          icon={<WalletOutlined />}
          style={{ marginBottom: 20, fontSize: 16, fontWeight: 'bold' }}
        />

        <Table
          loading={loadingCreditos}
          dataSource={creditos}
          rowKey="_id"
          columns={[
            { title: 'Venta', dataIndex: ['ventaId', 'numeroVenta'] },
            { title: 'Fecha', dataIndex: 'createdAt', render: (v) => new Date(v).toLocaleDateString() },
            { title: 'Monto Total', dataIndex: 'montoTotal', render: (v) => formatCurrency(v) },
            { title: 'Pendiente', dataIndex: 'saldoPendiente', render: (v) => <Text type="danger" strong>{formatCurrency(v)}</Text> },
            { 
              title: 'Estado', 
              dataIndex: 'estado',
              render: (e) => (
                <Tag color={e === 'pagado' ? 'green' : e === 'vencido' ? 'red' : 'gold'}>
                  {e.toUpperCase()}
                </Tag>
              )
            },
            {
              title: 'Acciones',
              render: (_, record) => (
                <Space>
                  {record.estado !== 'pagado' && (
                    <Button 
                      type="dashed" 
                      size="small" 
                      onClick={() => { setSelectedCredito(record); abonoForm.resetFields(); setIsAbonoVisible(true); }}
                    >
                      Abonar
                    </Button>
                  )}
                  <Button size="small" icon={<HistoryOutlined />} onClick={() => {
                    Modal.info({
                      title: 'Historial de Abonos',
                      width: 500,
                      content: (
                        <List
                          itemLayout="horizontal"
                          dataSource={record.abonos}
                          renderItem={item => (
                            <List.Item>
                              <List.Item.Meta
                                title={`${formatCurrency(item.monto)} - ${item.metodoPago.toUpperCase()}`}
                                description={`Fecha: ${new Date(item.fecha).toLocaleString()} | Comprobante: ${item.comprobante || 'N/A'}`}
                              />
                            </List.Item>
                          )}
                        />
                      )
                    });
                  }}>Historial</Button>
                </Space>
              )
            }
          ]}
        />
      </Modal>

      {/* MODAL REGISTRAR ABONO */}
      <Modal
        title="Registrar Pago / Abono"
        open={isAbonoVisible}
        onCancel={() => setIsAbonoVisible(false)}
        footer={null}
      >
        <Card size="small" style={{ marginBottom: 15, background: '#fafafa' }}>
           <Text type="secondary">Deuda Pendiente:</Text> <Title level={4} style={{ margin: 0, color: '#f5222d' }}>{formatCurrency(selectedCredito?.saldoPendiente || 0)}</Title>
        </Card>
        <Form form={abonoForm} layout="vertical" onFinish={handleAbono}>
           <Form.Item name="monto" label="Monto a Pagar (C$)" rules={[{ required: true }]}>
             <InputNumber style={{ width: '100%' }} precision={2} max={selectedCredito?.saldoPendiente} />
           </Form.Item>
           <Form.Item name="metodoPago" label="Método de Pago" initialValue="efectivo">
             <Tabs defaultActiveKey="efectivo" type="card" onChange={(key) => abonoForm.setFieldsValue({ metodoPago: key })}>
               <Tabs.TabPane tab="Efectivo" key="efectivo" />
               <Tabs.TabPane tab="Transferencia" key="transferencia" />
               <Tabs.TabPane tab="Tarjeta" key="tarjeta" />
             </Tabs>
           </Form.Item>
           <Form.Item name="comprobante" label="Referencia / Comprobante">
             <Input placeholder="Opcional" />
           </Form.Item>
           <Button type="primary" htmlType="submit" block size="large">
             Confirmar Pago
           </Button>
        </Form>
      </Modal>
    </div>
  );
}
