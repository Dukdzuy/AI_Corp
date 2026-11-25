import React from 'react';
import { App, Modal, Typography, Space, Tag, Descriptions, Button, Statistic, Row, Col, theme } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  RobotOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { Task, TaskStatus, TaskPriority, AgentRole } from '@ai-corp/shared-types';
import { useUpdateTask } from '../../lib/api/hooks/tasks';
import { roleColor } from '../../theme/palette';

const { Text, Paragraph } = Typography;

const STATUS_CONFIG: Record<TaskStatus, { color: string; label: string }> = {
  [TaskStatus.TODO]: { color: 'default', label: 'Todo' },
  [TaskStatus.IN_PROGRESS]: { color: 'processing', label: 'In Progress' },
  [TaskStatus.REVIEW]: { color: 'warning', label: 'Review' },
  [TaskStatus.DONE]: { color: 'success', label: 'Done' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; icon: React.ReactNode; label: string }> = {
  [TaskPriority.HIGH]: { color: 'red', icon: <ArrowUpOutlined />, label: 'High' },
  [TaskPriority.MEDIUM]: { color: 'gold', icon: <MinusOutlined />, label: 'Medium' },
  [TaskPriority.LOW]: { color: 'green', icon: <ArrowDownOutlined />, label: 'Low' },
};

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.TODO, TaskStatus.REVIEW],
  [TaskStatus.REVIEW]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
  [TaskStatus.DONE]: [TaskStatus.REVIEW],
};

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, open, onClose }) => {
  const updateTask = useUpdateTask();
  const { message } = App.useApp();
  const { token } = theme.useToken();

  if (!task) return null;

  const statusCfg = STATUS_CONFIG[task.status];
  const priorityCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[TaskPriority.MEDIUM];
  const allowedTransitions = VALID_TRANSITIONS[task.status] ?? [];
  const actualCost = Number(task.actualCost ?? 0);
  const estimatedCost = task.estimatedCost != null ? Number(task.estimatedCost) : null;
  const costExceeded = estimatedCost !== null && actualCost > estimatedCost;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await updateTask.mutateAsync({ id: task.id, status: newStatus });
      message.success(`Task moved to ${STATUS_CONFIG[newStatus].label}`);
    } catch {
      message.error('Failed to update task status');
    }
  };

  return (
    <Modal
      title={task.title}
      open={open}
      onCancel={onClose}
      footer={
        allowedTransitions.length > 0
          ? (
            <Space wrap>
              {allowedTransitions.map((status) => (
                <Button
                  key={status}
                  {...(status === TaskStatus.DONE ? { color: 'green' as const, variant: 'solid' as const } : {})}
                  onClick={() => handleStatusChange(status)}
                  loading={updateTask.isPending}
                >
                  Move to {STATUS_CONFIG[status].label}
                </Button>
              ))}
            </Space>
          )
          : null
      }
      width={600}
    >
      <Descriptions
        column={2}
        size="small"
        bordered
        style={{ marginTop: token.margin }}
        items={[
          { key: 'status', label: 'Status', children: <Tag color={statusCfg.color}>{statusCfg.label}</Tag> },
          { key: 'priority', label: 'Priority', children: <Tag color={priorityCfg.color} icon={priorityCfg.icon}>{priorityCfg.label}</Tag> },
          {
            key: 'agent',
            label: 'Assigned Agent',
            children: task.assignedAgent ? (
              <Tag icon={<RobotOutlined />} color={roleColor(task.assignedAgent)}>{task.assignedAgent}</Tag>
            ) : (
              <Text type="secondary">Unassigned</Text>
            ),
          },
          {
            key: 'id',
            label: 'Task ID',
            children: <Text code copyable={{ text: task.id }}>{task.id.slice(0, 8)}</Text>,
          },
          ...(task.description
            ? [{ key: 'desc', label: 'Description', span: 'filled' as const, children: <Paragraph style={{ margin: 0 }}>{task.description}</Paragraph> }]
            : []),
        ]}
      />

      <Row gutter={16} style={{ marginTop: token.margin }}>
        {estimatedCost !== null && (
          <Col span={12}>
            <Statistic title="Estimated Cost" value={estimatedCost} precision={2} prefix={<DollarOutlined />} />
          </Col>
        )}
        <Col span={12}>
          <Statistic
            title="Actual Cost"
            value={actualCost}
            precision={2}
            prefix={<DollarOutlined />}
            styles={{ content: costExceeded ? { color: token.colorError, fontWeight: 600 } : undefined }}
          />
        </Col>
      </Row>
    </Modal>
  );
};
