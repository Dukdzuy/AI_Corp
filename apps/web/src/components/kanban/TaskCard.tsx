import React from 'react';
import { Card, Flex, Tag, Tooltip, Typography, theme } from 'antd';
import { RobotOutlined, DollarOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { Task, TaskPriority } from '@ai-corp/shared-types';
import { roleColor as roleTagColor } from '../../theme/palette';

const { Text } = Typography;

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; icon: React.ReactNode; label: string }> = {
  [TaskPriority.HIGH]: { color: 'red', icon: <ArrowUpOutlined />, label: 'High' },
  [TaskPriority.MEDIUM]: { color: 'gold', icon: <MinusOutlined />, label: 'Medium' },
  [TaskPriority.LOW]: { color: 'green', icon: <ArrowDownOutlined />, label: 'Low' },
};

interface TaskCardProps {
  task: Task;
  onDragStart: (taskId: string) => void;
  onClick?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onDragStart, onClick }) => {
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG[TaskPriority.MEDIUM];
  const roleColor = task.assignedAgent ? roleTagColor(task.assignedAgent) : undefined;
  const { token } = theme.useToken();
  const actualCost = Number(task.actualCost ?? 0);
  const estimatedCost = task.estimatedCost != null ? Number(task.estimatedCost) : null;
  const costExceeded = estimatedCost != null && actualCost > estimatedCost;

  return (
    <Card
      size="small"
      hoverable
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(task.id);
      }}
      onClick={() => onClick?.(task)}
      style={{ cursor: 'grab' }}
      styles={{ body: { padding: `${token.paddingXS}px ${token.paddingSM}px` } }}
    >
      <Flex vertical gap={6}>
        <Flex justify="space-between" align="start" gap={token.marginXS}>
          <Text strong style={{ fontSize: token.fontSize, lineHeight: 1.4, flex: 1 }}>
            {task.title}
          </Text>
          <Tooltip title={`${priority.label} priority`}>
            <Tag color={priority.color} icon={priority.icon} style={{ margin: 0, paddingInline: 4 }} />
          </Tooltip>
        </Flex>

        {task.description && (
          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ fontSize: token.fontSizeSM, margin: 0 }}>
            {task.description}
          </Typography.Paragraph>
        )}

        <Flex justify="space-between" align="center" gap={4}>
          {task.assignedAgent ? (
            <Tooltip title={`Assigned to ${task.assignedAgent}`}>
              <Tag icon={<RobotOutlined />} color={roleColor} style={{ margin: 0 }}>
                {task.assignedAgent}
              </Tag>
            </Tooltip>
          ) : (
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Unassigned</Text>
          )}

          {(estimatedCost != null || actualCost > 0) && (
            <Tooltip
              title={
                estimatedCost != null
                  ? `Estimated: $${estimatedCost.toFixed(2)} | Actual: $${actualCost.toFixed(2)}`
                  : `Actual: $${actualCost.toFixed(2)}`
              }
            >
              <Tag color={costExceeded ? 'error' : 'success'} icon={<DollarOutlined />} style={{ margin: 0 }}>
                {estimatedCost != null && (
                  <Text type="secondary" delete style={{ fontSize: 10, marginInlineEnd: 4 }}>
                    {estimatedCost.toFixed(2)}
                  </Text>
                )}
                <Text strong style={{ fontSize: token.fontSizeSM, color: 'inherit' }}>{actualCost.toFixed(2)}</Text>
              </Tag>
            </Tooltip>
          )}
        </Flex>
      </Flex>
    </Card>
  );
};
