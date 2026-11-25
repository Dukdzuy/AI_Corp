import React, { useEffect, useRef, useCallback } from 'react';
import { App, Avatar, Button, Empty, Flex, Space, Tag, Typography, theme } from 'antd';
import { Bubble, Think } from '@ant-design/x';
import { RobotOutlined, BulbOutlined, ThunderboltOutlined, MessageOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { MeetingMessage } from '../../stores/meetingStore';
import { respondToApproval, approvalErrorMessage } from '../../lib/api/hooks/approvals';
import { performativeStyle, protocolLabel } from './performatives';
import { roleColor, roleHex } from '../../theme/palette';
import { useIsDark } from '../../theme/AppThemeProvider';

const { Text } = Typography;

interface MeetingRoomProps {
  messages: MeetingMessage[];
  connected: boolean;
}

/**
 * One Meeting Room message as an Ant Design X `Bubble`: agent chat, `Think` for an agent's
 * reasoning, `Bubble.System` for notices, and an approval bubble with Approve / Reject.
 */
const MessageBubble: React.FC<{ msg: MeetingMessage }> = ({ msg }) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const dark = useIsDark();
  const timeStr = msg.timestamp.toLocaleTimeString();

  const respond = useCallback(async (decision: 'approve' | 'reject') => {
    if (!msg.approvalId) return;
    try {
      await respondToApproval(msg.approvalId, decision);
    } catch (error) {
      message.error(approvalErrorMessage(error));
    }
  }, [msg.approvalId, message]);
  const handleApprove = useCallback(() => respond('approve'), [respond]);
  const handleReject = useCallback(() => respond('reject'), [respond]);

  if (msg.type === 'notification') {
    return <Bubble.System content={msg.message} />;
  }

  const meta = (
    <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{timeStr}</Text>
  );

  if (msg.type === 'approval') {
    return (
      <Bubble
        placement="start"
        variant="outlined"
        avatar={<Avatar icon={<ExclamationCircleOutlined />} style={{ background: token.colorWarning }} />}
        header={
          <Space size={6}>
            <Text strong>{msg.fromRole}</Text>
            <Tag color="warning" style={{ margin: 0 }}>APPROVAL</Tag>
            {meta}
          </Space>
        }
        styles={{ content: { borderColor: token.colorWarningBorder, background: token.colorWarningBg } }}
        content={msg.message}
        contentRender={content => (
          <Flex vertical gap={token.marginXS}>
            <Text>{content}</Text>
            {msg.requestData && (
              <Text type="secondary" code style={{ fontSize: token.fontSizeSM }} ellipsis>
                {JSON.stringify(msg.requestData).slice(0, 120)}
              </Text>
            )}
            <Space size={token.marginXS}>
              <Button size="small" color="green" variant="solid" icon={<CheckCircleOutlined />} onClick={handleApprove}>
                Approve
              </Button>
              <Button size="small" danger icon={<CloseCircleOutlined />} onClick={handleReject}>
                Reject
              </Button>
            </Space>
          </Flex>
        )}
      />
    );
  }

  const performative = performativeStyle(msg.performative);
  const protocol = protocolLabel(msg.protocol);
  const typeIcon = msg.type === 'action'
    ? <ThunderboltOutlined style={{ color: token.colorPrimary }} />
    : msg.type === 'chat' ? <MessageOutlined style={{ color: token.colorTextTertiary }} /> : null;

  const header = (
    <Space size={6} wrap>
      <Tag color={roleColor(msg.fromRole)} style={{ margin: 0 }}>{msg.fromRole}</Tag>
      {typeIcon}
      {performative && (
        <Tag color={performative.color} variant="outlined" style={{ margin: 0 }} title={msg.performative}>
          {msg.performative}
        </Tag>
      )}
      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
        → {msg.toRole === 'all' ? 'everyone' : msg.toRole}
        {protocol ? ` · ${protocol}` : ''}
      </Text>
      {meta}
    </Space>
  );

  return (
    <Bubble
      placement="start"
      variant={msg.type === 'action' ? 'outlined' : 'filled'}
      avatar={<Avatar icon={<RobotOutlined />} style={{ background: roleHex(msg.fromRole, dark) }} />}
      header={header}
      content={msg.message}
      contentRender={content =>
        msg.type === 'thinking' ? (
          <Think title="Thinking" icon={<BulbOutlined />} defaultExpanded>
            <Text italic type="secondary" style={{ whiteSpace: 'pre-wrap' }}>{content}</Text>
          </Think>
        ) : (
          <Text style={{ whiteSpace: 'pre-wrap' }}>{content}</Text>
        )
      }
    />
  );
};

export const MeetingRoom: React.FC<MeetingRoomProps> = ({ messages, connected }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { token } = theme.useToken();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingInlineEnd: token.paddingXS }}>
      {messages.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={connected ? 'Waiting for agent conversations...' : 'Connect to see agent messages.'}
          style={{ padding: '32px 0' }}
        />
      ) : (
        <Flex vertical gap={token.margin}>
          {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
        </Flex>
      )}
    </div>
  );
};
