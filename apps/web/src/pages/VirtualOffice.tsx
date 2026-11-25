import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Flex, Row, Select, Tag, Tooltip, Typography, theme } from 'antd';
import { TeamOutlined, MessageOutlined, ClearOutlined } from '@ant-design/icons';
import { WebSocketEventType, AgentThinkingEvent, AgentActionEvent, AgentMessageEvent, ApprovalRequiredEvent, AgentRole } from '@ai-corp/shared-types';
import { useWebsocketStore } from '../stores/websocketStore';
import { useMeetingStore, MeetingMessage } from '../stores/meetingStore';
import { usePendingApprovals } from '../lib/api/hooks/approvals';
import { useProjects } from '../lib/api/hooks/projects';
import socketClient from '../lib/websocket/socket-client';
import { AgentStatusCard, AgentStatus } from '../components/virtual-office/AgentStatusCard';
import { MeetingRoom } from '../components/virtual-office/MeetingRoom';
import { PageHeader } from '../components/common/PageHeader';

const { Text } = Typography;

const AGENT_ROLES = [
  AgentRole.CEO,
  AgentRole.BA,
  AgentRole.ARCHITECT,
  AgentRole.PM,
  AgentRole.DEV,
  AgentRole.QC,
  AgentRole.QA,
  AgentRole.MARKETING,
];

export const VirtualOffice: React.FC = () => {
  const { status } = useWebsocketStore();
  const { token } = theme.useToken();
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [agentActivities, setAgentActivities] = useState<Record<string, string>>({});
  const messages = useMeetingStore((s) => s.messages);
  const addMessage = useMeetingStore((s) => s.addMessage);
  const clearMessages = useMeetingStore((s) => s.clearMessages);
  const { data: apiApprovals = [] } = usePendingApprovals();
  const { data: projects = [] } = useProjects();
  // Which project the office shows; 'all' follows every active project
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const activeProjectIds = projects.filter(p => p.status === 'active').map(p => p.id);
  const watchedIds = projectFilter === 'all' ? activeProjectIds : [projectFilter];
  const watchedKey = watchedIds.join(',');
  const visibleMessages = projectFilter === 'all' ? messages : messages.filter(m => m.projectId === projectFilter);

  // Agent actions and messages are sent to project rooms: join the rooms of the watched projects
  useEffect(() => {
    const ids = watchedKey ? watchedKey.split(',') : [];
    ids.forEach(id => socketClient.subscribeProject(id));
    return () => ids.forEach(id => socketClient.unsubscribeProject(id));
  }, [watchedKey]);

  // Add pending approvals from REST API as meeting room messages on mount
  useEffect(() => {
    if (apiApprovals.length > 0) {
      for (const a of apiApprovals) {
        addMessage({
          id: `approval-${a.id}`,
          fromRole: 'QA' as AgentRole,
          toRole: 'all',
          message: `⚠️ APPROVAL REQUIRED: ${a.approvalType} — QA passed, needs human sign-off.`,
          type: 'approval',
          timestamp: new Date(a.requestedAt),
          approvalId: a.id,
          projectId: a.workflowRun?.projectId || '',
          approvalType: a.approvalType,
          requestData: a.requestData as Record<string, unknown>,
        });
      }
    }
  }, [apiApprovals.length]);

  useEffect(() => {
    const unsubThinking = socketClient.on<AgentThinkingEvent>(
      WebSocketEventType.AGENT_THINKING,
      (data) => {
        setAgentStatuses((prev) => ({ ...prev, [data.agentRole]: 'thinking' }));
        setAgentActivities((prev) => ({ ...prev, [data.agentRole]: data.message }));
        addMessage({
          id: `think-${Date.now()}-${data.agentRole}`,
          fromRole: data.agentRole,
          toRole: 'all',
          message: data.message,
          type: 'thinking',
          timestamp: new Date(),
          projectId: data.projectId,
        });
      }
    );

    const unsubAction = socketClient.on<AgentActionEvent>(
      WebSocketEventType.AGENT_ACTION,
      (data) => {
        setAgentStatuses((prev) => ({ ...prev, [data.agentRole]: 'working' }));
        setAgentActivities((prev) => ({
          ...prev,
          [data.agentRole]: `${data.actionType} via ${data.toolName}`,
        }));
        addMessage({
          id: `action-${Date.now()}-${data.agentRole}`,
          fromRole: data.agentRole,
          toRole: 'all',
          message: `${data.actionType}: ${data.toolName}`,
          type: 'action',
          timestamp: new Date(),
          projectId: data.projectId,
        });
      }
    );

    const unsubMessage = socketClient.on<AgentMessageEvent>(
      WebSocketEventType.AGENT_MESSAGE,
      (data) => {
        setAgentStatuses((prev) => ({ ...prev, [data.fromAgent]: 'idle' }));
        addMessage({
          id: data.id ?? `msg-${Date.now()}-${data.fromAgent}`,
          fromRole: data.fromAgent,
          toRole: data.toAgent || 'all',
          message: data.message,
          type: data.messageType as MeetingMessage['type'],
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          projectId: data.projectId,
          performative: data.performative,
          protocol: data.protocol,
        });
      }
    );

    const unsubApproval = socketClient.on<ApprovalRequiredEvent>(
      WebSocketEventType.HUMAN_APPROVAL_REQUIRED,
      (data) => {
        addMessage({
          id: `approval-${data.approvalId}`,
          fromRole: 'QA' as AgentRole,
          toRole: 'all',
          message: `⚠️ APPROVAL REQUIRED: ${data.approvalType} — QA passed, needs human sign-off.`,
          type: 'approval',
          timestamp: new Date(data.requestedAt),
          approvalId: data.approvalId,
          projectId: data.projectId,
          approvalType: data.approvalType,
          requestData: data.requestData,
        });
      }
    );

    return () => {
      unsubThinking();
      unsubAction();
      unsubMessage();
      unsubApproval();
    };
  }, []);

  const panelHeight = 'calc(100vh - 210px)';

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="Virtual Office"
        subTitle="Watch your AI agents collaborate in real-time."
        tags={<Badge status={status === 'connected' ? 'processing' : 'error'} text={<Text type="secondary" style={{ textTransform: 'capitalize' }}>{status === 'connected' ? 'Live' : status}</Text>} />}
        extra={
          <Select
            value={projectFilter}
            onChange={setProjectFilter}
            style={{ width: 280 }}
            showSearch={{ optionFilterProp: 'label' }}
            prefix="Project"
            options={[
              { value: 'all', label: 'All active projects' },
              ...projects.map(p => ({ value: p.id, label: p.name })),
            ]}
          />
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card
            title={<Flex gap={token.marginXS} align="center"><TeamOutlined style={{ color: token.colorPrimary }} />Agent Status</Flex>}
            extra={<Tag variant="filled">{AGENT_ROLES.length} agents</Tag>}
            style={{ height: panelHeight, minHeight: 480, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { padding: token.paddingSM, overflowY: 'auto', flex: 1 } }}
          >
            <Flex vertical gap={token.marginXS}>
              {AGENT_ROLES.map((role) => (
                <AgentStatusCard
                  key={role}
                  role={role}
                  name={`${role} Agent`}
                  status={agentStatuses[role] ?? 'idle'}
                  lastActivity={agentActivities[role]}
                />
              ))}
            </Flex>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title={
              <Flex gap={token.marginXS} align="center">
                <MessageOutlined style={{ color: token.colorSuccess }} />
                Meeting Room
                <Tag variant="filled" style={{ marginInlineStart: token.marginXXS }}>{visibleMessages.length} messages</Tag>
              </Flex>
            }
            extra={
              messages.length > 0 ? (
                <Tooltip title="Clear messages">
                  <Button type="text" size="small" icon={<ClearOutlined />} onClick={clearMessages} aria-label="Clear messages" />
                </Tooltip>
              ) : null
            }
            style={{ height: panelHeight, minHeight: 480, display: 'flex', flexDirection: 'column' }}
            styles={{ body: { padding: token.padding, overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
          >
            <MeetingRoom messages={visibleMessages} connected={status === 'connected'} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
