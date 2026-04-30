import React, { useState, useEffect, useMemo } from 'react';
import { 
  Row, Col, Card, Typography, Button, Table, Tag, Modal,
  Form, InputNumber, Space, Divider, Alert, Statistic, Input,
  Result, Spin
} from 'antd';
import { 
  LockOutlined, DollarOutlined, CalculatorOutlined, 
  WarningOutlined, ArrowLeftOutlined, CheckCircleOutlined,
  DashboardOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getCajaActual, cerrarCaja } from '../../api/caja.api';
import { formatCurrency } from '../../utils/formatters';
import { useCajaStore } from '../../store/cajaStore';

const { Title, Text } = Typography;

const round2 = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

export default function ArqueoPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [stats, setStats] = useState(null);
  const [billetajeNIO, setBilletajeNIO] = useState([]);
  const [billetajeUSD, setBilletajeUSD] = useState([]);
  const [tipoCambio, setTipoCambio] = useState(36.6);
  const [depositoTransferencia, setDepositoTransferencia] = useState(0);
  const [form] = Form.useForm();

  const { cajaActual, setCajaActual, limpiarCaja } = useCajaStore();

  const denominacionesNIO = [
    { denominacion: 1000, tipo: 'billete' },
    { denominacion: 500, tipo: 'billete' },
    { denominacion: 200, tipo: 'billete' },
    { denominacion: 100, tipo: 'billete' },
    { denominacion: 50, tipo: 'billete' },
    { denominacion: 20, tipo: 'billete' },
    { denominacion: 10, tipo: 'billete' },
    { denominacion: 5, tipo: 'moneda' },
    { denominacion: 1, tipo: 'moneda' },
    { denominacion: 0.50, tipo: 'moneda' },
    { denominacion: 0.25, tipo: 'moneda' },
    { denominacion: 0.10, tipo: 'moneda' }
  ];

  const denominacionesUSD = [
    { denominacion: 100, tipo: 'billete' },
    { denominacion: 50, tipo: 'billete' },
    { denominacion: 20, tipo: 'billete' },
    { denominacion: 10, tipo: 'billete' },
    { denominacion: 5, tipo: 'billete' },
    { denominacion: 1, tipo: 'billete' }
  ];

  useEffect(() => {
    fetchCaja();
  }, []);

  const fetchCaja = async () => {
    setLoading(true);
    try {
      const res = await getCajaActual();
      if (res.data) {
        setCajaActual(res.data.caja);
        setStats(res.data.resumen);
        setBilletajeNIO(denominacionesNIO.map(d => ({ ...d, cantidad: 0 })));
        setBilletajeUSD(denominacionesUSD.map(d => ({ ...d, cantidad: 0 })));
      } else {
        toast.error('No hay una caja abierta');
        navigate('/caja');
      }
      } catch {
      navigate('/caja');
    } finally {
      setLoading(false);
    }
  };

  const updateBilletajeNIO = (denominacion, cantidad) => {
    setBilletajeNIO(prev => prev.map(b => b.denominacion === denominacion ? { ...b, cantidad: Number(cantidad) || 0 } : b));
  };

  const updateBilletajeUSD = (denominacion, cantidad) => {
    setBilletajeUSD(prev => prev.map(b => b.denominacion === denominacion ? { ...b, cantidad: Number(cantidad) || 0 } : b));
  };

  const totalNIO = useMemo(
    () => round2(billetajeNIO.reduce((s, b) => round2(s + round2(Number(b.denominacion) * Number(b.cantidad))), 0)),
    [billetajeNIO]
  );
  const totalUSD = useMemo(
    () => round2(billetajeUSD.reduce((s, b) => round2(s + round2(Number(b.denominacion) * Number(b.cantidad))), 0)),
    [billetajeUSD]
  );

  const totalUSDConvertido = useMemo(
    () => round2(Number(totalUSD) * Number(tipoCambio || 0)),
    [totalUSD, tipoCambio]
  );
  const totalConsolidado = useMemo(
    () => round2(Number(totalNIO) + Number(totalUSDConvertido)),
    [totalNIO, totalUSDConvertido]
  );
  const saldoSistema = useMemo(() => Number(stats?.saldoActual || 0), [stats]);
  const saldoSistemaAjustado = useMemo(
    () => round2(Number(saldoSistema) - Number(depositoTransferencia || 0)),
    [saldoSistema, depositoTransferencia]
  );
  const diferencia = useMemo(() => {
    // Si el saldo del sistema es negativo, el sistema está indicando un faltante (deuda).
    // En ese caso, la diferencia debe reflejar faltante (negativa) cuando el físico no alcanza.
    // Ej: sistema = -100, físico = 0 => diferencia = -100
    if (saldoSistemaAjustado < 0) return round2(totalConsolidado + saldoSistemaAjustado);
    return round2(totalConsolidado - saldoSistemaAjustado);
  }, [totalConsolidado, saldoSistemaAjustado]);

  const _montoAEntregar = useMemo(
    () => round2(Number(totalConsolidado) - Number(depositoTransferencia || 0)),
    [totalConsolidado, depositoTransferencia]
  );

  const handleFinalizarCierre = async () => {
    if (closing) return;
    setClosing(true);
    try {
      const bNIO = billetajeNIO
        .filter(b => b.cantidad > 0)
        .map(b => ({ 
          denominacion: Number(b.denominacion), 
          cantidad: Number(b.cantidad), 
          subtotal: Number(b.denominacion * b.cantidad),
          tipo: b.tipo,
          moneda: 'NIO'
        }));

      const bUSD = billetajeUSD
        .filter(b => b.cantidad > 0)
        .map(b => ({ 
          denominacion: Number(b.denominacion), 
          cantidad: Number(b.cantidad), 
          subtotal: Number(b.denominacion * b.cantidad),
          tipo: b.tipo,
          moneda: 'USD'
        }));
      
      const payload = { 
        billetaje: [...bNIO, ...bUSD],
        tipoCambio: Number(tipoCambio),
        depositoTransferencia: Number(depositoTransferencia || 0),
        observaciones: form.getFieldValue('observaciones') || ''
      };

      console.log('--- DEBUG PAYLOAD FRONTEND ---');
      console.log(JSON.stringify(payload, null, 2));

      await cerrarCaja(cajaActual._id, payload);
      
      limpiarCaja();
      Modal.success({
        title: '¡ARQUEO FINALIZADO!',
        okText: 'Ir al Listado',
        content: <Result status="success" title="Caja cerrada con éxito" />,
        onOk: () => navigate('/caja')
      });
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'Error al guardar arqueo');
    } finally {
      setClosing(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '100px' }}><Spin size="large" /></div>;

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '20px' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/caja')}>Atrás</Button>
          <Title level={3} style={{ margin: 0 }}>Cierre de Turno</Title>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={24}>
           <Card style={{ background: '#fafafa', border: '1px solid #d9d9d9' }}>
             <Row gutter={16} align="middle">
               <Col xs={24} md={12} lg={5}><Statistic title="Sistema (NIO)" value={saldoSistema} prefix="C$" /></Col>
               <Col xs={24} md={12} lg={5}><Statistic title="Físico (Convo)" value={totalConsolidado} prefix="C$" valueStyle={{ color: '#1677ff', fontWeight: 'bold' }} /></Col>
               <Col xs={24} md={12} lg={5}>
                 <Text strong style={{ fontSize: 12 }}>DEPÓSITO / TRANSFERENCIA</Text>
                 <InputNumber
                   size="large"
                   value={depositoTransferencia}
                   onChange={(v) => setDepositoTransferencia(v ?? 0)}
                   style={{ width: '100%', fontSize: 18, fontWeight: 'bold' }}
                   precision={2}
                   min={0}
                   prefix="C$"
                 />
               </Col>
               <Col xs={24} md={12} lg={5}>
                  <div style={{ padding: '10px', background: diferencia < 0 ? '#fff1f0' : '#f6ffed', borderRadius: 8, textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>DIFERENCIA</Text>
                    <Title level={4} style={{ margin: 0, color: diferencia < 0 ? '#f5222d' : '#52c41a' }}>
                      {formatCurrency(diferencia)}
                    </Title>
                  </div>
               </Col>
               
               <Col xs={24} md={12} lg={4}>
                 <Text strong style={{ fontSize: 12 }}>TASA DE CAMBIO</Text>
                 <InputNumber 
                   size="large" 
                   value={tipoCambio} 
                   onChange={(v) => setTipoCambio(v ?? 0)} 
                   style={{ width: '100%', fontSize: 24, fontWeight: 'bold' }}
                   precision={2}
                   prefix="C$"
                 />
               </Col>
             </Row>
           </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Efectivo NIO">
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {denominacionesNIO.map(d => (
                <div key={d.denominacion} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: 8, background: '#f5f5f5', borderRadius: 8 }}>
                  <Text strong>{d.denominacion >= 1 ? d.denominacion : `${(d.denominacion * 100).toFixed(0)}c`}</Text>
                  <InputNumber 
                    min={0} 
                    value={billetajeNIO.find(b => b.denominacion === d.denominacion)?.cantidad || 0}
                    onChange={v => updateBilletajeNIO(d.denominacion, v)}
                    style={{ width: 80 }}
                  />
                  <Text style={{ width: 100, textAlign: 'right', fontSize: 12 }}>{formatCurrency(d.denominacion * (billetajeNIO.find(b => b.denominacion === d.denominacion)?.cantidad || 0))}</Text>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Efectivo USD">
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {denominacionesUSD.map(d => (
                <div key={d.denominacion} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: 8, background: '#f6ffed', borderRadius: 8 }}>
                  <Text strong>${d.denominacion}</Text>
                  <InputNumber 
                    min={0} 
                    value={billetajeUSD.find(b => b.denominacion === d.denominacion)?.cantidad || 0}
                    onChange={v => updateBilletajeUSD(d.denominacion, v)}
                    style={{ width: 80 }}
                  />
                  <Text style={{ width: 100, textAlign: 'right', fontSize: 12 }}>${(d.denominacion * (billetajeUSD.find(b => b.denominacion === d.denominacion)?.cantidad || 0)).toFixed(2)}</Text>
                </div>
              ))}
            </div>
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>Subtotal USD:</Text>
              <Text strong style={{ fontSize: 18, color: '#52c41a' }}>${totalUSD.toFixed(2)}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>En Córdobas: {formatCurrency(totalUSDConvertido)}</Text>
          </Card>
        </Col>

        <Col span={24}>
          <Card>
            <Form form={form} layout="vertical">
              <Form.Item name="observaciones" label="Observaciones">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Button type="primary" size="large" block onClick={handleFinalizarCierre} loading={closing}>
                GUARDAR CIERRE DE CAJA
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
