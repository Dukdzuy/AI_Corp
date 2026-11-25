import React, { useEffect, useState, useCallback } from 'react';
import { App, Avatar, Badge, Button, Empty, Flex, Popover, Tag, Tooltip, Typography, theme } from 'antd';
import {
  ExclamationCircleOutlined,
  BellOutlined,
  BellFilled,
} from '@ant-design/icons';
import { WebSocketEventType, ApprovalRequiredEvent } from '@ai-corp/shared-types';
import socketClient from '../../lib/websocket/socket-client';
import { useQueryClient } from '@tanstack/react-query';
import { respondToApproval, approvalErrorMessage, approvalKeys, toPendingApproval, usePendingApprovals } from '../../lib/api/hooks/approvals';
import { ApprovalModal } from './ApprovalModal';
import { approvalSummary } from '../../lib/approvalSummary';

const { Text } = Typography;

export interface PendingApproval {
  approvalId: string;
  workflowRunId: string;
  projectId: string;
  projectName?: string;
  approvalType: string;
  requestData: Record<string, unknown>;
  requestedAt: Date;
}

const APPROVAL_TYPE_LABELS: Record<string, string> = {
  code_merge: 'Code Merge',
  marketing_post: 'Marketing Post',
  milestone_complete: 'Milestone Complete',
  project_completion: 'Project Completion',
  general: 'General Approval',
};

interface ApprovalNotificationProps {
  userId?: string;
}

/**
 * The bell: every approval waiting for the user (loaded from the API, so it survives a reload,
 * and kept fresh by the approval:required socket event). An admin sees everyone's.
 */
export const ApprovalNotification: React.FC<ApprovalNotificationProps> = () => {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { data: records = [] } = usePendingApprovals();
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pendingApprovals: PendingApproval[] = records.map(toPendingApproval).filter(a => !answered.has(a.approvalId));

  useEffect(() => {
    const unsub = socketClient.on<ApprovalRequiredEvent>(
      WebSocketEventType.HUMAN_APPROVAL_REQUIRED,
      () => queryClient.invalidateQueries({ queryKey: approvalKeys.all })
    );

    return () => {
      unsub();
    };
  }, [queryClient]);

  const respond = useCallback(async (approvalId: string, decision: 'approve' | 'reject', comment?: string) => {
    setSubmitting(true);
    try {
      await respondToApproval(approvalId, decision, comment);
      setAnswered((prev) => new Set(prev).add(approvalId));
      setModalOpen(false);
      setSelectedApproval(null);
      message.success(decision === 'approve' ? 'Approved, the workflow continues' : 'Rejected, the agents rework it');
    } catch (error) {
      message.error(approvalErrorMessage(error));
    } finally {
      setSubmitting(false);
      queryClient.invalidateQueries({ queryKey: approvalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  }, [queryClient, message]);
  const handleApprove = useCallback((approvalId: string, comment?: string) => respond(approvalId, 'approve', comment), [respond]);
  const handleReject = useCallback((approvalId: string, comment?: string) => respond(approvalId, 'reject', comment), [respond]);

  const handleOpenApproval = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setModalOpen(true);
  };

  const popoverContent = (
    <div style={{ width: 360, maxHeight: 360, overflowY: 'auto', margin: `0 -${token.paddingXS}px` }}>
      {pendingApprovals.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending approvals" />
      ) : (
        <Flex vertical gap={2}>
          {pendingApprovals.map(approval => (
            <Flex
              key={approval.approvalId}
              gap={token.marginSM}
              align="start"
              role="button"
              tabIndex={0}
              onClick={() => handleOpenApproval(approval)}
              onKeyDown={e => e.key === 'Enter' && handleOpenApproval(approval)}
              className="approval-row"
              style={{ padding: `${token.paddingXS}px ${token.paddingSM}px`, borderRadius: token.borderRadius, cursor: 'pointer' }}
            >
              <Avatar size={32} icon={<ExclamationCircleOutlined />} style={{ background: token.colorWarningBg, color: token.colorWarning, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Flex gap={token.marginXS} align="center">
                  <Tag color="warning" style={{ margin: 0 }}>
                    {APPROVAL_TYPE_LABELS[approval.approvalType] ?? approval.approvalType}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                    {approval.requestedAt.toLocaleTimeString()}
                  </Text>
                </Flex>
                <Text ellipsis style={{ display: 'block', marginTop: 2 }}>
                  {approval.projectName ? `${approval.projectName}: ` : ''}
                  {approvalSummary(approval.requestData).message}
                </Text>
              </div>
            </Flex>
          ))}
        </Flex>
      )}
    </div>
  );

  return (
    <>
      <Popover
        title={`Pending approvals (${pendingApprovals.length})`}
        content={popoverContent}
        trigger="click"
        placement="bottomRight"
        arrow={false}
      >
        <Tooltip title="Approvals" placement="bottom">
          <Badge count={pendingApprovals.length} size="small" offset={[-4, 4]}>
            <Button
              type="text"
              shape="circle"
              aria-label="Pending approvals"
              icon={pendingApprovals.length > 0 ? <BellFilled style={{ color: token.colorWarning }} /> : <BellOutlined />}
            />
          </Badge>
        </Tooltip>
      </Popover>

      <ApprovalModal
        approval={selectedApproval}
        open={modalOpen}
        submitting={submitting}
        onClose={() => {
          setModalOpen(false);
          setSelectedApproval(null);
        }}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </>
  );
};
