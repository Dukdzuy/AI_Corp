import React, { useState } from 'react';
import { Alert, App, Avatar, Badge, Button, Card, Checkbox, Drawer, Flex, Form, Input, InputNumber, Modal, Popconfirm, Result, Select, Space, Table, Tabs, Tag, Typography, theme } from 'antd';
import { ApiOutlined, KeyOutlined, LinkOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { Permission } from '@ai-corp/shared-types';
import { ApiKeyView, WebhookView, useApiKeys, useIntegrationMutations, useWebhookDeliveries, useWebhookEvents, useWebhooks } from '../lib/api/hooks/integrations';
import { useProjects } from '../lib/api/hooks/projects';
import { PERMISSION_LABELS } from '../lib/permissions';
import { useAuthStore } from '../stores/authStore';
import { PageHeader } from '../components/common/PageHeader';

const { Text, Paragraph } = Typography;
const errorText = (e: any) => e?.response?.data?.message || e?.message || 'Request failed';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

/**
 * Integrations (Phase 5, Task 22): API keys for the /api/v1 integration API and webhooks
 * for outgoing events. Secrets are shown once, right after creation.
 */
export const IntegrationsPage: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const { data: keys = [], isLoading: keysLoading } = useApiKeys();
  const { data: webhooks = [], isLoading: hooksLoading } = useWebhooks();
  const { data: events = [] } = useWebhookEvents();
  const { data: projects = [] } = useProjects();
  const m = useIntegrationMutations();
  const [keyModal, setKeyModal] = useState(false);
  const [hookModal, setHookModal] = useState(false);
  const [secret, setSecret] = useState<{ title: string; value: string; hint: string } | null>(null);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const { data: deliveries = [] } = useWebhookDeliveries(selectedHook);
  const { message } = App.useApp();
  const { token } = theme.useToken();

  // A key can carry any permission of its owner's role (the API checks it again)
  const grantable = (user?.permissions ?? []) as Permission[];

  const keyColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (n: string, k: ApiKeyView) => <Flex vertical align="start"><Text strong>{n}</Text><Text code style={{ fontSize: 11 }}>{k.prefix}</Text></Flex> },
    { title: 'Scopes', dataIndex: 'scopes', key: 'scopes', render: (s: string[]) => <Space size={[4, 4]} wrap>{s.map(x => <Tag key={x}>{x}</Tag>)}</Space> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: (s: string) => <Badge status={s === 'active' ? 'success' : 'error'} text={s} /> },
    { title: 'Last used', dataIndex: 'lastUsedAt', key: 'lastUsedAt', width: 170, render: (d: string | null) => (d ? new Date(d).toLocaleString() : <Text type="secondary">never</Text>) },
    { title: 'Expires', dataIndex: 'expiresAt', key: 'expiresAt', width: 120, render: (d: string | null) => (d ? new Date(d).toLocaleDateString() : <Text type="secondary">never</Text>) },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_: unknown, k: ApiKeyView) =>
        k.status === 'active' && (
          <Popconfirm title="Revoke this key? Tools using it stop working." onConfirm={() => m.revokeKey.mutate(k.id, { onError: e => message.error(errorText(e)) })}>
            <Button danger size="small">Revoke</Button>
          </Popconfirm>
        ),
    },
  ];

  const hookColumns = [
    { title: 'URL', dataIndex: 'url', key: 'url', render: (u: string, w: WebhookView) => <Flex vertical><Text copyable>{u}</Text><Text type="secondary" style={{ fontSize: 11 }}>secret {w.secretHint}</Text></Flex> },
    { title: 'Events', dataIndex: 'events', key: 'events', render: (e: string[]) => <Space size={[4, 4]} wrap>{e.map(x => <Tag key={x} color="geekblue">{x}</Tag>)}</Space> },
    { title: 'Project', dataIndex: 'projectId', key: 'projectId', width: 170, render: (id: string | null) => (id ? projects.find(p => p.id === id)?.name ?? id.slice(0, 8) : <Text type="secondary">all projects</Text>) },
    { title: 'State', dataIndex: 'active', key: 'active', width: 90, render: (a: boolean) => <Badge status={a ? 'success' : 'default'} text={a ? 'active' : 'off'} /> },
    {
      title: '',
      key: 'actions',
      width: 230,
      render: (_: unknown, w: WebhookView) => (
        <Space>
          <Button size="small" icon={<SendOutlined />} loading={m.testWebhook.isPending && m.testWebhook.variables === w.id}
            onClick={() => m.testWebhook.mutate(w.id, {
              onSuccess: r => (r.ok ? message.success(`Test delivered (HTTP ${r.responseCode})`) : message.error(`Test failed: ${r.error}`)),
              onError: e => message.error(errorText(e)),
            })}>Test</Button>
          <Button size="small" onClick={() => setSelectedHook(w.id)}>Deliveries</Button>
          <Popconfirm title="Delete this webhook?" onConfirm={() => m.deleteWebhook.mutate(w.id)}>
            <Button size="small" danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16} style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="Integrations"
        subTitle="API keys for external tools and webhooks for outgoing events. Secrets are shown once."
        avatar={<Avatar shape="square" size={44} icon={<ApiOutlined />} style={{ background: token.colorPrimaryBg, color: token.colorPrimary }} />}
      />
      <Alert
        type="info"
        showIcon
        title="Integration API"
        description={
          <span>
            External tools call <Text code>{API_BASE}/v1/…</Text> with the header <Text code>x-api-key</Text>. Each key can only use its scopes and is limited per minute.
            Documentation: <a href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">{API_BASE}/docs</a>
          </span>
        }
      />

      <Card styles={{ body: { paddingTop: 0 } }}>
        <Tabs
          items={[
            {
              key: 'keys',
              icon: <KeyOutlined />,
              label: `API keys (${keys.length})`,
              children: (
                <>
                  <Flex justify="end" style={{ marginBottom: token.marginSM }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setKeyModal(true)}>New API key</Button>
                  </Flex>
                  <Table rowKey="id" size="middle" loading={keysLoading} dataSource={keys} columns={keyColumns} pagination={false} />
                </>
              ),
            },
            {
              key: 'hooks',
              icon: <LinkOutlined />,
              label: `Webhooks (${webhooks.length})`,
              children: (
                <>
                  <Flex justify="end" style={{ marginBottom: token.marginSM }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setHookModal(true)}>New webhook</Button>
                  </Flex>
                  <Table rowKey="id" size="middle" loading={hooksLoading} dataSource={webhooks} columns={hookColumns} pagination={false} />
                </>
              ),
            },
          ]}
        />
      </Card>

      <Drawer
        title="Recent deliveries"
        open={!!selectedHook}
        onClose={() => setSelectedHook(null)}
        size="large"
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
          {webhooks.find(w => w.id === selectedHook)?.url}
        </Text>
        <Table
          rowKey="id"
          size="small"
          dataSource={deliveries}
          pagination={false}
          columns={[
            { title: 'Time', dataIndex: 'createdAt', key: 't', width: 170, render: (d: string) => new Date(d).toLocaleString() },
            { title: 'Event', dataIndex: 'event', key: 'e', render: (e: string) => <Tag>{e}</Tag> },
            { title: 'Result', dataIndex: 'status', key: 's', width: 100, render: (s: string) => <Badge status={s === 'delivered' ? 'success' : 'error'} text={s} /> },
            { title: 'HTTP', dataIndex: 'responseCode', key: 'c', width: 70 },
            { title: 'Attempts', dataIndex: 'attempts', key: 'a', width: 90 },
            { title: 'Error', dataIndex: 'error', key: 'err', render: (e: string | null) => e && <Text type="danger">{e}</Text> },
          ]}
        />
      </Drawer>

      <Modal title="New API key" open={keyModal} onCancel={() => setKeyModal(false)} footer={null} destroyOnHidden>
        <Form
          layout="vertical"
          initialValues={{ scopes: grantable.filter(p => p === Permission.PROJECT_READ) }}
          onFinish={values =>
            m.createKey.mutate(values, {
              onSuccess: r => {
                setKeyModal(false);
                setSecret({ title: `API key "${r.apiKey.name}"`, value: r.token, hint: 'Send it in the x-api-key header. It is not shown again.' });
              },
              onError: e => message.error(errorText(e)),
            })
          }
        >
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name the key after the tool that uses it' }]}>
            <Input placeholder="e.g. CI pipeline" maxLength={80} />
          </Form.Item>
          <Form.Item name="scopes" label="Scopes" rules={[{ required: true, message: 'Pick at least one scope' }]}>
            <Checkbox.Group style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}
              options={grantable.map(p => ({ value: p, label: PERMISSION_LABELS[p] ?? p }))} />
          </Form.Item>
          <Form.Item name="expiresInDays" label="Expires after (days, optional)">
            <InputNumber min={1} max={365} style={{ width: 160 }} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={m.createKey.isPending}>Create key</Button>
        </Form>
      </Modal>

      <Modal title="New webhook" open={hookModal} onCancel={() => setHookModal(false)} footer={null} destroyOnHidden>
        <Form
          layout="vertical"
          initialValues={{ events: ['workflow.completed', 'workflow.failed', 'approval.requested'] }}
          onFinish={values =>
            m.createWebhook.mutate(values, {
              onSuccess: w => {
                setHookModal(false);
                setSecret({ title: 'Webhook signing secret', value: w.secret ?? '', hint: 'Verify X-AICorp-Signature = sha256=HMAC(secret, "<X-AICorp-Timestamp>.<body>"). It is not shown again.' });
              },
              onError: e => message.error(errorText(e)),
            })
          }
        >
          <Form.Item name="url" label="URL" rules={[{ required: true, type: 'url', message: 'An http(s) URL' }]}>
            <Input placeholder="https://example.com/hooks/ai-corp" />
          </Form.Item>
          <Form.Item name="events" label="Events" rules={[{ required: true }]}>
            <Select mode="multiple" options={events.map(e => ({ value: e, label: e }))} />
          </Form.Item>
          <Form.Item name="projectId" label="Project (optional)">
            <Select allowClear placeholder="All projects" options={projects.map(p => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={m.createWebhook.isPending}>Create webhook</Button>
        </Form>
      </Modal>

      <Modal open={!!secret} onOk={() => setSecret(null)} onCancel={() => setSecret(null)} cancelButtonProps={{ style: { display: 'none' } }} okText="I have copied it">
        <Result
          status="success"
          title={secret?.title}
          subTitle={secret?.hint}
          extra={<Paragraph copyable={{ text: secret?.value }} code style={{ wordBreak: 'break-all', textAlign: 'left' }}>{secret?.value}</Paragraph>}
        />
      </Modal>
    </Flex>
  );
};
