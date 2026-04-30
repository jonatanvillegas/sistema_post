import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Tag, DatePicker, Select, Input, Row, Col, Button, Tooltip, Modal } from 'antd';
import { HistoryOutlined, SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAuditLogs } from '../../api/audit.api';
import { getUsuarios } from '../../api/auth.api';
import { toast } from 'react-hot-toast';
import { formatDateTime } from '../../utils/formatters';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AuditPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [usuarios, setUsuarios] = useState([]);
  
  const [filtros, setFiltros] = useState({
    modulo: undefined,
    usuarioId: undefined,
    desde: null,
    hasta: null,
    page: 1,
    limit: 50,
  });

  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [filtros.page, filtros.limit, filtros.modulo, filtros.usuarioId]);

  const fetchUsuarios = async () => {
    try {
      const res = await getUsuarios();
      setUsuarios(res.data);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        ...filtros,
        desde: filtros.desde ? filtros.desde.format('YYYY-MM-DD') : undefined,
        hasta: filtros.hasta ? filtros.hasta.format('YYYY-MM-DD') : undefined,
      };
      const res = await getAuditLogs(params);
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      toast.error('Error al cargar logs de auditoría');
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = (log) => {
    setSelectedLog(log);
    setIsModalVisible(true);
  };

  const getModuloColor = (modulo) => {
    switch (modulo) {
      case 'AUTH': return 'blue';
      case 'VENTAS': return 'green';
      case 'INVENTARIO': return 'orange';
      case 'CAJA': return 'purple';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Fecha/Hora',
      dataIndex: 'fecha',
      key: 'fecha',
      width: 170,
      render: (val) => formatDateTime(val),
    },
    {
      title: 'Usuario',
      dataIndex: ['usuarioId', 'nombre'],
      key: 'usuario',
      width: 150,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{record.usuarioId?.rol?.toUpperCase()}</Text>
        </Space>
      ),
    },
    {
      title: 'Módulo',
      dataIndex: 'modulo',
      key: 'modulo',
      width: 120,
      render: (val) => <Tag color={getModuloColor(val)}>{val}</Tag>,
    },
    {
      title: 'Acción',
      dataIndex: 'accion',
      key: 'accion',
      width: 120,
      render: (val) => <Tag strong>{val}</Tag>,
    },
    {
      title: 'Detalle',
      dataIndex: 'detalle',
      key: 'detalle',
      ellipsis: true,
    },
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 130,
      responsive: ['lg'],
    },
    {
      title: '',
      key: 'acciones',
      align: 'right',
      width: 50,
      render: (_, record) => (
        <Tooltip title="Ver más">
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleVerDetalle(record)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={2} className="page-title">Auditoría de Actividad</Title>
          <Text className="page-sub">Registro histórico de todas las acciones realizadas en el sistema.</Text>
        </div>
      </div>

      <Card bordered={false} style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Módulo</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Todos los módulos"
              allowClear
              value={filtros.modulo}
              onChange={(val) => setFiltros({ ...filtros, modulo: val, page: 1 })}
            >
              <Option value="AUTH">AUTH (Usuarios/Login)</Option>
              <Option value="VENTAS">VENTAS</Option>
              <Option value="INVENTARIO">INVENTARIO</Option>
              <Option value="CAJA">CAJA</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Usuario</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Todos los usuarios"
              allowClear
              showSearch
              filterOption={(input, option) => (option?.children ?? '').toLowerCase().includes(input.toLowerCase())}
              value={filtros.usuarioId}
              onChange={(val) => setFiltros({ ...filtros, usuarioId: val, page: 1 })}
            >
              {usuarios.map(u => (
                <Option key={u._id} value={u._id}>{u.nombre}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Rango de Fechas</Text>
            <DatePicker.RangePicker
              style={{ width: '100%' }}
              value={[filtros.desde, filtros.hasta]}
              onChange={(dates) => setFiltros({ ...filtros, desde: dates ? dates[0] : null, hasta: dates ? dates[1] : null, page: 1 })}
            />
          </Col>
          <Col xs={24} sm={12} md={4} style={{ display: 'flex', gap: 8, paddingTop: 22 }}>
            <Button icon={<SearchOutlined />} type="primary" onClick={fetchLogs} block>Filtrar</Button>
            <Button icon={<ReloadOutlined />} onClick={() => setFiltros({ modulo: undefined, usuarioId: undefined, desde: null, hasta: null, page: 1, limit: 50 })} />
          </Col>
        </Row>
      </Card>

      <Card bordered={false} bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="middle"
          scroll={{ x: true }}
          pagination={{
            total,
            current: filtros.page,
            pageSize: filtros.limit,
            onChange: (p, s) => setFiltros({ ...filtros, page: p, limit: s }),
            showSizeChanger: true,
          }}
        />
      </Card>

      <Modal
        title="Detalle del Registro de Auditoría"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsModalVisible(false)}>Cerrar</Button>
        ]}
        width={600}
      >
        {selectedLog && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">Fecha y Hora:</Text>
                <div style={{ fontWeight: 'bold' }}>{formatDateTime(selectedLog.fecha)}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Usuario:</Text>
                <div style={{ fontWeight: 'bold' }}>{selectedLog.usuarioId?.nombre}</div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Módulo:</Text>
                <div><Tag color={getModuloColor(selectedLog.modulo)}>{selectedLog.modulo}</Tag></div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Acción:</Text>
                <div><Tag strong>{selectedLog.accion}</Tag></div>
              </Col>
              <Col span={24}>
                <Text type="secondary">Detalle:</Text>
                <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 4 }}>
                  {selectedLog.detalle}
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary">Dirección IP:</Text>
                <div>{selectedLog.ip || 'Local/Sistema'}</div>
              </Col>
            </Row>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <Text type="secondary">Metadata / Datos técnicos:</Text>
                <pre style={{ 
                  background: '#1e1e1e', 
                  color: '#d4d4d4', 
                  padding: 12, 
                  borderRadius: 4, 
                  fontSize: 12,
                  marginTop: 8,
                  maxHeight: 250,
                  overflow: 'auto'
                }}>
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}
