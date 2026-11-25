import React, { useState, useCallback } from 'react';
import { Alert, App, Badge, Card, Empty, Flex, Typography, theme } from 'antd';
import { Task, TaskStatus } from '@ai-corp/shared-types';
import { useUpdateTask } from '../../lib/api/hooks/tasks';
import { TaskCard } from './TaskCard';
import { apiErrorMessage } from '../../lib/api/errors';

const { Text } = Typography;

const COLUMNS: { key: TaskStatus; title: string; status: 'default' | 'processing' | 'warning' | 'success' }[] = [
  { key: TaskStatus.TODO, title: 'Todo', status: 'default' },
  { key: TaskStatus.IN_PROGRESS, title: 'In Progress', status: 'processing' },
  { key: TaskStatus.REVIEW, title: 'Review', status: 'warning' },
  { key: TaskStatus.DONE, title: 'Done', status: 'success' },
];

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.TODO, TaskStatus.REVIEW],
  [TaskStatus.REVIEW]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE],
  [TaskStatus.DONE]: [TaskStatus.REVIEW],
};

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  /** Why tasks can't be moved by hand right now (e.g. the agents are working on them) */
  lockedReason?: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onTaskClick, lockedReason }) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);
  const updateTask = useUpdateTask();
  const { message } = App.useApp();
  const { token } = theme.useToken();

  const handleDragStart = useCallback((taskId: string) => {
    setDraggedTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: TaskStatus) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (!taskId) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === targetStatus) {
        setDraggedTaskId(null);
        setDropTarget(null);
        return;
      }

      if (lockedReason) {
        message.warning(lockedReason);
        setDraggedTaskId(null);
        setDropTarget(null);
        return;
      }

      const allowed = VALID_TRANSITIONS[task.status];
      if (!allowed.includes(targetStatus)) {
        message.info(`A task can't move from ${task.status} to ${targetStatus}`);
        setDraggedTaskId(null);
        setDropTarget(null);
        return;
      }

      try {
        await updateTask.mutateAsync({ id: taskId, status: targetStatus });
      } catch (error) {
        message.error(apiErrorMessage(error, 'Could not move the task'));
      }

      setDraggedTaskId(null);
      setDropTarget(null);
    },
    [tasks, updateTask, lockedReason, message]
  );

  return (
    <>
      {lockedReason && <Alert type="info" showIcon title={lockedReason} style={{ marginBottom: token.marginSM }} />}
      <Flex gap={token.marginSM} style={{ overflowX: 'auto', paddingBottom: token.padding }}>
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.key);
          const isDropTarget = dropTarget === col.key;

          return (
            <Card
              key={col.key}
              size="small"
              onDragOver={(e) => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.key)}
              title={<Badge status={col.status} text={<Text strong>{col.title}</Text>} />}
              extra={<Badge count={columnTasks.length} showZero color={token.colorFillSecondary} style={{ color: token.colorTextSecondary }} />}
              style={{
                flex: '1 1 0',
                minWidth: 260,
                maxWidth: 340,
                background: isDropTarget ? token.colorPrimaryBg : token.colorFillQuaternary,
                borderColor: isDropTarget ? token.colorPrimary : undefined,
                borderStyle: isDropTarget ? 'dashed' : undefined,
                transition: 'all 0.15s ease',
              }}
              styles={{ body: { padding: token.paddingXS } }}
            >
              {columnTasks.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isDropTarget ? 'Drop here' : 'No tasks'} style={{ margin: `${token.marginLG}px 0` }} />
              ) : (
                <Flex vertical gap={token.marginXS}>
                  {columnTasks.map((task) => (
                    <div key={task.id} onDragEnd={handleDragEnd} style={{ opacity: draggedTaskId === task.id ? 0.4 : 1 }}>
                      <TaskCard task={task} onDragStart={handleDragStart} onClick={onTaskClick} />
                    </div>
                  ))}
                </Flex>
              )}
            </Card>
          );
        })}
      </Flex>
    </>
  );
};
