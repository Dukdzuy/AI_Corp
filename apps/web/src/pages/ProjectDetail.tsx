import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { App, Avatar, Typography, Space, Card, Button, Skeleton, Tabs, Empty, Tag, Collapse, Alert, InputNumber, Modal, Popconfirm, Result, Row, Col, Statistic, Progress, Descriptions, Flex, Timeline, Tooltip, Badge, theme } from 'antd';
import {
  AppstoreOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  DollarOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FlagOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ProjectOutlined,
  RocketOutlined,
  StopOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Permission, Task, WebSocketEventType, TaskUpdatedEvent, ApprovalRequiredEvent, ProjectStatus } from '@ai-corp/shared-types';
import { projectKeys, useProject, useStartProjectWorkflow, useUpdateProject } from '../lib/api/hooks/projects';
import { apiErrorMessage } from '../lib/api/errors';
import { approvalSummary } from '../lib/approvalSummary';
import { hasPermission } from '../lib/permissions';
import { useAuthStore } from '../stores/authStore';
import { ApprovalModal } from '../components/approvals/ApprovalModal';
import type { PendingApproval } from '../components/approvals/ApprovalNotification';
import { useTasks, taskKeys } from '../lib/api/hooks/tasks';
import { useMilestones } from '../lib/api/hooks/milestones';
import { usePendingApprovals, approvalKeys, respondToApproval, approvalErrorMessage, toPendingApproval } from '../lib/api/hooks/approvals';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailModal } from '../components/kanban/TaskDetailModal';
import socketClient from '../lib/websocket/socket-client';
import { useQueryClient } from '@tanstack/react-query';
import { ArtifactsTab } from '../components/artifacts/ArtifactsTab';
import { useQualityEvents } from '../components/artifacts/useQualityEvents';
import { WorkflowRunView } from '../components/workflow/WorkflowRunView';
import { ReportsTab } from '../components/reports/ReportsTab';
import { PageHeader } from '../components/common/PageHeader';
import { statusColor } from '../theme/palette';

const { Text, Paragraph } = Typography;

const STATUS_ICONS: Record<string, React.ReactNode> = {
  completed: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
  running: <SyncOutlined spin />,
  pending: <ClockCircleOutlined />,
  paused: <PauseCircleOutlined />,
};

/** Pretty-printed text of a context value (strings stay as they are) */
function asText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id ?? null);
  const { data: tasks = [], isLoading: tasksLoading } = useTasks(id ?? null);
  const { data: milestones = [] } = useMilestones(id ?? null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { data: apiApprovals = [] } = usePendingApprovals(id ?? undefined);
  const [wsApprovals, setWsApprovals] = useState<ApprovalRequiredEvent[]>([]);
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { gates: liveGates, warnings: liveWarnings } = useQualityEvents(id);

  // Merge REST API approvals + WebSocket approvals, dedupe by approvalId
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const pendingApprovals: PendingApproval[] = [...apiApprovals.map(toPendingApproval), ...wsApprovals].filter((a, i, arr) =>
    arr.findIndex((b) => b.approvalId === a.approvalId) === i && !answered.has(a.approvalId)
  );
  const [reviewing, setReviewing] = useState<PendingApproval | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [newBudget, setNewBudget] = useState<number | null>(null);
  const updateProject = useUpdateProject();
  const startWorkflow = useStartProjectWorkflow();
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (!id) return;

    // Joins the project's room (again after a reconnect) so its live events reach this page
    socketClient.subscribeProject(id);

    const unsubTaskUpdated = socketClient.on<TaskUpdatedEvent>(
      WebSocketEventType.TASK_UPDATED,
      (data) => {
        if (data.projectId === id) {
          queryClient.invalidateQueries({ queryKey: taskKeys.list(id) });
        }
      }
    );

    const unsubApproval = socketClient.on<ApprovalRequiredEvent>(
      WebSocketEventType.HUMAN_APPROVAL_REQUIRED,
      (data) => {
        if (data.projectId === id) {
          setWsApprovals((prev) => [
            ...prev.filter((a) => a.approvalId !== data.approvalId),
            data,
          ]);
        }
      }
    );

    // A run moved (node done, paused, finished): refresh the project, its runs and approvals
    const unsubWorkflow = socketClient.on<{ projectId?: string }>(
      WebSocketEventType.WORKFLOW_STATE_CHANGED,
      (data) => {
        if (data?.projectId === id) {
          queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
          queryClient.invalidateQueries({ queryKey: approvalKeys.pending(id) });
        }
      }
    );

    // Budget warnings and other project notices
    const unsubNotice = socketClient.on<{ message?: string; level?: string; severity?: string }>(
      WebSocketEventType.SYSTEM_NOTIFICATION,
      (data) => {
        if (!data?.message) return;
        const level = data.level || data.severity;
        if (level === 'critical' || level === 'error') message.error(data.message, 8);
        else message.warning(data.message, 6);
        queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      }
    );

    return () => {
      unsubTaskUpdated();
      unsubApproval();
      unsubWorkflow();
      unsubNotice();
      socketClient.unsubscribeProject(id);
    };
  }, [id, queryClient, message]);

  const respond = useCallback(async (approvalId: string, decision: 'approve' | 'reject', comment?: string) => {
    setSubmitting(true);
    try {
      await respondToApproval(approvalId, decision, comment);
      setWsApprovals((prev) => prev.filter((a) => a.approvalId !== approvalId));
      setAnswered((prev) => new Set(prev).add(approvalId));
      setReviewing(null);
      message.success(decision === 'approve' ? 'Approved, the workflow continues' : 'Rejected, the agents rework it with your feedback');
    } catch (error) {
      message.error(approvalErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
    queryClient.invalidateQueries({ queryKey: approvalKeys.all });
    if (id) queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
  }, [id, queryClient, message]);
  const handleApprove = useCallback((approvalId: string, comment?: string) => respond(approvalId, 'approve', comment), [respond]);
  const handleReject = useCallback((approvalId: string, comment?: string) => respond(approvalId, 'reject', comment), [respond]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  if (projectLoading) {
    return (
      <Card style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Skeleton active avatar paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (!project) {
    return (
      <Result
        status="404"
        title="Project not found"
        subTitle="It may have been deleted, or you do not have access to it."
        extra={<Button type="primary" onClick={() => navigate('/')}>Back to Dashboard</Button>}
      />
    );
  }

  const workflowRuns = (project as any).workflowRuns || [];
  const latestRun = workflowRuns[0];
  // Same rule as the API: the owner of the project or an admin may control it
  const canControl = hasPermission(user, Permission.WORKFLOW_CONTROL)
    && (user?.role === 'admin' || (project as any).createdById === user?.id);
  const canEdit = hasPermission(user, Permission.PROJECT_UPDATE)
    && (user?.role === 'admin' || (project as any).createdById === user?.id);
  const budget = project.budget != null ? Number(project.budget) : null;
  const cost = Number(project.costAccrued ?? 0);
  const overBudget = budget !== null && cost >= budget;
  const workflowStopped = !latestRun || latestRun.status === 'failed' || latestRun.status === 'cancelled';

  const changeStatus = async (status: ProjectStatus, done: string) => {
    try {
      await updateProject.mutateAsync({ id: project.id, status });
      message.success(done);
    } catch (error) {
      message.error(apiErrorMessage(error, 'Could not change the project status'));
    }
  };
  const doStartWorkflow = async () => {
    try {
      const result = await startWorkflow.mutateAsync(project.id);
      if (result.workflowStarted) message.success('Workflow started');
      else message.error(`The workflow did not start: ${result.workflowError || 'unknown error'}`);
    } catch (error) {
      message.error(apiErrorMessage(error, 'Could not start the workflow'));
    }
  };
  const raiseBudget = async () => {
    if (newBudget === null) return;
    try {
      // Raising the budget of a project the budget paused also resumes it
      await updateProject.mutateAsync({
        id: project.id,
        budget: newBudget,
        ...(project.status === ProjectStatus.PAUSED && newBudget > cost ? { status: ProjectStatus.ACTIVE } : {}),
      } as any);
      message.success('Budget updated');
      setBudgetOpen(false);
    } catch (error) {
      message.error(apiErrorMessage(error, 'Could not update the budget'));
    }
  };
  const completedRun = workflowRuns.find((r: any) => r.status === 'completed');
  const latestContext = completedRun?.context?.variables || {};

  const downloadCode = () => {
    const blob = new Blob([asText(latestContext.code)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // The block holds the code of every file together, so it is not named after one of them
    a.download = `${project.name.replace(/[^\w-]+/g, '-')}-code.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const codeBlock = (text: string, maxHeight = 400) => (
    <Typography.Paragraph
      copyable={{ text }}
      style={{
        margin: 0,
        position: 'relative',
      }}
    >
      <pre
        style={{
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: token.paddingSM,
          fontSize: token.fontSizeSM,
          fontFamily: token.fontFamilyCode,
          overflow: 'auto',
          maxHeight,
          margin: 0,
        }}
      >
        {text}
      </pre>
    </Typography.Paragraph>
  );

  const summaryItems = [
    latestContext.productName && { key: 'name', label: 'Product name', children: latestContext.productName },
    latestContext.approvalDecision && { key: 'decision', label: 'Approval decision', children: latestContext.approvalDecision },
    latestContext.productDescription && { key: 'desc', label: 'Product description', span: 'filled' as const, children: latestContext.productDescription },
    latestContext.marketingAnnouncement && {
      key: 'marketing',
      label: 'Marketing announcement',
      span: 'filled' as const,
      children: <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{latestContext.marketingAnnouncement}</Paragraph>,
    },
  ].filter(Boolean) as any[];

  const tabItems = [
    {
      key: 'output',
      icon: <RocketOutlined />,
      label: 'Project Output',
      children: (
        <div>
          {!completedRun ? (
            <Empty description="No completed workflow yet. Output will appear here after the project finishes." />
          ) : (
            <Space orientation="vertical" size={token.margin} style={{ width: '100%' }}>
              <Alert
                title="Project Completed"
                description={`Workflow run completed at ${new Date(completedRun.completedAt).toLocaleString()}`}
                type="success"
                showIcon
              />

              {summaryItems.length > 0 && (
                <Card size="small" title="Summary">
                  <Descriptions column={{ xs: 1, md: 2 }} items={summaryItems} />
                </Card>
              )}

              {latestContext.output && (
                <Card size="small" title="Agent Output">
                  {codeBlock(asText(latestContext.output), 300)}
                </Card>
              )}

              {latestContext.filesWritten && Array.isArray(latestContext.filesWritten) && latestContext.filesWritten.length > 0 && (
                <Card
                  size="small"
                  title={<Space><FolderOpenOutlined style={{ color: token.colorSuccess }} />Files Written ({latestContext.filesWritten.length})</Space>}
                  extra={<Button size="small" type="link" icon={<CodeOutlined />} onClick={() => setActiveTab('artifacts')}>Open in Artifacts</Button>}
                >
                  <Flex wrap gap={token.marginXS}>
                    {latestContext.filesWritten.map((filePath: string, idx: number) => (
                      <Tag key={idx} icon={<FileTextOutlined />} style={{ fontFamily: token.fontFamilyCode, cursor: 'pointer' }} onClick={() => setActiveTab('artifacts')}>
                        {filePath}
                      </Tag>
                    ))}
                  </Flex>
                </Card>
              )}

              {latestContext.code && (
                <Card
                  size="small"
                  title={<Space><CodeOutlined style={{ color: token.colorWarning }} />Source Code</Space>}
                  extra={<Button size="small" icon={<DownloadOutlined />} onClick={downloadCode}>Download</Button>}
                >
                  {codeBlock(asText(latestContext.code))}
                </Card>
              )}

              <Collapse
                size="small"
                items={[{ key: 'ctx', label: 'Full Workflow Context', children: codeBlock(JSON.stringify(latestContext, null, 2)) }]}
              />
            </Space>
          )}
        </div>
      ),
    },
    {
      key: 'artifacts',
      icon: <FolderOpenOutlined />,
      label: 'Artifacts',
      children: <ArtifactsTab projectId={project.id} projectName={project.name} liveGates={liveGates} liveWarnings={liveWarnings} />,
    },
    {
      key: 'reports',
      icon: <BarChartOutlined />,
      label: 'Reports',
      children: <ReportsTab projectId={project.id} />,
    },
    {
      key: 'kanban',
      icon: <AppstoreOutlined />,
      label: 'Kanban Board',
      children: tasksLoading ? (
        <Skeleton active />
      ) : (
        <KanbanBoard
          tasks={tasks}
          onTaskClick={handleTaskClick}
          lockedReason={latestRun?.status === 'running' ? 'The agents are working on these tasks: pause the workflow to move tasks by hand.' : undefined}
        />
      ),
    },
    {
      key: 'milestones',
      icon: <FlagOutlined />,
      label: <Badge count={milestones.length} size="small" offset={[10, 0]} color={token.colorPrimary}>Milestones</Badge>,
      children: milestones.length === 0 ? (
        <Empty description="No milestones yet." />
      ) : (
        <Card>
          <Timeline
            items={milestones.map((m: any) => ({
              key: m.id,
              color: m.status === 'completed' ? 'green' : m.status === 'in_progress' ? 'blue' : 'gray',
              icon: m.status === 'completed' ? <CheckCircleOutlined /> : m.status === 'in_progress' ? <SyncOutlined spin /> : undefined,
              title: (
                <Space wrap>
                  <Text strong>{m.name}</Text>
                  {m.status && <Tag color={statusColor(m.status)}>{String(m.status).replace('_', ' ')}</Tag>}
                  {m.dueDate && <Text type="secondary">due {new Date(m.dueDate).toLocaleDateString()}</Text>}
                </Space>
              ),
              content: m.description ? <Text type="secondary">{m.description}</Text> : undefined,
            }))}
          />
        </Card>
      ),
    },
    {
      key: 'workflow',
      icon: <ApartmentOutlined />,
      label: <Badge count={workflowRuns.length} size="small" offset={[10, 0]} color={token.colorPrimary}>Workflow Runs</Badge>,
      children: workflowRuns.length === 0 ? (
        <Empty description="No workflow runs yet." />
      ) : (
        <Collapse
          destroyOnHidden
          defaultActiveKey={workflowRuns[0]?.status === 'running' ? [workflowRuns[0].id] : undefined}
          items={workflowRuns.map((run: any) => ({
            key: run.id,
            label: (
              <Space wrap>
                <Text strong>Run {run.id.slice(0, 8)}</Text>
                <Tag color={statusColor(run.status)} icon={STATUS_ICONS[run.status]}>{run.status}</Tag>
                <Tag color="purple" variant="outlined">{run.workflowDefId}@{run.workflowDefVersion || 'latest'}</Tag>
              </Space>
            ),
            extra: (
              <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
                {new Date(run.startedAt).toLocaleString()}
                {run.completedAt && ` · ${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`}
              </Text>
            ),
            children: <WorkflowRunView runId={run.id} projectId={project.id} />,
          }))}
        />
      ),
    },
  ];

  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const budgetPercent = budget ? Math.round((cost / budget) * 100) : null;

  const actions = (canControl || canEdit) && (
    <>
      {canEdit && project.status === ProjectStatus.ACTIVE && (
        <Button icon={<PauseCircleOutlined />} loading={updateProject.isPending} onClick={() => changeStatus(ProjectStatus.PAUSED, 'Project and workflow paused')}>
          Pause
        </Button>
      )}
      {canEdit && project.status === ProjectStatus.PAUSED && (
        <Tooltip title={overBudget ? 'Raise the budget first' : undefined}>
          <Button icon={<PlayCircleOutlined />} loading={updateProject.isPending} disabled={overBudget} onClick={() => changeStatus(ProjectStatus.ACTIVE, 'Project and workflow resumed')}>
            Resume
          </Button>
        </Tooltip>
      )}
      {canControl && project.status === ProjectStatus.ACTIVE && workflowStopped && (
        <Button type="primary" icon={<RocketOutlined />} loading={startWorkflow.isPending} onClick={doStartWorkflow}>
          {latestRun ? 'Run workflow again' : 'Start workflow'}
        </Button>
      )}
      {canEdit && (project.status === ProjectStatus.ACTIVE || project.status === ProjectStatus.PAUSED) && (
        <Button icon={<DollarOutlined />} onClick={() => { setNewBudget(budget); setBudgetOpen(true); }}>
          {budget === null ? 'Set budget' : 'Change budget'}
        </Button>
      )}
      {canEdit && (project.status === ProjectStatus.ACTIVE || project.status === ProjectStatus.PAUSED) && (
        <Popconfirm
          title="Cancel this project?"
          description="The workflow stops and pending approvals are cancelled. This cannot be undone."
          okText="Cancel project"
          okButtonProps={{ danger: true }}
          cancelText="Keep it"
          onConfirm={() => changeStatus(ProjectStatus.CANCELLED, 'Project cancelled')}
        >
          <Button danger icon={<StopOutlined />}>Cancel project</Button>
        </Popconfirm>
      )}
    </>
  );

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        breadcrumb={[
          { title: <a onClick={() => navigate('/')}><HomeOutlined /> Dashboard</a> },
          { title: <><ProjectOutlined /> {project.name}</> },
        ]}
        avatar={
          <Avatar
            shape="square"
            size={52}
            icon={project.status === 'completed' ? <CheckCircleOutlined /> : <RocketOutlined />}
            style={{
              background: project.status === 'completed' ? token.colorSuccessBg : token.colorPrimaryBg,
              color: project.status === 'completed' ? token.colorSuccess : token.colorPrimary,
              borderRadius: token.borderRadiusLG,
            }}
          />
        }
        title={project.name}
        tags={
          <>
            <Tag color={statusColor(project.status)}>{project.status}</Tag>
            {latestRun && latestRun.status !== project.status && (
              <Tag color={statusColor(latestRun.status)} icon={STATUS_ICONS[latestRun.status]}>workflow {latestRun.status}</Tag>
            )}
          </>
        }
        subTitle={project.description}
        extra={actions}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: token.margin }}>
        <Col xs={24} lg={12}>
          <Card size="small" style={{ height: '100%' }}>
            <Flex gap={token.marginXS} align="start">
              <ThunderboltOutlined style={{ color: token.colorWarning, marginTop: 4 }} />
              <div>
                <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Goal</Text>
                <Paragraph ellipsis={{ rows: 3, expandable: 'collapsible' }} style={{ margin: 0 }}>
                  {project.goal || '—'}
                </Paragraph>
              </div>
            </Flex>
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="Cost" value={cost} precision={2} prefix="$" styles={{ content: { color: overBudget ? token.colorError : undefined } }} />
            {budgetPercent !== null && (
              <Tooltip title={`${budgetPercent}% of $${budget!.toFixed(2)}`}>
                <Progress percent={Math.min(100, budgetPercent)} size="small" status={overBudget ? 'exception' : 'normal'} showInfo={false} />
              </Tooltip>
            )}
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="Tasks done" value={doneTasks} suffix={`/ ${tasks.length}`} />
            <Progress percent={tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0} size="small" showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} lg={4}>
          <Card size="small" style={{ height: '100%' }}>
            <Statistic title="Budget" value={budget ?? '—'} precision={budget !== null ? 2 : undefined} prefix={budget !== null ? '$' : undefined} />
            <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>Created {new Date(project.createdAt as any).toLocaleDateString()}</Text>
          </Card>
        </Col>
      </Row>

      {overBudget && project.status !== ProjectStatus.COMPLETED && project.status !== ProjectStatus.CANCELLED && (
        <Alert
          type="error"
          showIcon
          title={`Budget used up: $${cost.toFixed(2)} of $${budget!.toFixed(2)}`}
          description="The workflow is paused and will not start another step until the budget is raised."
          action={canEdit ? <Button size="small" onClick={() => { setNewBudget(Math.ceil(cost * 1.5)); setBudgetOpen(true); }}>Raise budget</Button> : undefined}
          style={{ marginBottom: token.margin }}
        />
      )}

      {project.status === ProjectStatus.ACTIVE && !latestRun && (
        <Alert
          type="warning"
          showIcon
          title="The workflow of this project has not started"
          description={canControl ? 'Start it with the button above.' : 'Ask the project owner to start it.'}
          style={{ marginBottom: token.margin }}
        />
      )}

      <Modal
        title="Project budget"
        open={budgetOpen}
        onCancel={() => setBudgetOpen(false)}
        onOk={raiseBudget}
        okText="Save"
        confirmLoading={updateProject.isPending}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: token.marginXS }}>
          Spent so far: ${cost.toFixed(2)}{project.status === ProjectStatus.PAUSED ? '. A budget above that resumes the workflow.' : ''}
        </Text>
        <InputNumber prefix="$" min={1} precision={2} value={newBudget ?? undefined} onChange={v => setNewBudget(typeof v === 'number' ? v : null)} style={{ width: '100%' }} />
      </Modal>

      <ApprovalModal
        approval={reviewing}
        open={!!reviewing}
        submitting={submitting}
        onClose={() => setReviewing(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {pendingApprovals.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          title={`${pendingApprovals.length} approval(s) pending`}
          description={
            <Flex vertical gap={token.marginXS} style={{ marginTop: token.marginXS }}>
              {pendingApprovals.map((a) => (
                <Card key={a.approvalId} size="small">
                  <Flex justify="space-between" align="center" gap={token.margin} wrap>
                    <div style={{ minWidth: 0 }}>
                      <Tag color="warning">{a.approvalType}</Tag>
                      <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>needs human sign-off</Text>
                      <Paragraph style={{ margin: `${token.marginXXS}px 0 0` }}>{approvalSummary(a.requestData).message}</Paragraph>
                    </div>
                    <Button type="primary" icon={<FileTextOutlined />} onClick={() => setReviewing(a)}>
                      Review and decide
                    </Button>
                  </Flex>
                </Card>
              ))}
            </Flex>
          }
          style={{ marginBottom: token.margin }}
        />
      )}

      <Tabs
        items={tabItems}
        activeKey={activeTab ?? (project.status === 'completed' ? 'output' : latestRun ? 'workflow' : 'kanban')}
        onChange={setActiveTab}
      />

      <TaskDetailModal
        task={selectedTask}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedTask(null);
        }}
      />
    </div>
  );
};
