import React, { useState } from 'react';
import { Card, Typography, Button, Space, Divider, Alert, message, List, Tag, Row, Col, Form, Select, Switch, Input, InputNumber, Table, Modal } from 'antd';
import { 
  CloudDownloadOutlined, 
  SafetyCertificateOutlined, 
  HistoryOutlined, 
  CheckCircleOutlined,
  FileZipOutlined,
  DesktopOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import { getConfig, updateConfig } from '../../api/config.api';
import { crearBackup, previewRestore, restoreFromFolder } from '../../api/admin.api';
import { getPrintSettings, setPrintSettings } from '../../utils/printSettings';

const { Title, Text, Paragraph } = Typography;

export default function AjustesPage() {
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [formPrint] = Form.useForm();
  const [formConfig] = Form.useForm();

  const [restoreFolder, setRestoreFolder] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [confirmRestoreText, setConfirmRestoreText] = useState('');
  const [configLoading, setConfigLoading] = useState(false);

  const initialPrint = getPrintSettings();

  React.useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await getConfig();
      formConfig.setFieldsValue(res.data);
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const handleUpdateConfig = async (values) => {
    setConfigLoading(true);
    try {
      await updateConfig(values);
      message.success('Configuración del sistema actualizada');
    } catch (err) {
      message.error('No se pudo actualizar la configuración');
    } finally {
      setConfigLoading(false);
    }
  };

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

  const handleSelectFolder = async () => {
    try {
      if (window?.electronAPI?.selectBackupFolder) {
        const r = await window.electronAPI.selectBackupFolder();
        if (r?.ok === false) {
          message.error(r.error || 'No se pudo abrir el selector de carpeta');
          return;
        }
        if (r?.canceled) return;
        if (r?.folderPath) {
          setRestoreFolder(r.folderPath);
          setPreviewData(null);
          setConfirmRestoreText('');
        }
        return;
      }

      message.info('Escriba o pegue la ruta de la carpeta de respaldo.');
    } catch (err) {
      message.error(err?.message || 'Error seleccionando carpeta');
    }
  };

  const handlePreviewRestore = async () => {
    if (!restoreFolder) {
      message.error('Seleccione la carpeta del respaldo');
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await previewRestore(restoreFolder);
      setPreviewData(res.data);
      message.success('Previsualización cargada');
    } catch (err) {
      setPreviewData(null);
      message.error(err.response?.data?.mensaje || 'No se pudo previsualizar el respaldo');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRestoreNow = async () => {
    if (!previewData?.ok) {
      message.error('Primero previsualice el respaldo');
      return;
    }
    if (confirmRestoreText !== 'RESTAURAR') {
      message.error('Debe escribir RESTAURAR para confirmar');
      return;
    }

    Modal.confirm({
      title: 'Restaurar respaldo (acción destructiva)',
      content: (
        <div>
          <p>
            Esta acción eliminará la información actual y la reemplazará con el respaldo seleccionado.
          </p>
          <p style={{ marginBottom: 0 }}>
            Carpeta: <b>{restoreFolder}</b>
          </p>
        </div>
      ),
      okText: 'Restaurar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        setRestoreLoading(true);
        try {
          await restoreFromFolder(restoreFolder, confirmRestoreText);
          message.success('Restauración completada. Recomendado reiniciar el sistema POS.');
        } catch (err) {
          message.error(err.response?.data?.mensaje || 'No se pudo restaurar el respaldo');
        } finally {
          setRestoreLoading(false);
        }
      },
    });
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
        
        {/* Sección de Configuración del Sistema */}
        <Card 
          title={<Space><DesktopOutlined style={{ color: '#6366f1' }} /> Configuración del Sistema</Space>}
          className="dashboard-card"
        >
          <Form
            form={formConfig}
            layout="vertical"
            onFinish={handleUpdateConfig}
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Form.Item 
                  name="tipoSistema" 
                  label="Tipo de Producto / Funcionamiento"
                  extra="Desktop: Una sola caja global. Online: Múltiples cajas (una por colaborador)."
                >
                  <Select placeholder="Seleccione el modo">
                    <Select.Option value="desktop">🖥️ Escritorio (Caja Única)</Select.Option>
                    <Select.Option value="online">🌐 En Línea (Multicaja)</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item 
                  name="nombreEmpresa" 
                  label="Nombre de la Empresa"
                >
                  <Input placeholder="Ej: Mi Tienda" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item 
                  name="mostrarImagenesProductos" 
                  label="Visualización de Productos"
                  valuePropName="checked"
                >
                  <Switch checkedChildren="Mostrar Imágenes" unCheckedChildren="Ocultar Imágenes" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={configLoading}
                >
                  Guardar Cambios del Sistema
                </Button>
              </Col>
            </Row>
          </Form>
        </Card>
        
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

        {/* Restauración de respaldo */}
        <Card
          title={<Space><SafetyCertificateOutlined style={{ color: '#ef4444' }} /> Restaurar Respaldo</Space>}
          className="dashboard-card"
        >
          <Alert
            type="warning"
            showIcon
            message="Advertencia"
            description="Restaurar un respaldo borra la información actual y la reemplaza por la del respaldo. Use esta función con cuidado."
            style={{ marginBottom: 16, borderRadius: 12 }}
          />

          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={16}>
              <Input
                value={restoreFolder}
                onChange={(e) => {
                  setRestoreFolder(e.target.value);
                  setPreviewData(null);
                  setConfirmRestoreText('');
                }}
                placeholder="Ruta de carpeta (contiene .bson y .json)"
              />
            </Col>
            <Col xs={24} md={8}>
              <Button block onClick={handleSelectFolder}>
                Seleccionar Carpeta
              </Button>
            </Col>

            <Col xs={24} md={12}>
              <Button
                type="primary"
                block
                loading={previewLoading}
                onClick={handlePreviewRestore}
              >
                Previsualizar Respaldo
              </Button>
            </Col>
            <Col xs={24} md={12}>
              <Button
                danger
                type="primary"
                block
                loading={restoreLoading}
                disabled={!previewData?.ok || confirmRestoreText !== 'RESTAURAR'}
                onClick={handleRestoreNow}
              >
                Restaurar (Borra datos actuales)
              </Button>
            </Col>

            <Col xs={24}>
              <Input
                value={confirmRestoreText}
                onChange={(e) => setConfirmRestoreText(e.target.value)}
                placeholder="Escriba RESTAURAR para confirmar"
              />
            </Col>
          </Row>

          {previewData?.ok && (
            <div style={{ marginTop: 16 }}>
              <Divider style={{ margin: '12px 0' }} />
              <Text strong>Previsualización</Text>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Base de datos: </Text>
                <Tag>{previewData.dbName}</Tag>
              </div>

              <Table
                style={{ marginTop: 12 }}
                size="small"
                rowKey={(r) => `${r.database}-${r.collection}`}
                scroll={{ x: true }}
                pagination={{ pageSize: 10 }}
                dataSource={previewData.collections || []}
                columns={[
                  { title: 'Colección', dataIndex: 'collection' },
                  { title: 'Registros', dataIndex: 'documents', width: 100 },
                  {
                    title: 'Ejemplo',
                    render: (_, r) => {
                      const s = r?.samples?.[0] || '';
                      return (
                        <pre
                          style={{
                            margin: 0,
                            maxWidth: 520,
                            maxHeight: 120,
                            overflow: 'auto',
                            background: '#0b1220',
                            color: '#e5e7eb',
                            padding: 10,
                            borderRadius: 8,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {s || '—'}
                        </pre>
                      );
                    },
                  },
                ]}
              />
            </div>
          )}
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

