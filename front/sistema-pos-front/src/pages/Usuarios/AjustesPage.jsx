import React, { useState } from 'react';
import { Card, Typography, Button, Space, Divider, Alert, message, List, Tag, Row, Col, Form, Select, Switch, Input, InputNumber } from 'antd';
import { 
  CloudDownloadOutlined, 
  SafetyCertificateOutlined, 
  HistoryOutlined, 
  CheckCircleOutlined,
  FileZipOutlined,
  DesktopOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import { crearBackup } from '../../api/admin.api';
import { getPrintSettings, setPrintSettings } from '../../utils/printSettings';

const { Title, Text, Paragraph } = Typography;

export default function AjustesPage() {
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [formPrint] = Form.useForm();

  const initialPrint = getPrintSettings();

  const handleBackup = async () => {
    setLoading(true);
    const hide = message.loading('Generando respaldo de seguridad...', 0);
    try {
      const res = await crearBackup();
      if (res.data.ok) {
        message.success('Respaldo creado exitosamente en tu Escritorio.');
        setLastBackup({
          fecha: new Date().toLocaleString(),
          archivo: res.data.archivo,
          ruta: res.data.ruta
        });
      }
    } catch (error) {
      console.error('Error al crear backup:', error);
      message.error(error.response?.data?.mensaje || 'Error al conectar con el servidor para crear el respaldo.');
    } finally {
      setLoading(false);
      hide();
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ fontWeight: 800, marginBottom: 4 }}>Administración y Ajustes</Title>
          <Text type="secondary" style={{ fontSize: 16 }}>Configuración global del sistema y herramientas de mantenimiento.</Text>
        </div>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        
        {/* Sección de Backups */}
        <Card 
          title={<Space><SafetyCertificateOutlined style={{ color: '#10b981' }} /> Respaldos de Seguridad</Space>}
          className="dashboard-card"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={14}>
              <Title level={5}>Copia de seguridad local</Title>
              <Paragraph type="secondary">
                Genera una copia completa de la base de datos (ventas, inventario, clientes, etc.) 
                comprimida en formato .ZIP. El archivo se guardará automáticamente en una carpeta llamada 
                <Tag style={{ margin: '0 4px' }}>POS_Backups</Tag> en el <strong>Escritorio</strong> de esta computadora.
              </Paragraph>
              <Alert 
                message="Recomendación"
                description="Se recomienda realizar un respaldo al finalizar cada jornada laboral para prevenir pérdida de datos."
                type="info"
                showIcon
                style={{ marginBottom: 24, borderRadius: 12 }}
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<CloudDownloadOutlined />} 
                loading={loading}
                onClick={handleBackup}
                style={{ height: 48, borderRadius: 10, fontWeight: 600, padding: '0 32px' }}
              >
                Crear Backup Ahora
              </Button>
            </Col>
            
            <Col xs={24} md={10}>
              <div style={{ background: '#f8fafc', padding: 20, borderRadius: 12, height: '100%', border: '1px solid rgba(0,0,0,0.02)' }}>
                <Title level={5} style={{ fontSize: 14, textTransform: 'uppercase', color: '#64748b', letterSpacing: 0.5 }}>
                  <HistoryOutlined /> Último Respaldo
                </Title>
                <Divider style={{ margin: '12px 0' }} />
                
                {lastBackup ? (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Fecha y hora:</Text>
                      <div style={{ fontWeight: 600 }}>{lastBackup.fecha}</div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>Archivo generado:</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0ea5e9' }}>
                        <FileZipOutlined />
                        <Text strong style={{ fontSize: 13 }}>{lastBackup.archivo}</Text>
                      </div>
                    </div>
                    <div style={{ background: '#f0fdf4', padding: '8px 12px', borderRadius: 8, border: '1px solid #bbf7d0', marginTop: 8 }}>
                      <Space>
                        <CheckCircleOutlined style={{ color: '#10b981' }} />
                        <Text style={{ fontSize: 12, color: '#166534' }}>Guardado en Escritorio / POS_Backups</Text>
                      </Space>
                    </div>
                  </Space>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <DesktopOutlined style={{ fontSize: 32, color: '#cbd5e1', marginBottom: 12 }} />
                    <Paragraph type="secondary" style={{ fontSize: 13 }}>
                      No se han realizado respaldos en esta sesión.
                    </Paragraph>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card>

        {/* Sección de Impresión */}
        <Card
          title={<Space><PrinterOutlined /> Impresión</Space>}
          className="dashboard-card"
        >
          <Alert
            type="info"
            showIcon
            message="Configura el tamaño del papel para recibos"
            description="Si no estás seguro, empieza con 58mm. Puedes cambiarlo en cualquier momento."
            style={{ marginBottom: 16, borderRadius: 12 }}
          />

          <Form
            form={formPrint}
            layout="vertical"
            initialValues={initialPrint}
            onValuesChange={(_, all) => {
              try {
                setPrintSettings(all);
              } catch {
                // noop
              }
            }}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}>
                <Form.Item name="paperWidthMm" label="Ancho de papel">
                  <Select>
                    <Select.Option value={58}>58 mm</Select.Option>
                    <Select.Option value={80}>80 mm</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="copies" label="Copias">
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="silent"
                  label="Impresión silenciosa"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name="deviceName"
                  label="Impresora por defecto (opcional)"
                  extra="Si está vacío, se abrirá el diálogo para elegir impresora."
                >
                  <Input placeholder="Ej: EPSON TM-T20II" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        {/* Otras configuraciones (Placeholders para futuro) */}
        <Card 
          title={<Space><DesktopOutlined style={{ color: '#6366f1' }} /> Información del Sistema</Space>}
          className="dashboard-card"
        >
          <List size="small">
             <List.Item extra={<Tag color="blue">v1.2.0</Tag>}>Versión del Software</List.Item>
             <List.Item extra={<Tag color="green">Mongoose 8.x</Tag>}>Motor de Base de Datos</List.Item>
             <List.Item extra={<Text type="secondary">Inactivo</Text>}>Actualizaciones Automáticas</List.Item>
          </List>
        </Card>

      </Space>
    </div>
  );
}

