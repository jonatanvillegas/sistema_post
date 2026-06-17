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
import { useSearchParams } from 'react-router-dom';
import { 
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  getKardex,
  darBajaStockDanado,
  exportInventarioExcel,
} from '../../api/inventario.api';
import { getProveedores } from '../../api/proveedores.api';
import { getCategorias } from '../../api/categorias.api';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StockBadge from '../../components/StockBadge';
import { useAuthStore } from '../../store/authStore';
import JsBarcode from 'jsbarcode';

const { Title, Text } = Typography;
const { Option } = Select;

const calcEan13CheckDigit = (base12) => {
  const s = String(base12 || '').replace(/\D/g, '');
  if (s.length !== 12) return null;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(s[i]);
    if (!Number.isFinite(digit)) return null;
    // posiciones 1..12 desde la izquierda
    const pos = i + 1;
    sum += pos % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
};

const generateEan13 = () => {
  // Prefijo interno 2 + (timestamp 9 dígitos) + (random 2 dígitos) = 12 dígitos
  const ts = String(Date.now() % 1_000_000_000).padStart(9, '0');
  const rand = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  const base12 = `2${ts}${rand}`;
  const check = calcEan13CheckDigit(base12);
  if (check === null) return '';
  return `${base12}${check}`;
};

export default function InventarioPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [stockBajoFilter, setStockBajoFilter] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isKardexVisible, setIsKardexVisible] = useState(false);
  const [isDanadoVisible, setIsDanadoVisible] = useState(false);
  const [kardexData, setKardexData] = useState([]);
  const [editingProducto, setEditingProducto] = useState(null);
  const [form] = Form.useForm();
  const [formDanado] = Form.useForm();
  const { isAdmin, hasAnyRole } = useAuthStore();
  const canManage = hasAnyRole(['admin', 'inventario']);
  const [exporting, setExporting] = useState(false);
  const [loadingDanado, setLoadingDanado] = useState(false);

  const [searchParams] = useSearchParams();

  const isAutoUpdatingRef = useRef(false);
  const barcodeCanvasRef = useRef(null);
  const codigoValue = Form.useWatch('codigo', form);
  const categoriaValue = Form.useWatch('categoria', form);
  const [barcodeError, setBarcodeError] = useState('');
  const [barcodeAssistEnabled, setBarcodeAssistEnabled] = useState(false);

  useEffect(() => {
    const qStockBajo = searchParams.get('stockBajo') === 'true';
    const qBuscar = searchParams.get('buscar');
    setStockBajoFilter(qStockBajo);
    if (qBuscar !== null) setBusqueda(qBuscar);
  }, [searchParams]);

  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  const getBarcodeFormat = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return null;
    const digitsOnly = /^\d+$/.test(s);
    if (digitsOnly && (s.length === 12 || s.length === 13)) return 'EAN13';
    return 'CODE128';
  };

  const downloadBarcodePng = () => {
    const canvas = barcodeCanvasRef.current;
    const code = String(form.getFieldValue('codigo') || '').trim();
    if (!canvas || !code) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `barcode_${code}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error('No se pudo descargar el código de barras');
    }
  };

  useEffect(() => {
    if (!isModalVisible) return;
    if (!barcodeAssistEnabled) {
      const canvas = barcodeCanvasRef.current;
      const ctx = canvas?.getContext?.('2d');
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setBarcodeError('');
      return;
    }
    const canvas = barcodeCanvasRef.current;
    const code = String(codigoValue || '').trim();
    if (!canvas) return;

    // Limpiar canvas si no hay código
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setBarcodeError('');
    if (!code) return;

    const format = getBarcodeFormat(code);
    if (!format) return;

    try {
      JsBarcode(canvas, code, {
        format,
        displayValue: true,
        margin: 8,
        height: 60,
        fontSize: 14,
      });
    } catch {
      setBarcodeError('Código inválido para generar imagen');
    }
  }, [isModalVisible, barcodeAssistEnabled, codigoValue]);

  // Fórmula única (margen como % entero):
  // precioVenta = precioCompra / (1 - (margenPct/100))
  const calcPrecioVentaFromCompraMargen = (precioCompra, margenPct) => {
    const pc = Number(precioCompra);
    const mPct = Number(margenPct);
    if (!isFinite(pc) || !isFinite(mPct)) return null;
    if (pc < 0) return null;
    if (mPct < 0 || mPct >= 100) return null;
    const m = mPct / 100;
    const pv = pc / (1 - m);
    if (!isFinite(pv) || pv < 0) return null;
    return round2(pv);
  };

  const calcMargenFromCompraVenta = (precioCompra, precioVenta) => {
    const pc = Number(precioCompra);
    const pv = Number(precioVenta);
    if (!isFinite(pc) || !isFinite(pv)) return null;
    if (pv <= 0) return null;
    // margen sobre precio de venta (utilidad bruta)
    const mPct = ((pv - pc) / pv) * 100;
    if (!isFinite(mPct)) return null;
    // Margen debe ser entero
    return Math.round(mPct);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resProd, resProv] = await Promise.all([
        getProductos({ buscar: busqueda, stockBajo: stockBajoFilter ? 'true' : undefined }),
        getProveedores()
      ]);
      setData(resProd.data);
      setProveedores(resProv.data);
    } catch {
      toast.error('Error al cargar datos del inventario');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await exportInventarioExcel({
        buscar: busqueda || undefined,
        stockBajo: stockBajoFilter ? 'true' : undefined,
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const pad2 = (n) => String(n).padStart(2, '0');
      const now = new Date();
      const fname = `inventario_${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err?.response?.data?.mensaje || 'Error al descargar Excel');
    } finally {
      setExporting(false);
    }
  };

  const fetchCategorias = async () => {
    try {
      const res = await getCategorias();
      setCategorias(Array.isArray(res.data) ? res.data : []);
    } catch {
      // No bloquear inventario si falla categorías
      setCategorias([]);
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
    fetchCategorias();
  }, []);

  useEffect(() => {
    fetchData();
  }, [busqueda, stockBajoFilter]);

  const handleOpenModal = (producto = null) => {
    setEditingProducto(producto);
    setBarcodeAssistEnabled(false);
    if (producto) {
      form.setFieldsValue({
        ...producto,
        controlaStock: producto.controlaStock !== false,
        margenGanancia: calcMargenFromCompraVenta(producto.precioCompra, producto.precioVenta) || 0
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

  const handleFormValuesChange = (changedValues, allValues) => {
    if (isAutoUpdatingRef.current) return;

    const changedKeys = Object.keys(changedValues || {});
    const changedKey = changedKeys[0];
    if (!changedKey) return;
    if (!['precioCompra', 'precioVenta', 'margenGanancia'].includes(changedKey)) return;

    const { precioCompra, precioVenta, margenGanancia } = allValues;
    const pc = Number(precioCompra);
    const pv = Number(precioVenta);
    const m = Number(margenGanancia);

    const next = {};

    // Reglas:
    // - Si cambia compra o margen => recalcular precio de venta
    // - Si cambia precio de venta => recalcular margen (sin tocar compra)
    if (changedKey === 'precioVenta') {
      if (isFinite(pc) && pc >= 0 && isFinite(pv) && pv > 0) {
        const nextM = calcMargenFromCompraVenta(pc, pv);
        if (nextM !== null && isFinite(nextM)) next.margenGanancia = nextM;
      }
    } else {
      if (isFinite(pc) && pc >= 0 && isFinite(m)) {
        const nextPv = calcPrecioVentaFromCompraMargen(pc, m);
        if (nextPv !== null && isFinite(nextPv) && nextPv >= 0) next.precioVenta = nextPv;
      }
    }

    if (Object.keys(next).length === 0) return;
    isAutoUpdatingRef.current = true;
    form.setFieldsValue(next);
    isAutoUpdatingRef.current = false;
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
    } catch {
      toast.error('Error al eliminar producto');
    }
  };

  const showKardex = async (producto) => {
    try {
      const res = await getKardex(producto._id);
      setKardexData(res.data);
      setEditingProducto(producto);
      setIsKardexVisible(true);
    } catch {
      toast.error('Error al cargar historial del Kardex');
    }
  };

  const abrirModalDanado = (producto) => {
    setEditingProducto(producto);
    formDanado.setFieldsValue({
      cantidad: 1,
      motivo: `Baja de producto dañado: ${producto.nombre}`,
    });
    setIsDanadoVisible(true);
  };

  const handleDarBajaDanado = async (values) => {
    if (!editingProducto) return;
    setLoadingDanado(true);
    try {
      await darBajaStockDanado(editingProducto._id, values);
      toast.success('Stock dañado dado de baja');
      setIsDanadoVisible(false);
      formDanado.resetFields();
      fetchData();
      if (isKardexVisible) {
        showKardex(editingProducto);
      }
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al dar de baja stock dañado');
    } finally {
      setLoadingDanado(false);
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
        const pv = Number(record.precioVenta);
        const pc = Number(record.precioCompra);
        if (!isFinite(pv) || pv <= 0 || !isFinite(pc)) {
          return <Tag>—</Tag>;
        }
        const margen = ((pv - pc) / pv) * 100;
        if (!isFinite(margen)) return <Tag>—</Tag>;
        return <Tag color={margen > 30 ? 'green' : 'blue'}>{margen.toFixed(1)}%</Tag>;
      },
      responsive: ['lg']
    },
    {
      title: 'Stock',
      dataIndex: 'stock',
      render: (val, record) => (
        <Space direction="vertical" size={4}>
          <StockBadge stock={val} stockMinimo={record.stockMinimo} controlaStock={record.controlaStock} />
          {Number(record.stockDanado || 0) > 0 && (
            <Tag color="volcano">Dañado: {record.stockDanado}</Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      render: (_, record) => (
        <Space>
           <Button icon={<HistoryOutlined />} size="small" onClick={() => showKardex(record)}>Kardex</Button>
           {isAdmin() && Number(record.stockDanado || 0) > 0 && (
             <Button icon={<ExclamationCircleOutlined />} size="small" danger ghost onClick={() => abrirModalDanado(record)}>
               Baja Daño
             </Button>
           )}
           {canManage && (
             <>
               <Button icon={<EditOutlined />} size="small" type="primary" ghost onClick={() => handleOpenModal(record)} />
               {isAdmin() && (
                 <Popconfirm title="¿Eliminar producto?" onConfirm={() => handleDelete(record._id)}>
                   <Button icon={<DeleteOutlined />} size="small" danger ghost />
                 </Popconfirm>
               )}
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
        {canManage && (
          <Space>
            <Button loading={exporting} onClick={handleExportExcel}>
              Descargar Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              Nuevo Producto
            </Button>
          </Space>
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
        <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={handleFormValuesChange}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="nombre" label="Nombre del Producto" rules={[{ required: true }]}>
                <Input placeholder="Ej: Coca Cola 3 Litros" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="codigo" label="Código de Barras">
                <Input
                  id="form_item_codigo"
                  placeholder="Escanee o ingrese código"
                  prefix={<BarcodeOutlined />}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="precioCompra" label="Precio Compra" rules={[{ required: true }]}>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={0.01}
                  formatter={val => `C$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={val => val.replace(/C\$\s?|(,*)/g, '')}
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
                  parser={val => val.replace(/C\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="margenGanancia"
                label="Margen (%)"
                tooltip="Ingrese un entero. Precio Venta = Precio Compra / (1 - (Margen/100)). Si ajusta el Precio Venta manualmente (redondeo), se recalcula el Margen."
                rules={[
                  { required: true, message: 'Ingrese el margen (%)' },
                  {
                    validator: async (_, value) => {
                      if (value === undefined || value === null || value === '') return;
                      const m = Number(value);
                      if (!isFinite(m) || m < 0 || m >= 100) {
                        throw new Error('El margen debe ser un número entre 0 y 99');
                      }
                    },
                  },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={0} max={99} step={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="categoria" label="Categoría" initialValue="General">
                <Select>
                  {Array.from(
                    new Set([
                      'General',
                      ...(categorias || []).map((c) => c?.nombre).filter(Boolean),
                      ...(categoriaValue ? [categoriaValue] : []),
                    ])
                  ).map((nombre) => (
                    <Option key={nombre} value={nombre}>
                      {nombre}
                    </Option>
                  ))}
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

            <Col span={24}>
              <Divider orientation="left" style={{ marginTop: 4 }}>Código de barras (opcional)</Divider>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <Space size={10}>
                  <Switch
                    checked={barcodeAssistEnabled}
                    onChange={(checked) => {
                      setBarcodeAssistEnabled(checked);
                      if (checked) {
                        const current = String(form.getFieldValue('codigo') || '').trim();
                        if (!current) form.setFieldsValue({ codigo: generateEan13() });
                      }
                    }}
                    checkedChildren="Sí"
                    unCheckedChildren="No"
                  />
                  <Text>Ayuda con código de barras</Text>
                </Space>

                {barcodeAssistEnabled && (
                  <Space.Compact>
                    <Button size="small" onClick={() => form.setFieldsValue({ codigo: generateEan13() })}>
                      Generar
                    </Button>
                    <Button size="small" disabled={!String(form.getFieldValue('codigo') || '').trim()} onClick={downloadBarcodePng}>
                      Descargar
                    </Button>
                  </Space.Compact>
                )}
              </div>

              {barcodeAssistEnabled && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ overflow: 'hidden' }}>
                    <canvas
                      ref={barcodeCanvasRef}
                      style={{ maxWidth: '100%', background: '#fff', border: '1px dashed #d9d9d9', borderRadius: 8 }}
                    />
                  </div>
                  {barcodeError && (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {barcodeError}
                    </Text>
                  )}
                  {!barcodeError && String(form.getFieldValue('codigo') || '').trim() && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      Formato: {getBarcodeFormat(form.getFieldValue('codigo'))}
                    </Text>
                  )}
                </div>
              )}
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
        className="fullscreen-kardex-modal"
        open={isKardexVisible}
        onCancel={() => setIsKardexVisible(false)}
        footer={null}
        width="100vw"
        style={{ top: 0, paddingBottom: 0 }}
      >
        <Table 
          dataSource={kardexData}
          rowKey="_id"
          size="small"
          scroll={{ x: 'max-content', y: 'calc(100vh - 190px)' }}
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

      <Modal
        title={`Dar de baja stock dañado: ${editingProducto?.nombre || ''}`}
        open={isDanadoVisible}
        onCancel={() => setIsDanadoVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsDanadoVisible(false)}>
            Cancelar
          </Button>,
          <Button key="submit" type="primary" danger loading={loadingDanado} onClick={() => formDanado.submit()}>
            Dar de baja
          </Button>,
        ]}
      >
        <Form form={formDanado} layout="vertical" onFinish={handleDarBajaDanado}>
          <Form.Item label="Disponible dañado">
            <Text strong>{editingProducto?.stockDanado || 0}</Text>
          </Form.Item>
          <Form.Item name="cantidad" label="Cantidad" rules={[{ required: true, message: 'Ingrese la cantidad' }]}>
            <InputNumber min={1} max={Number(editingProducto?.stockDanado || 0)} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="motivo" label="Motivo" rules={[{ required: true, message: 'Ingrese el motivo' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
