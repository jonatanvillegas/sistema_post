import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Row, Col, Card, Input, Button, Tabs, Table, Typography, 
  Space, Badge, Modal, InputNumber, Radio, Divider, Empty, Tag,
  Alert, Tooltip, Select, DatePicker, List
} from 'antd';
import { 
  SearchOutlined, PlusOutlined, CloseOutlined, 
  DeleteOutlined, ShoppingCartOutlined, DollarOutlined,
  BarcodeOutlined, UserOutlined, ArrowRightOutlined,
  CheckCircleOutlined, PrinterOutlined, CreditCardOutlined
} from '@ant-design/icons';
import { toast } from 'react-hot-toast';
import { getProductos } from '../../api/inventario.api';
import { createVenta, getVentas, anularVenta } from '../../api/ventas.api';
import { getClientes } from '../../api/clientes.api';
import { useVentaStore } from '../../store/ventaStore';
import { useCajaStore } from '../../store/cajaStore';
import { useAuthStore } from '../../store/authStore';
import { formatCurrency } from '../../utils/formatters';
import { buildReceiptHtml } from '../../utils/receipt';
import { getPrintSettings } from '../../utils/printSettings';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export default function VentasPage() {
  const [loading, setLoading] = useState(false);
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [isModalPagoVisible, setIsModalPagoVisible] = useState(false);
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [metodoPago, setMetodoPago] = useState('efectivo');

  const [isVentasModalVisible, setIsVentasModalVisible] = useState(false);
  const [ventasRecientesLoading, setVentasRecientesLoading] = useState(false);
  const [ventasRecientes, setVentasRecientes] = useState([]);
  const [ventasRecientesTotal, setVentasRecientesTotal] = useState(0);
  const [ventasRecientesPage, setVentasRecientesPage] = useState(1);
  const [ventasRecientesLimit, setVentasRecientesLimit] = useState(20);
  const [ventasFiltroBuscar, setVentasFiltroBuscar] = useState('');
  const [ventasFiltroEstado, setVentasFiltroEstado] = useState(undefined);
  const [ventasFiltroRango, setVentasFiltroRango] = useState(null);

  // Buscador de Clientes
  const [clientesBusqueda, setClientesBusqueda] = useState([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  
  const { 
    pestanas, pestanaActiva, agregarPestana, cerrarPestana, setPestanaActiva,
    agregarProducto, quitarProducto, cambiarCantidad, getPestanaActiva, 
    cambiarDescuentoProducto, setDescuentoGeneral,
    getTotal, getSubtotal, getDescuentoTotal, limpiarPestana, setCliente
  } = useVentaStore();
  
  const { cajaActual } = useCajaStore();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const searchInputRef = useRef(null);

  const loadVentasHistorial = async (next = {}) => {
    const page = next.page ?? ventasRecientesPage;
    const limit = next.limit ?? ventasRecientesLimit;

    const [d0, d1] = Array.isArray(ventasFiltroRango) ? ventasFiltroRango : [];
    const desde = d0?.format ? d0.format('YYYY-MM-DD') : undefined;
    const hasta = d1?.format ? d1.format('YYYY-MM-DD') : undefined;

    setVentasRecientesLoading(true);
    try {
      const { data } = await getVentas({
        page,
        limit,
        buscar: ventasFiltroBuscar || undefined,
        estado: ventasFiltroEstado || undefined,
        desde,
        hasta,
      });
      setVentasRecientes(Array.isArray(data?.ventas) ? data.ventas : []);
      setVentasRecientesTotal(Number(data?.total) || 0);
      setVentasRecientesPage(Number(data?.pagina) || page);
      setVentasRecientesLimit(Number(limit) || 20);
    } catch (err) {
      toast.error(err?.response?.data?.mensaje || 'Error cargando historial');
    } finally {
      setVentasRecientesLoading(false);
    }
  };

  const openVentasRecientes = async () => {
    setIsVentasModalVisible(true);
    setVentasRecientesPage(1);
    await loadVentasHistorial({ page: 1 });
  };

  const anularVentaHistorial = async (venta) => {
    if (!venta?._id) return;
    if (!isAdmin()) {
      toast.error('Solo un administrador puede corregir/anular ventas');
      return;
    }
    if (venta.estado === 'anulada') {
      toast.error('Esa venta ya está anulada');
      return;
    }

    let motivoValue = '';
    Modal.confirm({
      title: `Anular venta ${venta.numeroVenta}`,
      content: (
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Se anulará la venta. Solo se permite si la caja donde se registró sigue abierta.
          </Paragraph>
          <Input placeholder="Motivo (obligatorio)" onChange={(e) => (motivoValue = e.target.value)} />
        </div>
      ),
      okText: 'Anular',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        if (!motivoValue || !motivoValue.trim()) {
          toast.error('Debe ingresar un motivo');
          throw new Error('Motivo requerido');
        }

        await anularVenta(venta._id, { motivo: motivoValue.trim() });
        toast.success('Venta anulada correctamente');
        await loadVentasHistorial({ page: ventasRecientesPage });
      },
    });
  };

  const currentTab = useMemo(() => getPestanaActiva(), [pestanas, pestanaActiva]);
  const totalActivo = useMemo(() => getTotal(), [pestanas, pestanaActiva]);
  const subtotalActivo = useMemo(() => getSubtotal(), [pestanas, pestanaActiva]);
  const descuentoActivo = useMemo(() => getDescuentoTotal(), [pestanas, pestanaActiva]);

  // Vuelto calculado
  const vuelto = useMemo(() => {
    if (metodoPago !== 'efectivo') return 0;
    const v = montoRecibido - totalActivo;
    return v > 0 ? v : 0;
  }, [montoRecibido, totalActivo, metodoPago]);

  // Estado para el scanner global
  const [isScanning, setIsScanning] = useState(false);
  const scanBuffer = useRef('');
  const lastKeyTime = useRef(Date.now());
  const lastProcessedCode = useRef('');
  const lastProcessedTime = useRef(0);
  const isAddingRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Ignorar si hay un modal abierto o si ya estamos en un input que no es el buscador
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
      const isSearchInput = e.target === searchInputRef.current?.input;

      if (isModalPagoVisible) {
        if (e.key === 'Escape') setIsModalPagoVisible(false);
        if (e.key === 'Enter' && !e.shiftKey && (metodoPago !== 'efectivo' || montoRecibido >= totalActivo)) {
          onConfirmarVenta();
        }
        return;
      }

      // 2. Atajos de teclado (F2, F10, F12, etc.)
      if (e.key === 'F10') { e.preventDefault(); searchInputRef.current?.focus(); return; }
      if (e.key === 'F12') { e.preventDefault(); handlePagar(); return; }
      if (e.key === 'F2') { e.preventDefault(); agregarPestana(); return; }
      if (e.key === 'F4') {
        e.preventDefault();
        if (currentTab?.productos.length > 0) {
          Modal.confirm({ title: '¿Limpiar esta pestaña?', onOk: () => limpiarPestana() });
        }
        return;
      }

      // 3. Navegación entre pestañas
      if (e.ctrlKey && e.key === 'ArrowRight') {
        const idx = pestanas.findIndex(p => p.id === pestanaActiva);
        if (idx < pestanas.length - 1) setPestanaActiva(pestanas[idx + 1].id);
        return;
      }
      if (e.ctrlKey && e.key === 'ArrowLeft') {
        const idx = pestanas.findIndex(p => p.id === pestanaActiva);
        if (idx > 0) setPestanaActiva(pestanas[idx - 1].id);
        return;
      }

      // 4. Lógica de Scanner Global
      // Si no hay modal y no estamos en otro input (o si el buscador ya tiene el foco)
      if (!isModalPagoVisible && (!isInput || isSearchInput)) {
        const currentTime = Date.now();
        const diff = currentTime - lastKeyTime.current;
        lastKeyTime.current = currentTime;

        // Si es una tecla alfanumérica (y no tiene modificadores como Ctrl/Alt)
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          // Si no tenemos el foco en el buscador, lo forzamos
          if (!isSearchInput) {
            e.preventDefault();
            searchInputRef.current?.focus();
            // Agregamos el primer carácter al buscador manualmente ya que el evento preventDefault detuvo la escritura normal
            setBusqueda(prev => prev + e.key);
          }
          
          // Activamos indicador visual de escaneo si la velocidad es alta (< 50ms entre teclas)
          if (diff < 50) {
            setIsScanning(true);
            clearTimeout(window.scanTimeout);
            window.scanTimeout = setTimeout(() => setIsScanning(false), 1000);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(window.scanTimeout);
    };
  }, [pestanas, pestanaActiva, isModalPagoVisible, totalActivo, montoRecibido, metodoPago, currentTab]);

  useEffect(() => {
    fetchProductos();
    searchInputRef.current?.focus();
  }, [busqueda]);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const res = await getProductos({ buscar: busqueda, limit: 20 });
      const results = res.data;
      const exactMatch = results.find(p => p.codigo === busqueda);
      if (exactMatch && busqueda.length > 3) {
        // Prevenir doble escaneo (debounce por tiempo y código)
        const now = Date.now();
        if (lastProcessedCode.current === busqueda && (now - lastProcessedTime.current) < 500) {
          console.log('⏳ Escaneo duplicado ignorado:', busqueda);
          setBusqueda('');
          return;
        }

        if (isAddingRef.current) return;
        
        lastProcessedCode.current = busqueda;
        lastProcessedTime.current = now;
        isAddingRef.current = true;

        handleProductClick(exactMatch);
        isAddingRef.current = false;
        return;
      }
      setProductos(results);
    } catch (err) {
      toast.error('Error al buscar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = (producto) => {
    if (producto?.controlaStock !== false && producto.stock <= 0) {
      toast.error('Producto sin stock disponible');
      return;
    }
    agregarProducto(producto);
    toast.success(`${producto.nombre} agregado`, { duration: 800, position: 'bottom-center' });
    setBusqueda('');
  };

  const handlePagar = () => {
    if (!currentTab || currentTab.productos.length === 0) {
      toast.error('Agregue productos para realizar la venta');
      return;
    }
    if (!cajaActual) {
      toast.error('Debe abrir caja antes de realizar ventas');
      return;
    }
    setMontoRecibido(totalActivo);
    setMetodoPago('efectivo');
    setIsModalPagoVisible(true);
  };

  const onConfirmarVenta = async () => {
    try {
      const payload = {
        cliente: currentTab.cliente,
        clienteId: currentTab.cliente?._id || null,
        productos: currentTab.productos.map(p => ({
          productoId: p.productoId,
          cantidad: p.cantidad,
          descuentoTipo: p.descuentoTipo,
          descuentoValor: p.descuentoValor,
        })),
        descuentoGeneralTipo: currentTab.descuentoGeneralTipo,
        descuentoGeneralValor: currentTab.descuentoGeneralValor,
        metodoPago,
        montoRecibido: metodoPago === 'efectivo' ? montoRecibido : (metodoPago === 'credito' ? 0 : totalActivo)
      };

      const res = await createVenta(payload);
      const ventaCreada = res.data;
      toast.success('¡Venta realizada con éxito!');

      Modal.confirm({
        title: 'Venta realizada',
        icon: <PrinterOutlined />,
        content: '¿Desea imprimir el recibo?',
        okText: 'Imprimir',
        cancelText: 'No',
        onOk: async () => {
          try {
            const settings = getPrintSettings();
            const html = buildReceiptHtml(ventaCreada, {
              widthMm: settings.paperWidthMm || 58,
              storeName: 'Sistema POS',
            });
            if (window?.electronAPI?.printReceipt) {
              const r = await window.electronAPI.printReceipt(html, {
                silent: Boolean(settings.silent),
                deviceName: settings.deviceName || undefined,
                copies: settings.copies || 1,
                printBackground: true,
              });
              if (r && r.ok === false) throw new Error(r.error || 'No se pudo imprimir');
            } else {
              const w = window.open('', '_blank');
              if (!w) throw new Error('Ventana de impresión bloqueada');
              w.document.open();
              w.document.write(html);
              w.document.close();
              w.focus();
              w.print();
              w.close();
            }
          } catch (err) {
            toast.error(err?.message || 'Error al imprimir');
          }
        },
      });

      limpiarPestana();
      setIsModalPagoVisible(false);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al procesar venta');
    }
  };

  const handleSearchCliente = async (value) => {
    if (!value || value.length < 2) return;
    setBuscandoCliente(true);
    try {
      const res = await getClientes(value);
      setClientesBusqueda(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setBuscandoCliente(false);
    }
  };

  const renderCarritoItem = (item) => {
    const tipo = item?.descuentoTipo || 'ninguno';
    const isPct = tipo === 'porcentaje';

    return (
      <div className="carrito-item-col">
        <div className="carrito-item-top">
          <Text
            strong
            ellipsis={{ tooltip: item?.nombre }}
            style={{ fontSize: 13, maxWidth: 260 }}
          >
            {item?.nombre}
          </Text>
          <Button
            type="text"
            danger
            size="small"
            icon={<CloseOutlined style={{ fontSize: 11 }} />}
            onClick={() => quitarProducto(item.productoId)}
          />
        </div>

        <div className="carrito-item-meta">
          <Text type="secondary" style={{ fontSize: 11 }}>
            {formatCurrency(Number(item?.precioUnitario) || 0)} c/u
          </Text>
          <Text style={{ fontSize: 12 }}>
            Sub: <Text strong>{formatCurrency(Number(item?.subtotal) || 0)}</Text>
          </Text>
        </div>

        <div className="carrito-item-row">
          <Text type="secondary" style={{ fontSize: 11, width: 50 }}>
            Cant.
          </Text>
          <InputNumber
            min={1}
            max={item?.controlaStock === false ? undefined : item?.stockDisponible}
            size="small"
            value={item?.cantidad}
            onChange={(v) => cambiarCantidad(item.productoId, v)}
            style={{ width: 90 }}
          />
        </div>

        <div className="carrito-item-row">
          <Text type="secondary" style={{ fontSize: 11, width: 50 }}>
            Desc.
          </Text>
          <Space.Compact size="small" style={{ width: '100%' }}>
            <Select
              size="small"
              value={tipo}
              style={{ width: 90 }}
              dropdownMatchSelectWidth={false}
              options={[
                { value: 'ninguno', label: 'Ninguno' },
                { value: 'monto', label: 'Monto (C$)' },
                { value: 'porcentaje', label: 'Porcentaje (%)' },
              ]}
              onChange={(nextTipo) => {
                const nextVal = nextTipo === 'ninguno' ? 0 : (item?.descuentoValor || 0);
                cambiarDescuentoProducto(item.productoId, nextTipo, nextVal);
              }}
            />
            <InputNumber
              size="small"
              disabled={tipo === 'ninguno'}
              min={0}
              max={isPct ? 100 : undefined}
              step={isPct ? 1 : 0.01}
              value={item?.descuentoValor || 0}
              onChange={(v) => cambiarDescuentoProducto(item.productoId, tipo, v)}
              style={{ width: '100%' }}
              controls={false}
            />
          </Space.Compact>
        </div>
      </div>
    );
  };

  return (
    <div style={{ margin: -24 }}>
      <div className="pos-layout">
        <div className="pos-left">
          <div className="pos-top-bar" style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
            <Tabs
              type="editable-card"
              activeKey={String(pestanaActiva)}
              onChange={(k) => setPestanaActiva(Number(k))}
              onEdit={(targetKey, action) => action === 'add' ? agregarPestana() : cerrarPestana(Number(targetKey))}
              items={pestanas.map(p => ({
                key: String(p.id),
                label: (
                  <span>
                    <ShoppingCartOutlined /> {p.nombre} {p.productos.length > 0 && <Badge count={p.productos.length} offset={[8, -8]} size="small" />}
                  </span>
                )
              }))}
              style={{ padding: '8px 16px 0' }}
            />
          </div>

          <div className="pos-search-bar">
            <Input 
              ref={searchInputRef}
              placeholder="Buscar producto por nombre o código de barras (F10)..." 
              size="large"
              prefix={<SearchOutlined />}
              suffix={<BarcodeOutlined />}
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              allowClear
            />
          </div>

          <div className="pos-products-grid">
            {productos.length === 0 && !loading && (
              <div style={{ gridColumn: '1 / -1', padding: '100px 0' }}>
                <Empty description="No se encontraron productos" />
              </div>
            )}
            {productos.map(p => (
              <div 
                key={p._id} 
                className={`pos-product-card ${(p.controlaStock !== false && p.stock <= 0) ? 'sin-stock' : ''}`}
                onClick={() => handleProductClick(p)}
              >
                <div className="pos-product-icon">
                   <Text strong style={{ color: '#1677ff', fontSize: 20 }}>{p.nombre.charAt(0)}</Text>
                </div>
                <Text className="pos-product-name">{p.nombre}</Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <Text className="pos-product-price">{formatCurrency(p.precioVenta)}</Text>
                  {p.controlaStock === false ? (
                    <Tag color="default" style={{ fontSize: 10, margin: 0 }}>N/A</Tag>
                  ) : (
                    <Tag color={p.stock <= 5 ? 'orange' : 'blue'} style={{ fontSize: 10, margin: 0 }}>{p.stock}</Tag>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pos-shortcuts-bar">
            <span><Tag color="blue">F2</Tag> Nueva Venta</span>
            <span><Tag color="blue">F10</Tag> Buscar</span>
            <span><Tag color="blue">F12</Tag> Cobrar</span>
            <span><Tag color="blue">F4</Tag> Limpiar</span>
            <Divider type="vertical" />
            <span className={isScanning ? 'scanner-active-pulse' : ''}>
              <Tag color={isScanning ? 'success' : 'default'} icon={<BarcodeOutlined />}>
                {isScanning ? 'Escaneando...' : 'Scanner Listo'}
              </Tag>
            </span>
          </div>
        </div>

        <div className="pos-right">
          <div className="carrito-header">
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Title level={4} style={{ margin: 0 }}>Carrito</Title>
                <Space>
                  <Button size="small" onClick={openVentasRecientes}>
                    Ventas
                  </Button>
                  <Button size="small" type="text" onClick={limpiarPestana} danger disabled={currentTab?.productos.length === 0}>
                    <DeleteOutlined /> Vaciar
                  </Button>
                </Space>
              </div>
              {/* SELECT DE CLIENTE */}
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder={<span><UserOutlined /> Seleccionar Cliente</span>}
                optionFilterProp="children"
                onSearch={handleSearchCliente}
                loading={buscandoCliente}
                filterOption={false}
                value={currentTab?.cliente?._id}
                onSelect={(val, option) => setCliente({ ...option.data, _id: val })}
                className="cliente-select"
              >
                <Option value={null} data={{ nombre: 'Consumidor Final', nit: 'CF' }}>Consumidor Final</Option>
                {clientesBusqueda.map(c => (
                  <Option key={c._id} value={c._id} data={c}>
                    {c.nombre} <small style={{ color: '#8c8c8c' }}>({c.nit})</small>
                  </Option>
                ))}
              </Select>
          </div>

          <div className="carrito-items">
            {currentTab?.productos.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bfbfbf', paddingTop: 80 }}>
                <ShoppingCartOutlined style={{ fontSize: 48, opacity: 0.2 }} />
                <p>Carrito vacío</p>
              </div>
            ) : (
              <List
                dataSource={currentTab?.productos}
                renderItem={(item) => (
                  <List.Item key={item?.productoId} style={{ padding: 0, borderBottom: 'none' }}>
                    {renderCarritoItem(item)}
                  </List.Item>
                )}
              />
            )}
          </div>

          <div className="carrito-total-section">
            <div className="total-row"><Text>Subtotal:</Text><Text strong>{formatCurrency(subtotalActivo)}</Text></div>
            <div className="total-row" style={{ alignItems: 'center' }}>
              <Text>Descuento:</Text>
              <Text style={{ color: '#f5222d' }}>- {formatCurrency(descuentoActivo)}</Text>
            </div>

            <div className="total-row" style={{ alignItems: 'center' }}>
              <Text type="secondary">Desc. general:</Text>
              <Space.Compact size="small">
                <Select
                  size="small"
                  value={currentTab?.descuentoGeneralTipo || 'ninguno'}
                  style={{ width: 110 }}
                  options={[
                    { value: 'ninguno', label: 'Ninguno' },
                    { value: 'monto', label: 'Monto (C$)' },
                    { value: 'porcentaje', label: 'Porcentaje (%)' },
                  ]}
                  onChange={(tipo) => {
                    const nextVal = tipo === 'ninguno' ? 0 : (currentTab?.descuentoGeneralValor || 0);
                    setDescuentoGeneral(tipo, nextVal);
                  }}
                />
                <InputNumber
                  size="small"
                  disabled={(currentTab?.descuentoGeneralTipo || 'ninguno') === 'ninguno'}
                  min={0}
                  max={(currentTab?.descuentoGeneralTipo || 'ninguno') === 'porcentaje' ? 100 : undefined}
                  step={(currentTab?.descuentoGeneralTipo || 'ninguno') === 'porcentaje' ? 1 : 0.01}
                  value={currentTab?.descuentoGeneralValor || 0}
                  onChange={(v) => setDescuentoGeneral(currentTab?.descuentoGeneralTipo || 'ninguno', v)}
                  style={{ width: 110 }}
                  controls={false}
                />
              </Space.Compact>
            </div>
            <div className="total-row main"><Text strong>TOTAL:</Text><Title level={3} style={{ margin: 0, color: '#1677ff' }}>{formatCurrency(totalActivo)}</Title></div>
          </div>

          <div className="carrito-actions">
            <Button 
              type="primary" 
              size="large" 
              block 
              style={{ height: 70, fontSize: 24, fontWeight: 800 }}
              icon={<DollarOutlined />}
              onClick={handlePagar}
              disabled={currentTab?.productos.length === 0}
            >
              COBRAR (F12)
            </Button>
          </div>
        </div>
      </div>

      <Modal
        title="Historial de pedidos"
        open={isVentasModalVisible}
        onCancel={() => setIsVentasModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Buscar (VTA-000123 / cliente / NIT)"
            value={ventasFiltroBuscar}
            onChange={(e) => setVentasFiltroBuscar(e.target.value)}
            style={{ width: 260 }}
            allowClear
            onPressEnter={() => loadVentasHistorial({ page: 1 })}
          />
          <Select
            placeholder="Estado"
            value={ventasFiltroEstado}
            onChange={(v) => setVentasFiltroEstado(v)}
            style={{ width: 160 }}
            allowClear
            options={[
              { value: 'completada', label: 'Completadas' },
              { value: 'anulada', label: 'Anuladas' },
            ]}
          />
          <DatePicker.RangePicker
            value={ventasFiltroRango}
            onChange={(r) => setVentasFiltroRango(r)}
            format="YYYY-MM-DD"
            allowClear
          />
          <Button type="primary" onClick={() => loadVentasHistorial({ page: 1 })}>
            Buscar
          </Button>
          <Button
            onClick={async () => {
              setVentasFiltroBuscar('');
              setVentasFiltroEstado(undefined);
              setVentasFiltroRango(null);
              setVentasRecientesPage(1);
              await loadVentasHistorial({ page: 1 });
            }}
          >
            Limpiar
          </Button>
        </div>

        <Table
          rowKey="_id"
          loading={ventasRecientesLoading}
          dataSource={ventasRecientes}
          pagination={{
            current: ventasRecientesPage,
            pageSize: ventasRecientesLimit,
            total: ventasRecientesTotal,
            showSizeChanger: true,
            onChange: (page, pageSize) => {
              setVentasRecientesPage(page);
              setVentasRecientesLimit(pageSize);
              loadVentasHistorial({ page, limit: pageSize });
            },
          }}
          size="middle"
          columns={[
            {
              title: 'Venta',
              dataIndex: 'numeroVenta',
              key: 'numeroVenta',
              render: (v) => <Text strong>{v}</Text>,
            },
            {
              title: 'Fecha',
              dataIndex: 'fecha',
              key: 'fecha',
              render: (v) => <Text>{v ? new Date(v).toLocaleString() : '-'}</Text>,
            },
            {
              title: 'Cliente',
              dataIndex: ['cliente', 'nombre'],
              key: 'cliente',
              render: (_v, r) => <Text>{r?.cliente?.nombre || 'Consumidor Final'}</Text>,
            },
            {
              title: 'Pago',
              dataIndex: 'metodoPago',
              key: 'metodoPago',
              render: (v) => <Tag>{String(v || '').toUpperCase()}</Tag>,
            },
            {
              title: 'Total',
              dataIndex: 'total',
              key: 'total',
              align: 'right',
              render: (v) => <Text strong>{formatCurrency(Number(v) || 0)}</Text>,
            },
            {
              title: 'Estado',
              dataIndex: 'estado',
              key: 'estado',
              render: (v) => (
                <Tag color={v === 'anulada' ? 'red' : 'green'}>{v === 'anulada' ? 'ANULADA' : 'COMPLETADA'}</Tag>
              ),
            },
            {
              title: '',
              key: 'actions',
              align: 'right',
              render: (_v, r) => (
                <Button
                  size="small"
                  danger
                  disabled={!isAdmin() || r?.estado === 'anulada'}
                  onClick={() => anularVentaHistorial(r)}
                >
                  Anular
                </Button>
              ),
            },
          ]}
        />
        {!isAdmin() && (
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            message="Solo un administrador puede corregir/anular ventas."
            showIcon
          />
        )}
      </Modal>

      <Modal
        title={<Title level={3} style={{ margin: 0, textAlign: 'center' }}>Finalizar Venta</Title>}
        open={isModalPagoVisible}
        onCancel={() => setIsModalPagoVisible(false)}
        footer={null}
        width={480}
        centered
      >
        <div style={{ textAlign: 'center', padding: '15px 0' }}>
          <Text type="secondary" style={{ fontSize: 16 }}>Total neto a cobrar</Text>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#1677ff' }}>{formatCurrency(totalActivo)}</div>
          {currentTab?.cliente?._id && (
            <Tag color="blue" icon={<UserOutlined />}>{currentTab.cliente.nombre}</Tag>
          )}
        </div>

        <Divider style={{ margin: '15px 0' }} />

        <div style={{ marginBottom: 20 }}>
          <Text strong block style={{ marginBottom: 12 }}>Método de Pago</Text>
          <Radio.Group 
            buttonStyle="solid" 
            style={{ width: '100%', display: 'flex' }} 
            value={metodoPago} 
            onChange={e => setMetodoPago(e.target.value)}
          >
            <Radio.Button value="efectivo" style={{ flex: 1, textAlign: 'center' }}>Efectivo</Radio.Button>
            <Radio.Button value="tarjeta" style={{ flex: 1, textAlign: 'center' }}>Tarjeta</Radio.Button>
            <Radio.Button value="transferencia" style={{ flex: 1, textAlign: 'center' }}>Transf.</Radio.Button>
            <Radio.Button value="credito" style={{ flex: 1, textAlign: 'center' }} disabled={!currentTab?.cliente?._id}>
              Crédito
            </Radio.Button>
          </Radio.Group>
        </div>

        {metodoPago === 'efectivo' ? (
          <div style={{ marginBottom: 25 }}>
            <Text strong block style={{ marginBottom: 10 }}>Efectivo Recibido</Text>
            <InputNumber
              autoFocus
              style={{ width: '100%', height: 70, fontSize: 36, textAlign: 'center' }}
              value={montoRecibido}
              onChange={setMontoRecibido}
              prefix={<DollarOutlined />}
              formatter={val => `C$ ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={val => val.replace(/C\$\s?|(,*)/g, '')}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 15, padding: '15px', background: vuelto > 0 ? '#f6ffed' : '#f5f5f5', borderRadius: 12, border: '1px solid #d9d9d9' }}>
              <Text strong style={{ fontSize: 20 }}>VUELTO:</Text>
              <Title level={2} style={{ margin: 0, color: '#52c41a' }}>{formatCurrency(vuelto)}</Title>
            </div>
          </div>
        ) : metodoPago === 'credito' ? (
          <Alert 
            message="Venta al Crédito"
            description={`Se generará una deuda por ${formatCurrency(totalActivo)} a nombre de ${currentTab.cliente.nombre}.`}
            type="info"
            showIcon
            icon={<CreditCardOutlined />}
            style={{ marginBottom: 25 }}
          />
        ) : (
          <div style={{ height: 20 }} />
        )}

        <Button 
          type="primary" 
          size="large" 
          block 
          style={{ height: 60, fontSize: 18, fontWeight: 700 }}
          icon={<CheckCircleOutlined />}
          onClick={onConfirmarVenta}
          disabled={metodoPago === 'efectivo' && montoRecibido < totalActivo}
        >
          CONFIRMAR TRANSACCIÓN
        </Button>
      </Modal>
    </div>
  );
}
