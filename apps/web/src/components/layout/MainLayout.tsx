import React, { Suspense } from 'react';
import { Avatar, Badge, Button, Dropdown, Flex, FloatButton, Grid, Layout, Menu, Segmented, Skeleton, Tag, Tooltip, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ApiOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  RobotOutlined,
  AuditOutlined,
  KeyOutlined,
  UsergroupAddOutlined,
  LineChartOutlined,
  CloudServerOutlined,
  SunOutlined,
  MoonOutlined,
  DesktopOutlined,
  CompressOutlined,
  ExpandOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Permission } from '@ai-corp/shared-types';
import { hasPermission, ROLE_LABELS } from '../../lib/permissions';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useWebsocketStore } from '../../stores/websocketStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore, type ThemeMode } from '../../theme/themeStore';
import { ApprovalNotification } from '../approvals/ApprovalNotification';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const CONNECTION_STATUS: Record<string, 'success' | 'processing' | 'warning' | 'error' | 'default'> = {
  connected: 'success',
  connecting: 'processing',
  reconnecting: 'warning',
  disconnected: 'error',
};

export const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { status } = useWebsocketStore();
  const { logout, user } = useAuthStore();
  const { mode, setMode, compact, setCompact, siderCollapsed, setSiderCollapsed } = useThemeStore();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const selectedKey = location.pathname.startsWith('/virtual-office')
    ? '/virtual-office'
    : location.pathname.startsWith('/projects')
    ? '/'
    : location.pathname.startsWith('/admin')
    ? '/admin'
    : location.pathname.startsWith('/agents')
    ? '/agents'
    : ['/providers', '/users', '/audit', '/integrations', '/analytics'].find(p => location.pathname.startsWith(p)) ?? '/';

  type Item = { key: string; icon: React.ReactNode; label: string } | false;
  const group = (key: string, label: string, children: Item[]) => {
    const items = children.filter(Boolean) as Array<{ key: string; icon: React.ReactNode; label: string }>;
    return items.length ? { type: 'group' as const, key, label, children: items } : null;
  };

  const menuItems: MenuProps['items'] = [
    group('work', 'Workspace', [
      { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/virtual-office', icon: <TeamOutlined />, label: 'Virtual Office' },
    ]),
    group('agents', 'Agents', [
      { key: '/agents', icon: <RobotOutlined />, label: 'Agent Models' },
      hasPermission(user, Permission.AGENT_CONFIGURE) && { key: '/providers', icon: <CloudServerOutlined />, label: 'LLM Providers' },
      // Phase 6: agent performance analytics and the estimation model
      hasPermission(user, Permission.REPORT_VIEW) && { key: '/analytics', icon: <LineChartOutlined />, label: 'Agent Analytics' },
    ]),
    group('admin', 'Administration', [
      { key: '/admin', icon: <SettingOutlined />, label: 'Admin' },
      // Phase 5: shown only to roles that may use them
      hasPermission(user, Permission.INTEGRATION_MANAGE) && { key: '/integrations', icon: <KeyOutlined />, label: 'Integrations' },
      hasPermission(user, Permission.USER_MANAGE) && { key: '/users', icon: <UsergroupAddOutlined />, label: 'Users & Roles' },
      hasPermission(user, Permission.AUDIT_VIEW) && { key: '/audit', icon: <AuditOutlined />, label: 'Audit Log' },
    ]),
  ].filter(Boolean);

  const userMenu: MenuProps['items'] = [
    {
      key: 'me',
      type: 'group',
      label: user ? (
        <Flex vertical>
          <Text strong>{user.name}</Text>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>{user.email}</Text>
        </Flex>
      ) : 'Account',
    },
    { type: 'divider' },
    {
      key: 'compact',
      icon: compact ? <ExpandOutlined /> : <CompressOutlined />,
      label: compact ? 'Comfortable density' : 'Compact density',
      onClick: () => setCompact(!compact),
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', danger: true, onClick: handleLogout },
  ];

  const collapsed = siderCollapsed || !screens.lg;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={232}
        collapsedWidth={screens.md ? 72 : 0}
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{
          borderInlineEnd: `1px solid ${token.colorBorderSecondary}`,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
        }}
      >
        <Flex
          align="center"
          gap={token.marginSM}
          style={{ height: 56, padding: `0 ${collapsed ? 24 : 20}px`, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <Avatar shape="square" size={32} icon={<ApiOutlined />} style={{ background: token.colorPrimary, flexShrink: 0 }} />
          {!collapsed && (
            <Text strong style={{ fontSize: token.fontSizeLG, whiteSpace: 'nowrap' }}>
              AI Corp
            </Text>
          )}
        </Flex>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 0 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <Button
            type="text"
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setSiderCollapsed(!siderCollapsed)}
          />

          <Flex align="center" gap={token.marginSM}>
            <Tooltip title={`Live updates: ${status}`}>
              <Badge status={CONNECTION_STATUS[status] ?? 'default'} text={screens.md ? <Text type="secondary" style={{ textTransform: 'capitalize' }}>{status}</Text> : undefined} />
            </Tooltip>

            <Segmented<ThemeMode>
              size="small"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'light', icon: <SunOutlined />, title: 'Light' },
                { value: 'dark', icon: <MoonOutlined />, title: 'Dark' },
                { value: 'system', icon: <DesktopOutlined />, title: 'Follow system' },
              ]}
            />

            <ApprovalNotification />

            <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight">
              <Button type="text" style={{ height: 40, paddingInline: token.paddingXS }}>
                <Flex align="center" gap={token.marginXS}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: token.colorPrimary }} />
                  {user && screens.md && <Text>{user.name}</Text>}
                  {user && (
                    <Tag color={ROLE_LABELS[user.role]?.color} style={{ marginInlineEnd: 0 }}>
                      {ROLE_LABELS[user.role]?.label ?? user.role}
                    </Tag>
                  )}
                </Flex>
              </Button>
            </Dropdown>
          </Flex>
        </Header>

        <Content style={{ padding: screens.md ? token.paddingLG : token.padding, minWidth: 0 }}>
          {/* Pages are lazy-loaded: keep the menu and header while one downloads */}
          <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} style={{ maxWidth: 1400, margin: '0 auto' }} />}>
            <Outlet />
          </Suspense>
          <FloatButton.BackTop visibilityHeight={400} />
        </Content>
      </Layout>
    </Layout>
  );
};
