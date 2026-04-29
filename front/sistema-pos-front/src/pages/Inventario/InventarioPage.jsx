import React, { useState, useEffect, useRef } from 'react';
import { 
  Table, Card, Button, Input, Space, Typography, Tag, 
  Modal, Form, InputNumber, Select, Descriptions, Divider, Popconfirm, Badge, Row, Col, Switch, Tooltip, Avatar
} from 'antd';
import { 
  PlusOutlined, SearchOutlined, EditOutlined, 
  DeleteOutlined, HistoryOutlined, ExclamationCircleOutlined,
  BarcodeOutlined, FileExcelOutlined, InboxOutlined, SyncOutlined
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  getKardex,
  exportInventarioExcel,
} from '../../api/inventario.api';
import { getProveedores } from '../../api/proveedores.api';
import { getCategorias } from '../../api/categorias.api';
import { getConfig } from '../../api/config.api';
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [stockBajoFilter, setStockBajoFilter] = useState(false);
  const [isKardexVisible, setIsKardexVisible] = useState(false);
  const [kardexData, setKardexData] = useState([]);
  const [editingProducto, setEditingProducto] = useState(null);
  const [config, setConfig] = useState(null);
  const { isAdmin, hasAnyRole } = useAuthStore();
  const canManage = hasAnyRole(['admin', 'inventario']);
  const [exporting, setExporting] = useState(false);

  const [searchParams] = useSearchParams();
  const lastKeyTime = useRef(Date.now());
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const qStockBajo = searchParams.get('stockBajo') === 'true';
    const qBuscar = searchParams.get('buscar');
    setStockBajoFilter(qStockBajo);
    if (qBuscar !== null) setBusqueda(qBuscar);
  }, [searchParams]);

  useEffect(() => {
    fetchData();
    fetchConfig();
  }, [busqueda, stockBajoFilter]);

  const fetchConfig = async () => {
    try {
      const res = await getConfig();
      setConfig(res.data);
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const resProd = await getProductos({ 
        buscar: busqueda, 
        stockBajo: stockBajoFilter ? 'true' : undefined 
      });
      setData(resProd.data);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      const isSearchInput = e.target.id === 'inventario-search';

      if (e.key === 'F10') {
        e.preventDefault();
        document.getElementById('inventario-search')?.focus();
        return;
      }

      if (!isInput || isSearchInput) {
        const currentTime = Date.now();
        const diff = currentTime - lastKeyTime.current;
        lastKeyTime.current = currentTime;

        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          if (!isSearchInput) {
            e.preventDefault();
            const searchEl = document.getElementById('inventario-search');
            if (searchEl) {
              searchEl.focus();
              setBusqueda(prev => prev + e.key);
            }
          }

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
  }, [busqueda]);

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

  const columns = [
    {
      title: 'Img',
      key: 'imagen',
      width: 70,
      hidden: !config?.mostrarImagenesProductos,
      render: (_, record) => {
        const url = record.imagen 
          ? `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/uploads/productos/${record.imagen}`
          : null;
        return (
          <Avatar 
            shape="square" 
            size={48} 
            src={url} 
            icon={<InboxOutlined />} 
            style={{ backgroundColor: '#f5f5f5', color: '#d9d9d9' }}
          />
        );
      }
    },
    {
      title: 'Producto',
      dataIndex: 'nombre',
      key: 'nombre',
      render: (text, record) => (
        <Space direction="vertical" size={0} style={{ lineHeight: 1.2 }}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            <BarcodeOutlined /> {record.codigo || 'S/C'} | {record.categoria}
          </Text>
        </Space>
      )
    },
    {
      title: 'Costo',
      dataIndex: 'precioCompra',
      render: (val) => formatCurrency(val),
      responsive: ['md']
    },
    {
      title: 'Venta',
      dataIndex: 'precioVenta',
      render: (val) => <Text strong style={{ color: '#1677ff' }}>{formatCurrency(val)}</Text>
    },
    {
      title: 'Margen',
      key: 'margen',
      render: (_, record) => {
        const pv = Number(record.precioVenta);
        const pc = Number(record.precioCompra);
        if (!isFinite(pv) || pv <= 0 || !isFinite(pc)) return <Tag>—</Tag>;
        const margen = ((pv - pc) / pv) * 100;
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
           <Tooltip title="Ver Código">
             <Button 
               icon={<BarcodeOutlined />} 
               size="small" 
               onClick={() => {
                 Modal.info({
                   title: `Código de Barras: ${record.nombre}`,
                   content: (
                     <div style={{ textAlign: 'center', padding: 20 }}>
                       <canvas id={`bc-${record._id}`} style={{ maxWidth: '100%' }} />
                       <script>
                         {setTimeout(() => {
                           const canvas = document.getElementById(`bc-${record._id}`);
                           if (canvas) {
                             JsBarcode(canvas, record.codigo || '000000', { format: 'CODE128', displayValue: true });
                           }
                         }, 100)}
                       </script>
                       <div style={{ marginTop: 10 }}>
                         <Text copyable>{record.codigo}</Text>
                       </div>
                     </div>
                   ),
                   width: 400
                 });
               }} 
             />
           </Tooltip>
           <Tooltip title="Kardex">
             <Button icon={<HistoryOutlined />} size="small" onClick={() => showKardex(record)} />
           </Tooltip>
           {canManage && (
             <>
               <Button 
                icon={<EditOutlined />} 
                size="small" 
                type="primary" 
                ghost 
                onClick={() => navigate(`/inventario/editar/${record._id}`)} 
               />
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
  ].filter(col => !col.hidden);

  return (
    <div style={{ padding: '0 24px', width: '100%', maxWidth: '100%' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <Title level={2} className="page-title">Inventario Maestro</Title>
          <Text className="page-sub">Control total de existencias, precios y márgenes de utilidad.</Text>
        </div>
        {canManage && (
          <Space>
            <Button loading={exporting} icon={<FileExcelOutlined />} onClick={handleExportExcel}>
              Exportar Todo
            </Button>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/inventario/nuevo')}>
              Registrar Producto
            </Button>
          </Space>
        )}
      </div>

      <Card bordered={false} bodyStyle={{ padding: 0 }} className="dashboard-card shadow-sm">
        <div style={{ padding: '20px 24px' }}>
          <Row gutter={16} align="middle">
            <Col xs={24} lg={14}>
              <Input 
                id="inventario-search"
                placeholder="Escanee un código o escriba nombre del producto (F10)..." 
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                allowClear
                size="large"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Col>
            <Col xs={24} lg={10} style={{ textAlign: 'right', marginTop: { xs: 12, lg: 0 } }}>
              <Space size="large">
                <Space>
                  <Switch 
                    checked={stockBajoFilter} 
                    onChange={setStockBajoFilter} 
                    size="small"
                  />
                  <Text strong style={{ fontSize: 13, color: stockBajoFilter ? '#ff4d4f' : 'inherit' }}>
                    Alertas de Stock Bajo
                  </Text>
                </Space>
                <Tag color="blue" icon={<SyncOutlined spin={loading} />}>
                  {data.length} Productos
                </Tag>
              </Space>
            </Col>
          </Row>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={data} 
          rowKey="_id" 
          loading={loading}
          pagination={{ 
            pageSize: 12,
            showSizeChanger: true,
            pageSizeOptions: ['12', '24', '50', '100']
          }}
          className="custom-table"
          scroll={{ x: 800 }}
        />

        <div className="pos-shortcuts-bar" style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Space split={<Divider type="vertical" />}>
              <span><Tag color="blue">F10</Tag> Buscar rápido</span>
              <span className={isScanning ? 'scanner-active-pulse' : ''}>
                <Tag color={isScanning ? 'success' : 'default'} icon={<BarcodeOutlined />}>
                  {isScanning ? 'LECTURA DETECTADA' : 'ESCÁNER LISTO'}
                </Tag>
              </span>
            </Space>
        </div>
      </Card>

      {/* Modal Kardex */}
      <Modal
        title={
          <Space>
            <HistoryOutlined style={{ color: '#1677ff' }} />
            <span>Kardex: {editingProducto?.nombre}</span>
          </Space>
        }
        open={isKardexVisible}
        onCancel={() => setIsKardexVisible(false)}
        footer={null}
        width={850}
        className="custom-modal"
      >
        <Table 
          dataSource={kardexData}
          rowKey="_id"
          size="small"
          pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Fecha', dataIndex: 'createdAt', render: val => formatDateTime(val), width: 170 },
            { 
              title: 'Tipo', 
              dataIndex: 'tipo', 
              width: 100,
              render: val => (
                <Tag color={val === 'entrada' ? 'green' : val === 'salida' ? 'red' : 'orange'}>
                  {val.toUpperCase()}
                </Tag>
              )
            },
            { title: 'Cant.', dataIndex: 'cantidad', align: 'center', width: 80 },
            { title: 'Stock Ant.', dataIndex: 'stockAnterior', align: 'center', width: 100 },
            { title: 'Nuevo Stock', dataIndex: 'stockNuevo', align: 'center', width: 100, render: val => <Text strong>{val}</Text> },
            { title: 'Motivo', dataIndex: 'motivo', ellipsis: true },
            { title: 'Usuario', dataIndex: 'usuarioId', width: 120, render: val => val?.nombre }
          ]}
        />
      </Modal>
    </div>
  );
}
