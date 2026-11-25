import React from 'react';
import { Avatar, Badge, Card, Flex, Tag, Typography, theme } from 'antd';
import { RobotOutlined, LoadingOutlined, BulbOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { AgentRole } from '@ai-corp/shared-types';
import { roleHex } from '../../theme/palette';
import { useIsDark } from '../../theme/AppThemeProvider';

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

export type AgentStatus = 'idle' | 'thinking' | 'working';

interface AgentStatusCardProps {
  role: AgentRole;
  name: string;
  status: AgentStatus;
  lastActivity?: string;
}

const STATUS_CONFIG: Record<AgentStatus, { color: string; badge: 'default' | 'warning' | 'processing'; icon: React.ReactNode; label: string }> = {
  idle: { color: 'default', badge: 'default', icon: null, label: 'Idle' },
  thinking: { color: 'warning', badge: 'warning', icon: <BulbOutlined />, label: 'Thinking' },
  working: { color: 'success', badge: 'processing', icon: <ThunderboltOutlined />, label: 'Working' },
};

export const AgentStatusCard: React.FC<AgentStatusCardProps> = ({
  role,
  name,
  status,
  lastActivity,
}) => {
  const { token } = theme.useToken();
  const roleColor = roleHex(role, useIsDark());
  const statusConfig = STATUS_CONFIG[status];
  const isThinking = status === 'thinking';

  return (
    <Card
      size="small"
      style={{
        borderColor: status === 'idle' ? undefined : `${roleColor}88`,
        boxShadow: status === 'idle' ? undefined : `0 0 0 2px ${roleColor}22`,
        transition: 'all 0.3s ease',
      }}
      styles={{ body: { padding: `${token.paddingSM}px ${token.padding}px` } }}
    >
      <Flex align="center" gap={token.marginSM}>
        <Badge status={statusConfig.badge} dot offset={[-4, 38]}>
          <Avatar size={44} icon={isThinking ? <LoadingOutlined /> : <RobotOutlined />} style={{ background: roleColor, flexShrink: 0 }} />
        </Badge>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Flex gap={6} align="center">
            <Text strong>{role}</Text>
            <Tag color={statusConfig.color} icon={statusConfig.icon} style={{ margin: 0 }}>
              {statusConfig.label}
            </Tag>
          </Flex>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block' }}>
            {ROLE_LABELS[role] ?? role}
          </Text>
          {lastActivity && (
            <Text type="secondary" ellipsis style={{ fontSize: token.fontSizeSM, display: 'block', opacity: 0.75 }}>
              {lastActivity}
            </Text>
          )}
        </div>
      </Flex>
    </Card>
  );
};
