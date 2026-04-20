import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Card, Button, Input, Space, Typography, Tag, 
  Modal, Form, InputNumber, Select, Descriptions, Divider, Popconfirm, Badge, Row, Col, Switch
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, HistoryOutlined, ExclamationCircleOutlined,
  BarcodeOutlined
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { 
  getProductos, createProducto, updateProducto, deleteProducto, getKardex 
} from '../../api/inventario.api';
import { getProveedores } from '../../api/proveedores.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StockBadge from '../../components/StockBadge';
import { useAuthStore } from '../../store/authStore';

const { Title, Text } = Typography;
const { Option } = Select;

export default function InventarioPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isKardexVisible, setIsKardexVisible] = useState(false);
  const [kardexData, setKardexData] = useState([]);
  const [editingProducto, setEditingProducto] = useState(null);
  const [form] = Form.useForm();
  const { isAdmin } = useAuthStore();

  const lastAutoPrecioCompraRef = useRef(null);

  const calcPrecioCompraFromVentaMargen = (precioVenta, margenPct) => {
    const pv = Number(precioVenta);
    const m = Number(margenPct);
    if (!isFinite(pv) || !isFinite(m)) return null;
    if (pv < 0) return null;
    // margen sobre precio de venta (utilidad bruta): compra = venta * (1 - margen%)
    const pc = pv * (1 - (m / 100));
    if (!isFinite(pc) || pc < 0) return null;
    // Redondear a 2 decimales
    return Math.round(pc * 100) / 100;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resProd, resProv] = await Promise.all([
        getProductos({ buscar: busqueda }),
        getProveedores()
      ]);
      setData(resProd.data);
      setProveedores(resProv.data);
    } catch (err) {
      toast.error('Error al cargar datos del inventario');
    } finally {
      setLoading(false);
    }
  };

  // Estado para el scanner global
  const [isScanning, setIsScanning] = useState(false);
  const lastKeyTime = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Ignorar si estamos en campos de texto que NO sean el de búsqueda o el de código
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      const isSearchInput = e.target.id === 'inventario-search';
      const isCodeInput = e.target.id === 'codigo' || e.target.id === 'form_item_codigo';

      if (e.key === 'F10') {
        e.preventDefault();
        document.getElementById('inventario-search')?.focus();
        return;
      }

      // 2. Lógica de Scanner Global
      // Si no hay otros inputs enfocados (o si es el de búsqueda o el del modal)
      if (!isInput || isSearchInput || isCodeInput) {
        const currentTime = Date.now();
        const diff = currentTime - lastKeyTime.current;
        lastKeyTime.current = currentTime;

        // Si es una tecla alfanumérica y no tiene modificadores
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          
          if (isModalVisible) {
             // Si el modal está abierto, redirigir al campo 'codigo' del formulario
             if (!isCodeInput) {
               e.preventDefault();
               const currentCodigo = form.getFieldValue('codigo') || '';
               form.setFieldsValue({ codigo: currentCodigo + e.key });
             }
          } else {
             // Si el modal está cerrado, redirigir al buscador general
             if (!isSearchInput) {
               e.preventDefault();
               const searchEl = document.getElementById('inventario-search');
               if (searchEl) {
                 searchEl.focus();
                 setBusqueda(prev => prev + e.key);
               }
             }
          }

          // Indicador visual de escaneo rápido
          if (diff < 50) {
            setIsScanning(true);
            clearTimeout(window.scanTimeoutInv);
            window.scanTimeoutInv = setTimeout(() => setIsScanning(false), 1000);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(window.scanTimeoutInv);
    };
  }, [isModalVisible, busqueda]);

  useEffect(() => {
    fetchData();
  }, [busqueda]);

  const handleOpenModal = (producto = null) => {
    setEditingProducto(producto);
    if (producto) {
      form.setFieldsValue({
        ...producto,
        controlaStock: producto.controlaStock !== false,
      });
    } else {
      form.resetFields();
      // Si hay algo en la búsqueda que parece código, pre-llenarlo
      const looksLikeCode = busqueda && busqueda.length > 3 && !isNaN(busqueda);
      form.setFieldsValue({ 
        stock: 0, 
        stockMinimo: 5, 
        precioCompra: 0, 
        precioVenta: 0,
        controlaStock: true,
        codigo: looksLikeCode ? busqueda : ''
      });
    }
    setIsModalVisible(true);
  };

  const onFinish = async (values) => {
    try {
      const payload = { ...values };
      delete payload.margenGanancia;
      if (editingProducto) {
        await updateProducto(editingProducto._id, payload);
        toast.success('Producto actualizado');
      } else {
        await createProducto(payload);
        toast.success('Producto creado');
      }
      setIsModalVisible(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar producto');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProducto(id);
      toast.success('Producto eliminado');
      fetchData();
    } catch (err) {
      toast.error('Error al eliminar producto');
    }
  };

  const showKardex = async (producto) => {
    try {
      const res = await getKardex(producto._id);
      setKardexData(res.data);
      setEditingProducto(producto);
      setIsKardexVisible(true);
    } catch (err) {
      toast.error('Error al cargar historial del Kardex');
    }
  };

  const columns = [
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (text, record) => (
        <Space orientation="vertical" size={0} style={{ lineHeight: 1 }}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <BarcodeOutlined /> {record.codigo || 'S/C'} | {record.categoria}
          </Text>
        </Space>
      )
    },
    {
      title: 'Precio Compra',
      dataIndex: 'precioCompra',
      render: (val) => formatCurrency(val),
      responsive: ['md']
    },
    {
      title: 'Precio Venta',
      dataIndex: 'precioVenta',
      render: (val) => <Text strong style={{ color: '#1677ff' }}>{formatCurrency(val)}</Text>
    },
    {
      title: 'Margen (%)',
      render: (_, record) => {
        const margen = ((record.precioVenta - record.precioCompra) / record.precioVenta) * 100;
        return <Tag color={margen > 30 ? 'green' : 'blue'}>{margen.toFixed(1)}%</Tag>;
      },
      responsive: ['lg']
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      render: (val, record) => (
        <StockBadge stock={val} stockMinimo={record.stockMinimo} controlaStock={record.controlaStock} />
      )
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      render: (_, record) => (
        <Space>
           <Button icon={<HistoryOutlined />} size="small" onClick={() => showKardex(record)}>Kardex</Button>
           {isAdmin() && (
             <>
               <Button icon={<EditOutlined />} size="small" type="primary" ghost onClick={() => handleOpenModal(record)} />
               <Popconfirm title="¿Eliminar producto?" onConfirm={() => handleDelete(record._id)}>
                 <Button icon={<DeleteOutlined />} size="small" danger ghost />
               </Popconfirm>
             </>
           )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Inventario</Title>
          <Text className="page-sub">Gestión de productos y control de stock centralizado.</Text>
        </div>
        {isAdmin() && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            Nuevo Producto
          </Button>
        )}
      </div>

      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <div style={{ padding: 16 }}>
          <Input 
            id="inventario-search"
            placeholder="Buscar por nombre o código de barras (F10)..." 
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            allowClear
            size="large"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ maxWidth: 400 }}
          />
        </div>
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="_id" 
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
        <div className="pos-shortcuts-bar" style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0' }}>
            <span><Tag color="blue">F10</Tag> Buscar</span>
            <Divider type="vertical" />
            <span className={isScanning ? 'scanner-active-pulse' : ''}>
              <Tag color={isScanning ? 'success' : 'default'} icon={<BarcodeOutlined />}>
                {isScanning ? 'Escaneando...' : 'Scanner Listo'}
              </Tag>
            </span>
        </div>
      </Card>

      {/* Modal CRUD */}
      <Modal
        title={editingProducto ? 'Editar Producto' : 'Crear Producto'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
        okText={editingProducto ? 'Actualizar' : 'Crear'}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="nombre" label="Nombre del Producto" rules={[{ required: true }]}>
                <Input placeholder="Ej: Coca Cola 3 Litros" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="codigo" label="Código de Barras">
                <Input id="form_item_codigo" placeholder="Escanee o ingrese código" prefix={<BarcodeOutlined />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="precioCompra" label="Precio Compra" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  formatter={val => `C$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={val => val.replace(/\C\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="precioVenta" label="Precio Venta" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  formatter={val => `C$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={val => val.replace(/\C\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="margenGanancia"
                label="Margen (%)"
                tooltip="Calcula el Precio Compra usando: compra = venta * (1 - margen/100). Ej: venta 100, margen 30 => compra 70."
              >
                <InputNumber style={{ width: '100%' }} min={0} max={99.99} step={0.1} />
              </Form.Item>
            </Col>

            <Form.Item noStyle shouldUpdate={(prev, cur) => (
              prev.precioVenta !== cur.precioVenta ||
              prev.margenGanancia !== cur.margenGanancia ||
              prev.precioCompra !== cur.precioCompra
            )}>
              {({ getFieldValue, setFieldsValue }) => {
                const pv = getFieldValue('precioVenta');
                const margen = getFieldValue('margenGanancia');
                const currentPc = getFieldValue('precioCompra');
                const nextPc = calcPrecioCompraFromVentaMargen(pv, margen);

                // Solo autocalcular si:
                // - hay pv y margen
                // - y el usuario no ha sobreescrito manualmente (precioCompra coincide con el último autocalculado, o está vacío/0)
                if (nextPc !== null) {
                  const lastAuto = lastAutoPrecioCompraRef.current;
                  const currentNum = currentPc === undefined || currentPc === null || currentPc === '' ? null : Number(currentPc);

                  const isEmptyOrZero = currentNum === null || !isFinite(currentNum) || currentNum === 0;
                  const matchesLastAuto = lastAuto !== null && isFinite(currentNum) && Number(currentNum) === Number(lastAuto);

                  if (isEmptyOrZero || matchesLastAuto) {
                    if (currentNum !== nextPc) {
                      lastAutoPrecioCompraRef.current = nextPc;
                      setFieldsValue({ precioCompra: nextPc });
                    }
                  }
                }

                return null;
              }}
            </Form.Item>
            <Col span={8}>
              <Form.Item name="categoria" label="Categoría" initialValue="General">
                <Select>
                  <Option value="General">General</Option>
                  <Option value="Bebidas">Bebidas</Option>
                  <Option value="Alimentos">Alimentos</Option>
                  <Option value="Limpieza">Limpieza</Option>
                  <Option value="Hogar">Hogar</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item
                name="controlaStock"
                label="Control de Stock"
                valuePropName="checked"
                tooltip="Si está apagado, el producto se puede vender sin afectar inventario (ej: café, sándwich)."
              >
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>

            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.controlaStock !== cur.controlaStock}>
              {({ getFieldValue, setFieldsValue }) => {
                const controlaStock = getFieldValue('controlaStock') !== false;
                if (!controlaStock) {
                  const s = getFieldValue('stock');
                  const sm = getFieldValue('stockMinimo');
                  if (Number(s) !== 0 || Number(sm) !== 0) {
                    setFieldsValue({ stock: 0, stockMinimo: 0 });
                  }
                }

                return (
                  <>
                    <Col span={8}>
                      <Form.Item name="stock" label="Stock Inicial" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={0} disabled={!controlaStock} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="stockMinimo" label="Stock Mínimo" initialValue={5}>
                        <InputNumber style={{ width: '100%' }} min={0} disabled={!controlaStock} />
                      </Form.Item>
                    </Col>
                  </>
                );
              }}
            </Form.Item>
            <Col span={8}>
              <Form.Item name="proveedorId" label="Proveedor">
                <Select placeholder="Seleccione..." allowClear>
                  {proveedores.map(p => (
                    <Option key={p._id} value={p._id}>{p.nombre}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="descripcion" label="Descripción (Opcional)">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Kardex */}
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            <span>Kardex: {editingProducto?.nombre}</span>
          </Space>
        }
        open={isKardexVisible}
        onCancel={() => setIsKardexVisible(false)}
        footer={null}
        width={800}
      >
        <Table 
          dataSource={kardexData}
          rowKey="_id"
          size="small"
          columns={[
            { title: 'Fecha', dataIndex: 'createdAt', render: val => formatDateTime(val) },
            { 
              title: 'Tipo', 
              dataIndex: 'tipo', 
              render: val => (
                <Tag color={val === 'entrada' ? 'green' : val === 'salida' ? 'red' : 'orange'}>
                  {val.toUpperCase()}
                </Tag>
              )
            },
            { title: 'Cant.', dataIndex: 'cantidad', align: 'center' },
            { title: 'Stock Ant.', dataIndex: 'stockAnterior', align: 'center' },
            { title: 'Nuevo Stock', dataIndex: 'stockNuevo', align: 'center', render: val => <Text strong>{val}</Text> },
            { title: 'Motivo', dataIndex: 'motivo', ellipsis: true },
            { title: 'Usuario', dataIndex: 'usuarioId', render: val => val?.nombre }
          ]}
        />
      </Modal>
    </div>
  );
}
