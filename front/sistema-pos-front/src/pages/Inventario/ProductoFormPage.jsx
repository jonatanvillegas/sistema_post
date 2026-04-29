import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, Form, Input, InputNumber, Button, Select, 
  Switch, Row, Col, Space, Typography, message, 
  Upload, Divider, Tooltip
} from 'antd';
import { 
  ArrowLeftOutlined, 
  SaveOutlined, 
  PlusOutlined,
  InboxOutlined,
  BarcodeOutlined,
  DownloadOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { createProducto, updateProducto, getProductoById } from '../../api/inventario.api';
import { getCategorias } from '../../api/categorias.api';
import { getProveedores } from '../../api/proveedores.api';
import JsBarcode from 'jsbarcode';

const { Title, Text } = Typography;

const calcEan13CheckDigit = (base12) => {
  const s = String(base12 || '').replace(/\D/g, '');
  if (s.length !== 12) return null;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(s[i]);
    if (!Number.isFinite(digit)) return null;
    const pos = i + 1;
    sum += pos % 2 === 0 ? digit * 3 : digit;
  }
  return (10 - (sum % 10)) % 10;
};

const generateEan13 = () => {
  const ts = String(Date.now() % 1_000_000_000).padStart(9, '0');
  const rand = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  const base12 = `2${ts}${rand}`;
  const check = calcEan13CheckDigit(base12);
  if (check === null) return '';
  return `${base12}${check}`;
};

export default function ProductoFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [fileList, setFileList] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);
  const [controlaStock, setControlaStock] = useState(true);
  
  const barcodeCanvasRef = useRef(null);
  const isAutoUpdatingRef = useRef(false);
  const codigoValue = Form.useWatch('codigo', form);
  const [barcodeError, setBarcodeError] = useState('');

  useEffect(() => {
    fetchData();
    if (isEdit) {
      fetchProducto();
    }
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      const isCodeInput = e.target.id === 'codigo' || e.target.id === 'form_item_codigo';
      
      if (!isInput || isCodeInput) {
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
           if (!isCodeInput) {
             e.preventDefault();
             const current = form.getFieldValue('codigo') || '';
             form.setFieldsValue({ codigo: current + e.key });
             document.getElementById('form_item_codigo')?.focus();
           }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const canvas = barcodeCanvasRef.current;
    const code = String(codigoValue || '').trim();
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setBarcodeError('');

    if (!code) return;

    try {
      const digitsOnly = /^\d+$/.test(code);
      const format = (digitsOnly && (code.length === 12 || code.length === 13)) ? 'EAN13' : 'CODE128';
      
      JsBarcode(canvas, code, {
        format,
        displayValue: true,
        height: 50,
        fontSize: 14,
        margin: 10
      });
    } catch {
      setBarcodeError('Código no válido para generar imagen');
    }
  }, [codigoValue]);

  const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  const calcPrecioVentaFromCompraMargen = (precioCompra, margenPct) => {
    const pc = Number(precioCompra);
    const mPct = Number(margenPct);
    if (!isFinite(pc) || !isFinite(mPct)) return null;
    if (pc < 0) return null;
    if (mPct < 0 || mPct >= 100) return null;
    const m = mPct / 100;
    const pv = pc / (1 - m);
    return isFinite(pv) && pv >= 0 ? round2(pv) : null;
  };

  const calcMargenFromCompraVenta = (precioCompra, precioVenta) => {
    const pc = Number(precioCompra);
    const pv = Number(precioVenta);
    if (!isFinite(pc) || !isFinite(pv) || pv <= 0) return null;
    const mPct = ((pv - pc) / pv) * 100;
    return isFinite(mPct) ? Math.round(mPct) : null;
  };

  const handleFormValuesChange = (changedValues, allValues) => {
    if (isAutoUpdatingRef.current) return;
    const changedKeys = Object.keys(changedValues || {});
    const key = changedKeys[0];
    if (!['precioCompra', 'precioVenta', 'margenGanancia'].includes(key)) return;

    const { precioCompra, precioVenta, margenGanancia } = allValues;
    const pc = Number(precioCompra);
    const pv = Number(precioVenta);
    const m = Number(margenGanancia);

    const next = {};
    if (key === 'precioVenta') {
      const nextM = calcMargenFromCompraVenta(pc, pv);
      if (nextM !== null) next.margenGanancia = nextM;
    } else {
      const nextPv = calcPrecioVentaFromCompraMargen(pc, m);
      if (nextPv !== null) next.precioVenta = nextPv;
    }

    if (Object.keys(next).length > 0) {
      isAutoUpdatingRef.current = true;
      form.setFieldsValue(next);
      isAutoUpdatingRef.current = false;
    }
  };

  const fetchData = async () => {
    try {
      const [catRes, provRes] = await Promise.all([getCategorias(), getProveedores()]);
      setCategorias(catRes.data);
      setProveedores(provRes.data);
    } catch {
      message.error('Error cargando catálogos');
    }
  };

  const fetchProducto = async () => {
    setFetching(true);
    try {
      const res = await getProductoById(id);
      const prod = res.data;
      const m = calcMargenFromCompraVenta(prod.precioCompra, prod.precioVenta);
      form.setFieldsValue({ ...prod, margenGanancia: m || 0 });
      setControlaStock(prod.controlaStock !== false);
      if (prod.imagen) {
        setImageUrl(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/productos/${prod.imagen}`);
      }
    } catch {
      message.error('Error cargando producto');
      navigate('/inventario');
    } finally {
      setFetching(false);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const formData = new FormData();
      const payload = { ...values };
      delete payload.margenGanancia;

      Object.keys(payload).forEach(k => {
        if (payload[k] !== undefined && payload[k] !== null) formData.append(k, payload[k]);
      });

      if (fileList.length > 0) formData.append('imagen', fileList[0].originFileObj);

      if (isEdit) {
        await updateProducto(id, formData);
        message.success('Actualizado correctamente');
      } else {
        await createProducto(formData);
        message.success('Creado correctamente');
      }
      navigate('/inventario');
    } catch (err) {
      message.error(err.response?.data?.mensaje || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = ({ fileList: newFileList }) => {
    setFileList(newFileList.slice(-1)); 
    if (newFileList.length > 0) {
      const file = newFileList[newFileList.length - 1];
      if (file.originFileObj) {
        const reader = new FileReader();
        reader.onload = e => setImageUrl(e.target.result);
        reader.readAsDataURL(file.originFileObj);
      }
    }
  };

  const downloadBarcode = () => {
    const canvas = barcodeCanvasRef.current;
    if (!canvas || !codigoValue) return;
    const link = document.createElement('a');
    link.download = `barcode-${codigoValue}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space direction="vertical" size={0}>
          <Title level={2} style={{ margin: 0 }}>{isEdit ? 'Editar Producto' : 'Nuevo Producto'}</Title>
          <Text type="secondary">Gestión detallada de artículos e inventario</Text>
        </Space>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/inventario')}>Volver</Button>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} onValuesChange={handleFormValuesChange} initialValues={{ controlaStock: true, stock: 0, stockMinimo: 5, precioCompra: 0, precioVenta: 0, margenGanancia: 0 }}>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card title="Datos Principales" className="dashboard-card" style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item name="codigo" label="Código de Barras" rules={[{ required: true }]}>
                    <Input id="form_item_codigo" prefix={<BarcodeOutlined />} placeholder="Escanee o ingrese código" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="nombre" label="Nombre" rules={[{ required: true }]}>
                    <Input placeholder="Ej: Coca Cola 600ml" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="categoria" label="Categoría">
                    <Select placeholder="Seleccione">
                      {categorias.map(c => <Select.Option key={c._id} value={c.nombre}>{c.nombre}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="proveedorId" label="Proveedor">
                    <Select placeholder="Seleccione">
                      {proveedores.map(p => <Select.Option key={p._id} value={p._id}>{p.nombre}</Select.Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="Precios y Margen" className="dashboard-card" style={{ marginBottom: 24 }}>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item name="precioCompra" label="Precio Compra ($)" rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} precision={2} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="margenGanancia" label="Margen (%)" tooltip="Basado en precio de venta">
                    <InputNumber style={{ width: '100%' }} min={0} max={99} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="precioVenta" label="Precio Venta ($)" rules={[{ required: true }]}>
                    <InputNumber style={{ width: '100%' }} precision={2} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="Inventario" className="dashboard-card">
              <Row gutter={16}>
                <Col xs={24} style={{ marginBottom: 16 }}>
                  <Form.Item name="controlaStock" valuePropName="checked" noStyle>
                    <Switch checkedChildren="Control de Stock Activado" unCheckedChildren="Sin Control de Stock" onChange={setControlaStock} />
                  </Form.Item>
                </Col>
                {controlaStock && (
                  <>
                    <Col xs={24} md={12}>
                      <Form.Item name="stock" label="Stock Actual">
                        <InputNumber style={{ width: '100%' }} min={0} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="stockMinimo" label="Stock Mínimo">
                        <InputNumber style={{ width: '100%' }} min={0} />
                      </Form.Item>
                    </Col>
                  </>
                )}
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card title="Imagen y Visual" className="dashboard-card" style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                {imageUrl ? <img src={imageUrl} alt="Preview" style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} /> : <div style={{ padding: 40, background: '#f5f5f5', borderRadius: 8 }}><InboxOutlined style={{ fontSize: 40, color: '#ccc' }} /></div>}
              </div>
              <Upload fileList={fileList} beforeUpload={file => { setFileList([file]); return false; }} onRemove={() => setFileList([])} showUploadList={false} onChange={handleChange}>
                <Button block icon={<PlusOutlined />}>Subir Imagen</Button>
              </Upload>
            </Card>

            <Card title="Generador de Código" className="dashboard-card" style={{ marginBottom: 24 }}>
              <div style={{ textAlign: 'center' }}>
                <canvas ref={barcodeCanvasRef} style={{ maxWidth: '100%', marginBottom: 10 }} />
                {barcodeError && <Text type="danger">{barcodeError}</Text>}
                <Space block direction="vertical">
                  <Button block icon={<SyncOutlined />} onClick={() => form.setFieldsValue({ codigo: generateEan13() })}>Generar Aleatorio</Button>
                  <Button block icon={<DownloadOutlined />} disabled={!codigoValue || barcodeError} onClick={downloadBarcode}>Descargar Imagen</Button>
                </Space>
              </div>
            </Card>

            <Button type="primary" size="large" block icon={<SaveOutlined />} loading={loading} onClick={() => form.submit()} style={{ height: 50, marginBottom: 12 }}>Guardar</Button>
            <Button block onClick={() => navigate('/inventario')}>Cancelar</Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
