import React from 'react';
import { Modal, Typography, Space, Tag, Button, Input, Descriptions, Collapse, Form, theme } from 'antd';
import { Permission } from '@ai-corp/shared-types';
import { usePermission } from '../../lib/permissions';
import { approvalSummary } from '../../lib/approvalSummary';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { PendingApproval } from './ApprovalNotification';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const APPROVAL_TYPE_LABELS: Record<string, { color: string; label: string }> = {
  code_merge: { color: 'blue', label: 'Code Merge' },
  marketing_post: { color: 'purple', label: 'Marketing Post' },
  milestone_complete: { color: 'green', label: 'Milestone Complete' },
  project_completion: { color: 'green', label: 'Project Completion' },
  general: { color: 'orange', label: 'General Approval' },
};

interface ApprovalModalProps {
  approval: PendingApproval | null;
  open: boolean;
  /** An answer is being sent: both buttons wait, so a double click sends one answer */
  submitting?: boolean;
  onClose: () => void;
  onApprove: (approvalId: string, comment?: string) => void;
  onReject: (approvalId: string, comment?: string) => void;
}

/**
 * An approval with what it is about: the node's message, the QA / QC verdicts, the files written
 * and the latest agent output. Rejecting asks for a reason, which the agents that rework get.
 */
export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  approval,
  open,
  submitting = false,
  onClose,
  onApprove,
  onReject,
}) => {
  const canAnswer = usePermission(Permission.APPROVAL_GRANT);
  const { token } = theme.useToken();
  const [comment, setComment] = React.useState('');
  const [rejecting, setRejecting] = React.useState(false);

  React.useEffect(() => {
    setComment('');
    setRejecting(false);
  }, [approval?.approvalId]);

  if (!approval) return null;

  const typeCfg = APPROVAL_TYPE_LABELS[approval.approvalType] ?? { color: 'default', label: approval.approvalType };
  const summary = approvalSummary(approval.requestData);
  const reason = comment.trim();

  const handleApprove = () => onApprove(approval.approvalId, reason || undefined);
  const handleReject = () => {
    if (!rejecting) {
      setRejecting(true);
      return;
    }
    if (reason) onReject(approval.approvalId, reason);
  };

  const codeBox: React.CSSProperties = {
    background: token.colorFillQuaternary,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadius,
    padding: `${token.paddingXS}px ${token.paddingSM}px`,
    maxHeight: 200,
    overflowY: 'auto',
    fontFamily: token.fontFamilyCode,
    fontSize: token.fontSizeSM,
    margin: 0,
    whiteSpace: 'pre-wrap',
  };

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: token.colorWarning }} />
          Approval Required
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={!canAnswer ? <Text type="secondary">Your role cannot answer approvals</Text> :
        <Space>
          <Button
            icon={<CloseCircleOutlined />}
            onClick={handleReject}
            danger
            loading={submitting && rejecting}
            disabled={(submitting && !rejecting) || (rejecting && !reason)}
          >
            {rejecting ? 'Send rejection' : 'Reject'}
          </Button>
          <Button
            color="green"
            variant="solid"
            icon={<CheckCircleOutlined />}
            onClick={handleApprove}
            loading={submitting && !rejecting}
            disabled={submitting && rejecting}
          >
            Approve
          </Button>
        </Space>
      }
      width={640}
    >
      <Paragraph style={{ marginTop: token.marginSM }}>{summary.message}</Paragraph>

      <Descriptions
        column={1}
        size="small"
        bordered
        items={[
          { key: 'type', label: 'Type', children: <Tag color={typeCfg.color}>{typeCfg.label}</Tag> },
          ...(approval.projectName ? [{ key: 'project', label: 'Project', children: approval.projectName }] : []),
          ...summary.facts.map(fact => ({
            key: fact.label,
            label: fact.label,
            children: <Text type={fact.tone === 'good' ? 'success' : fact.tone === 'bad' ? 'danger' : undefined}>{fact.value}</Text>,
          })),
          { key: 'at', label: 'Requested at', children: approval.requestedAt.toLocaleString() },
        ]}
      />

      {summary.excerpt && (
        <div style={{ marginTop: token.marginSM }}>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block', marginBottom: 4 }}>Latest agent output</Text>
          <pre style={codeBox}>{summary.excerpt}</pre>
        </div>
      )}

      <Collapse
        ghost
        size="small"
        style={{ marginTop: token.marginXS }}
        items={[{
          key: 'raw',
          label: <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Raw request data</Text>,
          children: <pre style={codeBox}>{JSON.stringify(approval.requestData, null, 2)}</pre>,
        }]}
      />

      {canAnswer && (
        <Form layout="vertical" style={{ marginTop: token.marginSM }}>
          <Form.Item
            label={rejecting ? 'What should change? (required, the agents rework with it)' : 'Comment (optional)'}
            validateStatus={rejecting && !reason ? 'error' : undefined}
            style={{ marginBottom: token.marginLG }}
          >
            <TextArea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={rejecting ? 'e.g. Add input validation to the order form and a test for it' : 'Add a comment for your decision...'}
              autoFocus={rejecting}
              showCount
              maxLength={2000}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};
