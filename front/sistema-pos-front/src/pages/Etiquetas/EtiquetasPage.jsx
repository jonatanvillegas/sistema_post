import React, { useState, useEffect, useRef } from 'react';
import {
  Card, Row, Col, Typography, Table, Button, Input, Space, Select, InputNumber,
  Checkbox, Tag, Radio, Divider, Empty,
} from 'antd';
import {
  SearchOutlined, PrinterOutlined, BarcodeOutlined, TagOutlined,
  PlusOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { getProductosEtiquetas, generarEtiquetas } from '../../api/etiquetas.api';
import { getCategorias } from '../../api/categorias.api';
import { formatCurrency } from '../../utils/formatters';
import JsBarcode from 'jsbarcode';

const { Title, Text } = Typography;

export default function EtiquetasPage() {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [categorias, setCategorias] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState(undefined);

  // Selección
  const [seleccionados, setSeleccionados] = useState([]);
  const [cantidades, setCantidades] = useState({});

  // Configuración
  const [formato, setFormato] = useState('50x25');
  const [incluirPrecio, setIncluirPrecio] = useState(true);
  const [incluirCodigo, setIncluirCodigo] = useState(true);
  const [incluirCategoria, setIncluirCategoria] = useState(false);

  // Preview
  const [etiquetasPreview, setEtiquetasPreview] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);

  const printRef = useRef(null);

  useEffect(() => { fetchProductos(); }, [busqueda, categoriaFiltro]);
  useEffect(() => { fetchCategorias(); }, []);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await getProductosEtiquetas({ buscar: busqueda, categoria: categoriaFiltro });
      setProductos(res.data);
    } catch { toast.error('Error al cargar productos'); }
    finally { setLoading(false); }
  };

  const fetchCategorias = async () => {
    try {
      const res = await getCategorias();
      setCategorias(res.data);
    } catch { /* ignore */ }
  };

  const handleGenerarPreview = async () => {
    if (seleccionados.length === 0) {
      toast.error('Seleccione al menos un producto');
      return;
    }
    try {
      const productosPayload = seleccionados.map((id) => ({
        productoId: id,
        cantidad: cantidades[id] || 1,
      }));
      const res = await generarEtiquetas({
        productos: productosPayload,
        formato,
        incluirPrecio,
        incluirCodigo,
        incluirCategoria,
      });
      setEtiquetasPreview(res.data.etiquetas);
      setPreviewMode(true);
      toast.success(`${res.data.totalEtiquetas} etiquetas generadas`);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al generar etiquetas');
    }
  };

  const handleImprimir = () => {
    const contenido = printRef.current;
    if (!contenido) return;

    const ventana = window.open('', '_blank');
    if (!ventana) { toast.error('Ventana bloqueada'); return; }

    const formatos = {
      '30x20': { width: 30, height: 20, fontSize: 7, gap: 2 },
      '50x25': { width: 50, height: 25, fontSize: 9, gap: 3 },
      '50x30': { width: 50, height: 30, fontSize: 10, gap: 3 },
      '70x35': { width: 70, height: 35, fontSize: 11, gap: 4 },
      '100x50': { width: 100, height: 50, fontSize: 13, gap: 5 },
    };
    const fmt = formatos[formato] || formatos['50x25'];

    const etiquetasHtml = etiquetasPreview.map((et) => {
      const canvas = document.createElement('canvas');
      if (et.codigo && et.incluirCodigo !== false) {
        try { JsBarcode(canvas, et.codigo, { format: 'CODE128', displayValue: false, height: fmt.height * 0.4, margin: 0 }); }
        catch { /* ignore */ }
      }
      const barcodeImg = canvas.toDataURL();

      return `
        <div class="etiqueta" style="width:${fmt.width}mm;height:${fmt.height}mm;padding:${fmt.gap}mm;border:0.5px dashed #ccc;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;page-break-inside:avoid;overflow:hidden;">
          <div style="font-size:${fmt.fontSize}px;font-weight:bold;text-align:center;line-height:1.2;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${et.nombre}</div>
          ${et.categoria ? `<div style="font-size:${fmt.fontSize - 2}px;color:#666;">${et.categoria}</div>` : ''}
          ${et.codigo ? `<img src="${barcodeImg}" style="max-width:90%;height:auto;margin:1mm 0;" />` : ''}
          ${et.codigo ? `<div style="font-size:${fmt.fontSize - 1}px;letter-spacing:1px;">${et.codigo}</div>` : ''}
          ${et.precioVenta !== null ? `<div style="font-size:${fmt.fontSize + 2}px;font-weight:900;margin-top:1mm;">C$ ${Number(et.precioVenta).toFixed(2)}</div>` : ''}
        </div>
      `;
    }).join('');

    ventana.document.write(`
      <html><head><title>Etiquetas</title>
      <style>
        body { margin: 0; padding: 5mm; font-family: Arial, sans-serif; }
        .etiquetas-container { display: flex; flex-wrap: wrap; gap: 1mm; }
        @media print { body { margin: 0; padding: 2mm; } .etiqueta { border: none !important; } }
      </style></head>
      <body>
        <div class="etiquetas-container">${etiquetasHtml}</div>
      </body></html>
    `);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => { ventana.print(); }, 500);
  };

  const handleCantidadChange = (id, val) => {
    setCantidades((prev) => ({ ...prev, [id]: val }));
  };

  const totalEtiquetas = seleccionados.reduce((sum, id) => sum + (cantidades[id] || 1), 0);

  const columns = [
    {
      title: 'Producto', key: 'nombre',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.nombre}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}><BarcodeOutlined /> {r.codigo || 'S/C'} | {r.categoria}</Text>
        </Space>
      ),
    },
    { title: 'Precio', dataIndex: 'precioVenta', width: 120, render: (v) => <Text strong style={{ color: '#1677ff' }}>{formatCurrency(v)}</Text> },
    { title: 'Stock', dataIndex: 'stock', width: 70, align: 'center' },
    {
      title: 'Cant. Etiquetas', key: 'cantidad', width: 130, align: 'center',
      render: (_, r) => seleccionados.includes(r._id) ? (
        <InputNumber min={1} max={100} value={cantidades[r._id] || 1} size="small"
          style={{ width: 80 }} onChange={(v) => handleCantidadChange(r._id, v)} />
      ) : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <div style={{ padding: '0 24px', width: '100%' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={2} className="page-title">Etiquetas y Códigos de Barras</Title>
          <Text className="page-sub">Genere e imprima etiquetas con códigos de barras para sus productos.</Text>
        </div>
        <Space>
          {previewMode && (
            <Button icon={<ReloadOutlined />} onClick={() => setPreviewMode(false)}>
              Volver a Selección
            </Button>
          )}
          {!previewMode ? (
            <Button type="primary" size="large" icon={<TagOutlined />}
              onClick={handleGenerarPreview} disabled={seleccionados.length === 0}>
              Generar {totalEtiquetas} Etiquetas
            </Button>
          ) : (
            <Button type="primary" size="large" icon={<PrinterOutlined />} onClick={handleImprimir}>
              Imprimir Etiquetas
            </Button>
          )}
        </Space>
      </div>

      {!previewMode ? (
        <Row gutter={24}>
          <Col xs={24} lg={18}>
            <Card bordered={false} bodyStyle={{ padding: 0 }} className="dashboard-card shadow-sm">
              <div style={{ padding: '20px 24px' }}>
                <Row gutter={16} align="middle">
                  <Col xs={24} md={12}>
                    <Input placeholder="Buscar producto..." prefix={<SearchOutlined />}
                      allowClear size="large" value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)} style={{ borderRadius: 8 }} />
                  </Col>
                  <Col xs={24} md={8}>
                    <Select placeholder="Categoría" allowClear value={categoriaFiltro}
                      onChange={setCategoriaFiltro} style={{ width: '100%' }} size="large">
                      {categorias.map((c) => (
                        <Select.Option key={c._id} value={c.nombre}>{c.nombre}</Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                    <Tag color="blue">{seleccionados.length} seleccionados</Tag>
                  </Col>
                </Row>
              </div>

              <Table columns={columns} dataSource={productos} rowKey="_id" loading={loading}
                className="custom-table" scroll={{ x: 600 }}
                pagination={{ pageSize: 15 }}
                rowSelection={{
                  selectedRowKeys: seleccionados,
                  onChange: (keys) => setSeleccionados(keys),
                }} />
            </Card>
          </Col>

          <Col xs={24} lg={6}>
            <Card title={<><TagOutlined /> Configuración</>} bordered={false} className="dashboard-card shadow-sm">
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Formato de Etiqueta</Text>
                <Radio.Group value={formato} onChange={(e) => setFormato(e.target.value)} style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="30x20">30 × 20 mm (Pequeña)</Radio>
                    <Radio value="50x25">50 × 25 mm (Estándar)</Radio>
                    <Radio value="50x30">50 × 30 mm (Mediana)</Radio>
                    <Radio value="70x35">70 × 35 mm (Grande)</Radio>
                    <Radio value="100x50">100 × 50 mm (Extra grande)</Radio>
                  </Space>
                </Radio.Group>
              </div>

              <Divider />

              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Incluir en etiqueta</Text>
                <Space direction="vertical">
                  <Checkbox checked={incluirPrecio} onChange={(e) => setIncluirPrecio(e.target.checked)}>
                    Precio de Venta
                  </Checkbox>
                  <Checkbox checked={incluirCodigo} onChange={(e) => setIncluirCodigo(e.target.checked)}>
                    Código de Barras
                  </Checkbox>
                  <Checkbox checked={incluirCategoria} onChange={(e) => setIncluirCategoria(e.target.checked)}>
                    Categoría
                  </Checkbox>
                </Space>
              </div>

              <Divider />

              <div style={{ background: '#f0f5ff', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                <Text type="secondary">Total a imprimir</Text>
                <Title level={3} style={{ margin: 0, color: '#1677ff' }}>{totalEtiquetas} etiquetas</Title>
              </div>
            </Card>
          </Col>
        </Row>
      ) : (
        /* Vista previa de etiquetas */
        <Card bordered={false} className="dashboard-card shadow-sm">
          <div ref={printRef} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: 16 }}>
            {etiquetasPreview.map((et, i) => (
              <div key={i} style={{
                width: formato === '30x20' ? 120 : formato === '100x50' ? 300 : 200,
                minHeight: formato === '30x20' ? 80 : formato === '100x50' ? 180 : 120,
                border: '1px dashed #d9d9d9',
                borderRadius: 8,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
              }}>
                <Text strong style={{ fontSize: formato === '30x20' ? 10 : 13, textAlign: 'center', lineHeight: 1.2 }}>
                  {et.nombre}
                </Text>
                {et.categoria && <Text type="secondary" style={{ fontSize: 9 }}>{et.categoria}</Text>}
                {et.codigo && incluirCodigo && (
                  <canvas ref={(ref) => {
                    if (ref && et.codigo) {
                      try { JsBarcode(ref, et.codigo, { format: 'CODE128', displayValue: true, height: 30, fontSize: 10, margin: 2 }); }
                      catch { /* ignore */ }
                    }
                  }} style={{ maxWidth: '95%', marginTop: 4 }} />
                )}
                {et.precioVenta !== null && (
                  <Text strong style={{ fontSize: formato === '30x20' ? 12 : 16, color: '#1677ff', marginTop: 4 }}>
                    {formatCurrency(et.precioVenta)}
                  </Text>
                )}
              </div>
            ))}
          </div>

          {etiquetasPreview.length === 0 && <Empty description="No se generaron etiquetas" />}
        </Card>
      )}
    </div>
  );
}
