import React, { useEffect, useState } from 'react';
import { App, Avatar, Button, Card, Flex, Select, Skeleton, Space, Table, Tag, Tooltip, Typography, theme } from 'antd';
import { Permission } from '@ai-corp/shared-types';
import { usePermission } from '../lib/permissions';
import { CloudServerOutlined, RobotOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api/client';
import { PageHeader } from '../components/common/PageHeader';
import { roleHex } from '../theme/palette';
import { useIsDark } from '../theme/AppThemeProvider';

const { Text } = Typography;

interface AgentModel {
  role: string;
  name: string;
  modelRouteConfig: { provider: string; model: string; providerId?: string; fallbackProvider: string };
  isActive: boolean;
}

/** A model of a provider configured on the LLM Providers page (providerId null = NINE_ROUTER_URL gateway) */
interface AvailableModel {
  key: string;
  id: string;
  name: string;
  providerId: string | null;
  provider: string;
  category: string;
}

const optionKey = (config?: AgentModel['modelRouteConfig']) =>
  config?.providerId ? `${config.providerId}::${config.model}` : config?.model;

const CATEGORY_COLORS: Record<string, string> = {
  general: 'blue',
  code: 'green',
  reasoning: 'purple',
  premium: 'gold',
};

export const AgentSettings: React.FC = () => {
  const canConfigure = usePermission(Permission.AGENT_CONFIGURE);
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentModel[]>([]);
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const dark = useIsDark();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [agentsRes, modelsRes] = await Promise.all([
        apiClient.get('/models'),
        apiClient.get('/models/available'),
      ]);
      setAgents(agentsRes.data);
      setAvailableModels(modelsRes.data);
      setPendingChanges({});
    } catch (err) {
      message.error('Failed to load agent configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleModelChange = (role: string, newModel: string) => {
    setPendingChanges((prev) => ({ ...prev, [role]: newModel }));
  };

  const handleSave = async (role: string) => {
    const option = availableModels.find((m) => m.key === pendingChanges[role]);
    if (!option) return;

    setSaving(true);
    try {
      await apiClient.patch(`/models/${role}`, { model: option.id, ...(option.providerId && { providerId: option.providerId }) });
      message.success(`${role} agent model updated`);
      setPendingChanges((prev) => {
        const next = { ...prev };
        delete next[role];
        return next;
      });
      fetchData();
    } catch (err) {
      message.error(`Failed to update ${role} agent`);
    } finally {
      setSaving(false);
    }
  };

  const groupedModels = Object.entries(
    availableModels.reduce<Record<string, AvailableModel[]>>((groups, model) => {
      (groups[model.provider] ??= []).push(model);
      return groups;
    }, {})
  );

  const modelOptions = groupedModels.map(([provider, models]) => ({
    label: provider,
    title: provider,
    options: models.map(model => ({
      value: model.key,
      label: `${model.name} ${model.id} ${provider}`,
      model,
    })),
  }));

  const columns = [
    {
      title: 'Agent',
      dataIndex: 'role',
      key: 'role',
      width: 260,
      render: (role: string, record: AgentModel) => (
        <Flex gap={token.marginSM} align="center">
          <Avatar icon={<RobotOutlined />} style={{ background: roleHex(role, dark) }} />
          <div>
            <a onClick={() => navigate(`/agents/${role.toLowerCase()}`)}><Text strong>{role}</Text></a>
            <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block' }}>{record.name}</Text>
          </div>
        </Flex>
      ),
    },
    {
      title: 'Current Model',
      key: 'currentModel',
      render: (_: any, record: AgentModel) => {
        const modelId = record.modelRouteConfig?.model || 'N/A';
        const model = availableModels.find((m) => m.key === optionKey(record.modelRouteConfig));
        return (
          <Flex vertical gap={2} align="start">
            <Text>{model?.name || modelId}</Text>
            <Tag color="geekblue" variant="outlined">
              {model?.provider || record.modelRouteConfig?.provider || 'unknown'}
            </Tag>
          </Flex>
        );
      },
    },
    {
      title: 'Switch Model',
      key: 'switchModel',
      render: (_: any, record: AgentModel) => {
        const currentValue = pendingChanges[record.role] || optionKey(record.modelRouteConfig);
        const hasChanged = !!pendingChanges[record.role];

        return (
          <Space.Compact>
            <Select
              style={{ width: 320 }}
              disabled={!canConfigure}
              value={currentValue}
              onChange={(val) => handleModelChange(record.role, val)}
              placeholder="Select a model"
              showSearch={{ optionFilterProp: 'label' }}
              options={modelOptions}
              optionRender={option => {
                const model = (option.data as any).model as AvailableModel | undefined;
                if (!model) return option.label;
                return (
                  <Flex justify="space-between" align="center" gap={8}>
                    <Text ellipsis>{model.name}</Text>
                    <Tag color={CATEGORY_COLORS[model.category] || 'default'} style={{ margin: 0 }}>{model.category}</Tag>
                  </Flex>
                );
              }}
              labelRender={({ value }) => {
                const model = availableModels.find(m => m.key === value);
                return model ? model.name : String(value ?? '');
              }}
            />
            {hasChanged && (
              <Tooltip title="Save the new model">
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => handleSave(record.role)}>
                  Save
                </Button>
              </Tooltip>
            )}
          </Space.Compact>
        );
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="Agent Models"
        subTitle="Configure which LLM model each agent uses. Changes take effect on the next workflow run."
        extra={
          <>
            {canConfigure && (
              <Button icon={<CloudServerOutlined />} onClick={() => navigate('/providers')}>
                Manage providers & models
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        {loading && agents.length === 0 ? (
          <Skeleton active paragraph={{ rows: 6 }} style={{ padding: token.paddingLG }} />
        ) : (
          <Table dataSource={agents} columns={columns} rowKey="role" pagination={false} loading={loading} />
        )}
      </Card>
    </div>
  );
};
