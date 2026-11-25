import React, { useEffect, useState } from 'react';
import { Alert, Badge, Card, Col, Result, Row, Skeleton, Space, Table, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useHealthStatus } from '../lib/api/hooks/health';
import socketClient from '../lib/websocket/socket-client';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { ClockCircleOutlined, AppstoreOutlined } from '@ant-design/icons';

const { Text } = Typography;

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  healthy: { color: 'green', icon: <CheckCircleOutlined /> },
  degraded: { color: 'orange', icon: <WarningOutlined /> },
  unhealthy: { color: 'red', icon: <CloseCircleOutlined /> },
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  database: <DatabaseOutlined />,
  ninerouter: <ApiOutlined />,
};

const columns = [
  {
    title: 'Service',
    dataIndex: 'name',
    key: 'name',
    render: (name: string) => (
      <Space>
        {SERVICE_ICONS[name] || <CloudServerOutlined />}
        <Text strong>{name}</Text>
      </Space>
    ),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => {
      const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.healthy;
      return <Tag color={cfg.color} icon={cfg.icon}>{status}</Tag>;
    },
  },
  {
    title: 'Latency',
    dataIndex: 'latencyMs',
    key: 'latencyMs',
    render: (ms?: number) => ms !== undefined ? <Badge status={ms > 1000 ? 'warning' : 'success'} text={`${ms} ms`} /> : '-',
  },
  {
    title: 'Error',
    dataIndex: 'error',
    key: 'error',
    render: (error?: string) => error ? <Text type="danger">{error}</Text> : '-',
  },
];

export const AdminDashboard: React.FC = () => {
  const { data: health, isLoading, error } = useHealthStatus();
  const [healthAlerts, setHealthAlerts] = useState<Array<{ type: string; payload: any }>>([]);

  useEffect(() => {
    const unsubCircuitOpen = socketClient.on('system_event', (data: any) => {
      if (data.type === 'health:circuit_breaker_opened' || data.type === 'health:service_degraded') {
        setHealthAlerts((prev) => [...prev.slice(-4), data]);
      }
      if (data.type === 'health:circuit_breaker_closed') {
        setHealthAlerts((prev) => prev.filter((a) => a.payload?.service !== data.payload?.service));
      }
    });

    return () => {
      unsubCircuitOpen();
    };
  }, []);

  if (isLoading) {
    return <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>;
  }

  if (error) {
    return <Result status="error" title="Failed to load health status" subTitle="The API did not answer the health check." />;
  }

  const overallStatus = health?.status || 'unhealthy';
  const overallCfg = STATUS_CONFIG[overallStatus];

  const healthyCount = health?.checks?.filter((c: { status: string }) => c.status === 'healthy').length || 0;

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader title="System Health" subTitle="Live status of the API's dependencies and circuit breakers." />

      {healthAlerts.map((alert, i) => (
        <Alert
          key={i}
          type={alert.type === 'health:circuit_breaker_opened' ? 'error' : 'warning'}
          title={alert.type === 'health:circuit_breaker_opened' ? 'Circuit Breaker Opened' : 'Service Degraded'}
          description={`${alert.payload?.service}: ${alert.payload?.error || 'Service is degraded'}`}
          showIcon
          closable={{ onClose: () => setHealthAlerts((prev) => prev.filter((_, idx) => idx !== i)) }}
          style={{ marginBottom: 8 }}
        />
      ))}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <StatCard
            title="Overall Status"
            value={overallStatus}
            icon={overallCfg?.icon}
            color={overallStatus === 'healthy' ? 'green' : overallStatus === 'degraded' ? 'gold' : 'red'}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="Services healthy" value={healthyCount} suffix={`/ ${health?.checks?.length || 0}`} icon={<AppstoreOutlined />} color="blue" />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="Last Check"
            value={health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '-'}
            icon={<ClockCircleOutlined />}
            color="purple"
          />
        </Col>
      </Row>

      <Card title="Service Details" style={{ marginTop: 16 }}>
        <Table
          dataSource={health?.checks || []}
          columns={columns}
          rowKey="name"
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
};
