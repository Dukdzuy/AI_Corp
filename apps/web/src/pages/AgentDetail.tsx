import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Card, Descriptions, Empty, Space, Tag, Timeline, Typography, theme } from 'antd';
import { HomeOutlined, RobotOutlined, LoadingOutlined, BulbOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { AgentRole, WebSocketEventType, AgentThinkingEvent, AgentActionEvent } from '@ai-corp/shared-types';
import socketClient from '../lib/websocket/socket-client';
import { LearningPanel } from '../components/learning/LearningPanel';
import { PageHeader } from '../components/common/PageHeader';
import { roleColor as roleTagColor, roleHex } from '../theme/palette';
import { useIsDark } from '../theme/AppThemeProvider';

const { Text } = Typography;

const ROLE_LABELS: Record<string, string> = {
  CEO: 'Chief Executive Officer',
  PM: 'Product Manager',
  DEV: 'Developer',
  QA: 'Quality Assurance',
  QC: 'Quality Control',
  BA: 'Business Analyst',
  ARCHITECT: 'Software Architect',
  MARKETING: 'Marketing Lead',
};

interface ActivityEntry {
  type: 'thinking' | 'action';
  message: string;
  toolName?: string;
  timestamp: Date;
}

export const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const agentRole = (id?.toUpperCase() ?? 'CEO') as string;
  const { token } = theme.useToken();
  const roleColor = roleHex(agentRole, useIsDark());
  const roleLabel = ROLE_LABELS[agentRole] ?? agentRole;

  const [isThinking, setIsThinking] = useState(false);
  const [currentTask, setCurrentTask] = useState<string>('');
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    const unsubThinking = socketClient.on<AgentThinkingEvent>(
      WebSocketEventType.AGENT_THINKING,
      (data) => {
        if (data.agentRole === agentRole) {
          setIsThinking(true);
          setCurrentTask(data.message);
          setActivities((prev) => [
            { type: 'thinking', message: data.message, timestamp: new Date() },
            ...prev.slice(0, 19),
          ]);
        }
      }
    );

    const unsubAction = socketClient.on<AgentActionEvent>(
      WebSocketEventType.AGENT_ACTION,
      (data) => {
        if (data.agentRole === agentRole) {
          setIsThinking(false);
          setCurrentTask('');
          setActivities((prev) => [
            { type: 'action', message: data.actionType, toolName: data.toolName, timestamp: new Date() },
            ...prev.slice(0, 19),
          ]);
        }
      }
    );

    return () => {
      unsubThinking();
      unsubAction();
    };
  }, [agentRole]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <PageHeader
        breadcrumb={[
          { title: <a onClick={() => navigate('/')}><HomeOutlined /> Dashboard</a> },
          { title: <a onClick={() => navigate('/agents')}>Agents</a> },
          { title: `${agentRole} Agent` },
        ]}
        avatar={
          <Badge status={isThinking ? 'warning' : 'success'} dot offset={[-6, 56]}>
            <Avatar size={64} icon={isThinking ? <LoadingOutlined /> : <RobotOutlined />} style={{ background: roleColor }} />
          </Badge>
        }
        title={`${agentRole} Agent`}
        subTitle={roleLabel}
        tags={
          <>
            <Tag color={roleTagColor(agentRole)}>{agentRole}</Tag>
            <Tag color={isThinking ? 'warning' : 'success'}>{isThinking ? 'Thinking...' : 'Idle'}</Tag>
          </>
        }
      />

      <Card style={{ marginBottom: token.marginLG }}>
        <Descriptions
          column={{ xs: 1, md: 2 }}
          items={[
            { key: 'id', label: 'Agent ID', children: <Text copyable>{id}</Text> },
            { key: 'role', label: 'Role', children: roleLabel },
            { key: 'status', label: 'Status', children: <Badge status={isThinking ? 'warning' : 'success'} text={isThinking ? 'Thinking' : 'Idle'} /> },
            {
              key: 'memory',
              label: 'Memory Namespaces',
              children: <Space size={4} wrap><Tag>lessons_learned</Tag><Tag>execution_outcomes</Tag></Space>,
            },
            {
              key: 'task',
              label: 'Current Task',
              span: 'filled',
              children: currentTask ? <Text italic type="warning">{currentTask}</Text> : <Text type="secondary">No active task</Text>,
            },
          ]}
        />
      </Card>

      <LearningPanel role={agentRole} />

      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: token.colorPrimary }} />
            Recent Activity
            <Badge count={activities.length} showZero color={token.colorFillSecondary} style={{ color: token.colorTextSecondary }} />
          </Space>
        }
      >
        {activities.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recent activity. Activity will appear here when the agent is invoked." />
        ) : (
          <Timeline
            items={activities.map((entry, i) => ({
              key: i,
              color: entry.type === 'thinking' ? 'orange' : 'blue',
              icon: entry.type === 'thinking' ? <BulbOutlined /> : <ThunderboltOutlined />,
              title: <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{entry.timestamp.toLocaleTimeString()}</Text>,
              content: (
                <Space size={6} wrap>
                  <Text>{entry.message}</Text>
                  {entry.toolName && <Tag color="blue">{entry.toolName}</Tag>}
                </Space>
              ),
            }))}
          />
        )}
      </Card>
    </div>
  );
};
