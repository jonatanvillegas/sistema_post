import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Card, Button, Input, Space, Typography, Tag, 
  Modal, Form, InputNumber, Row, Col, Divider, 
  List, message, Alert, Tabs, Badge, Select
} from 'antd';
import { 
  UserOutlined, SearchOutlined, PlusOutlined, 
  EditOutlined, CreditCardOutlined, HistoryOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  WalletOutlined
} from '@ant-design/icons';
import { getClientes, getClienteById, createCliente, updateCliente } from '../../api/clientes.api';
import { getCreditosByCliente, registrarAbono, getCreditoDetalle, updateCreditoVentaProductos } from '../../api/creditos.api';
import { getProductos } from '../../api/inventario.api';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/formatters';

const { Title, Text } = Typography;

export default function ClientesPage() {
  const currentUserRole = useAuthStore((s) => s.usuario?.rol);
  const isAdmin = currentUserRole === 'admin';

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

  // Detalle Venta (Crédito)
  const [isDetalleVisible, setIsDetalleVisible] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleCredito, setDetalleCredito] = useState(null);

  // Editar Venta (solo admin)
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editCredito, setEditCredito] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [productoOptions, setProductoOptions] = useState([]);
  const [loadingProductoOptions, setLoadingProductoOptions] = useState(false);
  const searchProductosTimeoutRef = useRef(null);

  useEffect(() => {
    cargarClientes();
  }, [buscar]);

  const mergeProductoOptions = (incoming) => {
    setProductoOptions((prev) => {
      const byId = new Map(prev.map((item) => [String(item.value), item]));
      for (const item of incoming) {
        byId.set(String(item.value), item);
      }
      return Array.from(byId.values());
    });
  };

  const handleBuscarProductosCredito = (value = '') => {
    if (searchProductosTimeoutRef.current) {
      clearTimeout(searchProductosTimeoutRef.current);
    }

    searchProductosTimeoutRef.current = setTimeout(async () => {
      setLoadingProductoOptions(true);
      try {
        const res = await getProductos({ buscar: value, limit: 20 });
        const productos = Array.isArray(res.data?.productos) ? res.data.productos : (Array.isArray(res.data) ? res.data : []);
        mergeProductoOptions(productos.map((p) => ({
          value: p._id,
          label: `${p.nombre}${p.codigo ? ` (${p.codigo})` : ''}`,
          nombre: p.nombre,
          codigo: p.codigo || '',
          precioVenta: Number(p.precioVenta) || 0,
        })));
      } catch {
        if (!value) setProductoOptions([]);
      } finally {
        setLoadingProductoOptions(false);
      }
    }, 250);
  };

  const getSaldoDisponible = (cliente) => {
    const limite = Number(cliente?.limiteCredito) || 0;
    const deuda = Number(cliente?.saldoActual) || 0;
    if (limite <= 0) return 0;
    return Math.max(0, limite - deuda);
  };

  const cargarClientes = async () => {
    setLoading(true);
    try {
      const res = await getClientes(buscar);
      setClientes(res.data);
    } catch {
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

  const showStatement = async (clienteOrId) => {
    const clienteId = typeof clienteOrId === 'string' ? clienteOrId : clienteOrId?._id;
    if (!clienteId) return;

    setIsStatementVisible(true);
    setLoadingCreditos(true);
    try {
      const [clienteRes, creditosRes] = await Promise.all([
        getClienteById(clienteId),
        getCreditosByCliente(clienteId),
      ]);

      setSelectedCliente(clienteRes.data);
      const res = creditosRes;
      setCreditos(res.data);
    } catch {
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
      await showStatement(selectedCliente?._id);
      cargarClientes();
    } catch (err) {
      const data = err?.response?.data;
      const detalle = data?.error ? `: ${data.error}` : '';
      message.error(`${data?.mensaje || 'Error al registrar abono'}${detalle}`);
    }
  };

  const openDetalleCredito = async (creditoRecord) => {
    setIsDetalleVisible(true);
    setDetalleLoading(true);
    setDetalleCredito(null);
    try {
      const res = await getCreditoDetalle(creditoRecord._id);
      setDetalleCredito(res.data);
    } catch (err) {
      message.error(err.response?.data?.mensaje || 'Error al cargar detalle del crédito');
    } finally {
      setDetalleLoading(false);
    }
  };

  const openEditarVentaCredito = async (creditoRecord) => {
    setIsEditVisible(true);
    setEditLoading(true);
    setEditCredito(null);
    setLineItems([]);
    try {
      const res = await getCreditoDetalle(creditoRecord._id);
      const credito = res.data;
      setEditCredito(credito);

      const items = (credito?.ventaId?.productos || []).map((p, idx) => ({
        key: `${String(p.productoId)}-${idx}`,
        productoId: p.productoId,
        nombre: p.nombre,
        codigo: p.codigo,
        cantidad: Number(p.cantidad) || 1,
        precioUnitario: Number(p.precioUnitario) || 0,
      }));

      setLineItems(items);
      mergeProductoOptions(items.map((item) => ({
        value: item.productoId,
        label: `${item.nombre}${item.codigo ? ` (${item.codigo})` : ''}`,
        nombre: item.nombre,
        codigo: item.codigo || '',
        precioVenta: Number(item.precioUnitario) || 0,
      })));
    } catch (err) {
      message.error(err.response?.data?.mensaje || 'Error al cargar venta del crédito');
    } finally {
      setEditLoading(false);
    }
  };

  const updateLineItem = (key, patch) => {
    setLineItems((prev) => prev.map((li) => (li.key === key ? { ...li, ...patch } : li)));
  };

  const addLineItem = () => {
    setLineItems((prev) => ([
      ...prev,
      {
        key: `new-${Date.now()}`,
        productoId: null,
        nombre: '',
        codigo: '',
        cantidad: 1,
        precioUnitario: 0,
      },
    ]));
  };

  const removeLineItem = (key) => {
    setLineItems((prev) => prev.filter((li) => li.key !== key));
  };

  const saveEditarVentaCredito = async () => {
    if (!editCredito?._id) return;
    try {
      setEditLoading(true);
      const payload = {
        productos: lineItems.map((li) => ({
          productoId: li.productoId,
          cantidad: li.cantidad,
          precioUnitario: li.precioUnitario,
        })),
      };

      await updateCreditoVentaProductos(editCredito._id, payload);
      message.success('Venta actualizada correctamente');
      setIsEditVisible(false);
      await showStatement(selectedCliente?._id);
      cargarClientes();
    } catch (err) {
      const data = err?.response?.data;
      message.error(data?.mensaje || 'Error al actualizar la venta');
    } finally {
      setEditLoading(false);
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
      title: 'Disponible',
      key: 'saldoDisponible',
      render: (_v, record) => {
        const disponible = getSaldoDisponible(record);
        const sinCredito = (Number(record?.limiteCredito) || 0) <= 0;

        return (
          <Tag
            color={sinCredito ? 'default' : disponible > 0 ? 'green' : 'red'}
            style={{ fontSize: 13, padding: '2px 10px' }}
          >
            {sinCredito ? 'N/A' : formatCurrency(disponible)}
          </Tag>
        );
      }
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
            onClick={() => showStatement(record._id)}
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
          message={`Crédito Disponible: ${formatCurrency(getSaldoDisponible(selectedCliente))}`}
          description={`Límite: ${formatCurrency(selectedCliente?.limiteCredito || 0)} | Deuda Total: ${formatCurrency(selectedCliente?.saldoActual || 0)}`}
          type={getSaldoDisponible(selectedCliente) > 0 ? "success" : "warning"}
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
                  <Button size="small" onClick={() => openDetalleCredito(record)}>
                    Detalle
                  </Button>
                  {isAdmin && record.estado !== 'anulado' && (
                    <Button size="small" onClick={() => openEditarVentaCredito(record)}>
                      Editar productos
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

      {/* MODAL DETALLE DE VENTA (CRÉDITO) */}
      <Modal
        title={`Detalle de Venta: ${detalleCredito?.ventaId?.numeroVenta || ''}`}
        open={isDetalleVisible}
        onCancel={() => setIsDetalleVisible(false)}
        footer={null}
        width={800}
      >
        {detalleLoading ? (
          <div style={{ padding: 20 }}>Cargando...</div>
        ) : (
          <>
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <Text type="secondary">Cliente:</Text>
                <div><Text strong>{detalleCredito?.ventaId?.cliente?.nombre || detalleCredito?.clienteId?.nombre || 'N/A'}</Text></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Total:</Text>
                <div><Text strong>{formatCurrency(detalleCredito?.ventaId?.total || 0)}</Text></div>
              </Col>
            </Row>

            <Table
              size="small"
              pagination={false}
              rowKey={(_r, idx) => idx}
              dataSource={detalleCredito?.ventaId?.productos || []}
              columns={[
                { title: 'Producto', dataIndex: 'nombre' },
                { title: 'Código', dataIndex: 'codigo', width: 120 },
                { title: 'Cant.', dataIndex: 'cantidad', width: 90 },
                { title: 'Precio', dataIndex: 'precioUnitario', width: 120, render: (v) => formatCurrency(v) },
                { title: 'Subtotal', dataIndex: 'subtotal', width: 120, render: (v) => formatCurrency(v) },
              ]}
            />
          </>
        )}
      </Modal>

      {/* MODAL EDITAR PRODUCTOS (SOLO ADMIN) */}
      <Modal
        title={`Editar productos: ${editCredito?.ventaId?.numeroVenta || ''}`}
        open={isEditVisible}
        onCancel={() => setIsEditVisible(false)}
        onOk={saveEditarVentaCredito}
        okText="Guardar"
        confirmLoading={editLoading}
        width={900}
      >
        <Alert
          type="warning"
          showIcon
          message="Solo Administrador"
          description={`Esta acción ajusta stock y recalcula el total del crédito manteniendo los abonos ya registrados. No puede dejar el nuevo total por debajo de lo ya abonado (${formatCurrency((editCredito?.abonos || []).reduce((sum, abono) => sum + Number(abono?.monto || 0), 0))}).`}
          style={{ marginBottom: 12 }}
        />

        <Space style={{ marginBottom: 12 }}>
          <Button onClick={addLineItem}>Agregar producto</Button>
        </Space>

        <Table
          size="small"
          pagination={false}
          rowKey="key"
          dataSource={lineItems}
          columns={[
            {
              title: 'Producto',
              dataIndex: 'productoId',
              render: (_v, record) => (
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  placeholder="Buscar producto..."
                  value={record.productoId}
                  filterOption={false}
                  onSearch={handleBuscarProductosCredito}
                  loading={loadingProductoOptions}
                  notFoundContent={loadingProductoOptions ? 'Buscando...' : 'Sin resultados'}
                  options={productoOptions}
                  onChange={(value) => {
                    const p = productoOptions.find((x) => String(x.value) === String(value));
                    updateLineItem(record.key, {
                      productoId: value,
                      nombre: p?.nombre || '',
                      codigo: p?.codigo || '',
                      precioUnitario: Number(record.precioUnitario) > 0 ? record.precioUnitario : Number(p?.precioVenta || 0),
                    });
                  }}
                />
              ),
            },
            {
              title: 'Cant.',
              dataIndex: 'cantidad',
              width: 120,
              render: (v, record) => (
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  value={v}
                  onChange={(val) => updateLineItem(record.key, { cantidad: Number(val) || 1 })}
                />
              ),
            },
            {
              title: 'Precio',
              dataIndex: 'precioUnitario',
              width: 150,
              render: (v, record) => (
                <InputNumber
                  min={0.01}
                  precision={2}
                  style={{ width: '100%' }}
                  value={v}
                  onChange={(val) => updateLineItem(record.key, { precioUnitario: Number(val) || 0 })}
                />
              ),
            },
            {
              title: 'Subtotal',
              key: 'subtotal',
              width: 150,
              render: (_v, record) => formatCurrency((Number(record.cantidad) || 0) * (Number(record.precioUnitario) || 0)),
            },
            {
              title: 'Acción',
              key: 'accion',
              width: 120,
              render: (_v, record) => (
                <Button danger size="small" onClick={() => removeLineItem(record.key)}>Quitar</Button>
              ),
            },
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
