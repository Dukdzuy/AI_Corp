import React from 'react';
import { App, Avatar, Card, Flex, Progress, Select, Switch, Table, Tabs, Tag, Tooltip, Typography, theme } from 'antd';
import { CheckCircleFilled, MinusOutlined, SafetyOutlined, TeamOutlined } from '@ant-design/icons';
import { Permission } from '@ai-corp/shared-types';
import { ManagedUser, useChangeRole, useRoleMatrix, useSetUserActive, useUsers } from '../lib/api/hooks/users';
import { PERMISSION_LABELS, ROLE_LABELS } from '../lib/permissions';
import { useAuthStore } from '../stores/authStore';
import { PageHeader } from '../components/common/PageHeader';

const { Text } = Typography;

const errorText = (e: any) => e?.response?.data?.message || e?.message || 'Request failed';

/**
 * Users & roles (Phase 5, Task 20 — UC-008): assign a role, revoke access, and the
 * role × permission matrix the API enforces. Admin only.
 */
export const UsersPage: React.FC = () => {
  const me = useAuthStore(s => s.user);
  const { data: users = [], isLoading } = useUsers();
  const { data: matrix } = useRoleMatrix();
  const changeRole = useChangeRole();
  const setActive = useSetUserActive();
  const { message } = App.useApp();
  const { token } = theme.useToken();

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_: unknown, u: ManagedUser) => (
        <Flex gap={token.marginSM} align="center">
          <Avatar style={{ background: token.colorPrimary, opacity: u.isActive ? 1 : 0.4 }}>{u.name?.[0]?.toUpperCase()}</Avatar>
          <div>
            <Text strong>{u.name}{u.id === me?.id && <Tag color="blue" style={{ marginLeft: 8 }}>you</Tag>}</Text>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{u.email}</Text>
          </div>
        </Flex>
      ),
    },
    {
      title: 'Role',
      key: 'role',
      width: 200,
      render: (_: unknown, u: ManagedUser) => (
        <Select
          value={u.role}
          style={{ width: 170 }}
          disabled={u.id === me?.id}
          loading={changeRole.isPending && changeRole.variables?.id === u.id}
          options={Object.entries(ROLE_LABELS).map(([value, r]) => ({ value, label: r.label }))}
          onChange={role =>
            changeRole.mutate({ id: u.id, role }, {
              onSuccess: () => message.success(`${u.name} is now ${ROLE_LABELS[role]?.label ?? role}`),
              onError: e => message.error(errorText(e)),
            })
          }
        />
      ),
    },
    {
      title: 'Access',
      key: 'active',
      width: 120,
      render: (_: unknown, u: ManagedUser) => (
        <Tooltip title={u.isActive ? 'Revoking access also revokes the user\'s API keys' : 'Access revoked'}>
          <Switch
            checked={u.isActive}
            disabled={u.id === me?.id}
            checkedChildren="active"
            unCheckedChildren="revoked"
            onChange={isActive =>
              setActive.mutate({ id: u.id, isActive }, { onError: e => message.error(errorText(e)) })
            }
          />
        </Tooltip>
      ),
    },
    {
      title: 'Permissions',
      key: 'permissions',
      width: 180,
      render: (_: unknown, u: ManagedUser) => {
        const total = matrix?.permissions.length ?? 13;
        return (
          <Tooltip title={`${u.permissions.length} of ${total} permissions`}>
            <Progress percent={Math.round((u.permissions.length / total) * 100)} size="small" format={() => `${u.permissions.length}/${total}`} />
          </Tooltip>
        );
      },
    },
    { title: 'Joined', dataIndex: 'createdAt', key: 'createdAt', width: 130, render: (d: string) => new Date(d).toLocaleDateString() },
  ];

  const roles = matrix?.roles ?? [];
  const matrixRows = (matrix?.permissions ?? []).map(p => ({ key: p, permission: p }));
  const matrixColumns = [
    {
      title: 'Permission',
      dataIndex: 'permission',
      key: 'permission',
      render: (p: Permission) => (
        <Flex vertical>
          <Text>{PERMISSION_LABELS[p] ?? p}</Text>
          <Text type="secondary" code style={{ fontSize: 11, alignSelf: 'start' }}>{p}</Text>
        </Flex>
      ),
    },
    ...roles.map(r => ({
      title: <Tag color={ROLE_LABELS[r.role]?.color}>{ROLE_LABELS[r.role]?.label ?? r.role}</Tag>,
      key: r.role,
      align: 'center' as const,
      width: 140,
      render: (_: unknown, row: { permission: string }) =>
        r.permissions.includes(row.permission) ? <CheckCircleFilled style={{ color: token.colorSuccess }} /> : <MinusOutlined style={{ color: token.colorTextQuaternary }} />,
    })),
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="Users & Roles"
        subTitle="Assign roles, revoke access, and review what each role may do."
        avatar={<Avatar shape="square" size={44} icon={<TeamOutlined />} style={{ background: token.colorPrimaryBg, color: token.colorPrimary }} />}
      />
      <Card styles={{ body: { paddingTop: 0 } }}>
        <Tabs
          items={[
            {
              key: 'users',
              icon: <TeamOutlined />,
              label: `Users (${users.length})`,
              children: <Table rowKey="id" dataSource={users} columns={columns} loading={isLoading} pagination={false} size="middle" />,
            },
            {
              key: 'matrix',
              icon: <SafetyOutlined />,
              label: 'Permission matrix',
              children: (
                <>
                  <Text type="secondary" style={{ display: 'block', marginBottom: token.marginSM }}>
                    Enforced by the API on every request; project changes also require being the owner (or admin)
                  </Text>
                  <Table rowKey="key" dataSource={matrixRows} columns={matrixColumns} pagination={false} size="small" bordered sticky />
                </>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};
