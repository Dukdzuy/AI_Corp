import React, { useState } from 'react';
import { Alert, App, Avatar, Button, Card, Col, Flex, Form, Input, Row, Segmented, Space, Tabs, Typography, theme } from 'antd';
import {
  ApiOutlined,
  ApartmentOutlined,
  DesktopOutlined,
  LockOutlined,
  MailOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiClient } from '../lib/api/client';
import { useThemeStore, type ThemeMode } from '../theme/themeStore';

const { Title, Text, Paragraph } = Typography;

const HIGHLIGHTS = [
  { icon: <TeamOutlined />, title: '8 AI agents', text: 'CEO, BA, Architect, PM, Dev, QC, QA and Marketing work as one team.' },
  { icon: <ApartmentOutlined />, title: 'OOAD by design', text: 'Use cases, domain model, UML and patterns before any code.' },
  { icon: <SafetyCertificateOutlined />, title: 'Human in the loop', text: 'Approvals, budgets and quality gates keep you in control.' },
];

export const AuthPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth, sessionExpired, returnTo, clearReturnTo } = useAuthStore();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { mode, setMode } = useThemeStore();

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', values);
      const target = returnTo && returnTo !== '/auth' ? returnTo : '/';
      setAuth(res.data.accessToken, res.data.user);
      clearReturnTo();
      message.success('Login successful!');
      navigate(target, { replace: true });
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: { email: string; name: string; password: string }) => {
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/register', values);
      message.success(
        res.data?.role === 'viewer'
          ? 'Account created. You can view projects now; an admin can let you create them. Please log in.'
          : 'Registration successful! Please login.',
        6
      );
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const loginForm = (
    <Form onFinish={handleLogin} layout="vertical" size="large" requiredMark={false}>
      <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Please enter your email' }]}>
        <Input prefix={<MailOutlined />} placeholder="Email" autoComplete="email" allowClear />
      </Form.Item>
      <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Please enter your password' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="Password" autoComplete="current-password" />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" loading={loading} block>
          Sign In
        </Button>
      </Form.Item>
    </Form>
  );

  const registerForm = (
    <Form onFinish={handleRegister} layout="vertical" size="large" requiredMark={false}>
      <Form.Item name="name" label="Full name" rules={[{ required: true, message: 'Please enter your name' }]}>
        <Input prefix={<UserOutlined />} placeholder="Full Name" autoComplete="name" allowClear />
      </Form.Item>
      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: 'Please enter your email' },
          { type: 'email', message: 'Invalid email format' },
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="Email" autoComplete="email" allowClear />
      </Form.Item>
      <Form.Item
        name="password"
        label="Password"
        rules={[
          { required: true, message: 'Please enter a password' },
          { min: 6, message: 'Password must be at least 6 characters' },
        ]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="Password" autoComplete="new-password" />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" loading={loading} block>
          Create Account
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <Row style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Col
        xs={0}
        lg={12}
        style={{
          background: `linear-gradient(145deg, ${token.colorPrimary} 0%, #722ed1 100%)`,
          padding: token.paddingXL * 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Flex vertical gap={token.marginXL} style={{ maxWidth: 460 }}>
          <Flex align="center" gap={token.marginSM}>
            <Avatar shape="square" size={44} icon={<ApiOutlined />} style={{ background: 'rgba(255,255,255,0.18)' }} />
            <Title level={3} style={{ margin: 0, color: '#fff' }}>AI Corp Platform</Title>
          </Flex>
          <Title level={1} style={{ margin: 0, color: '#fff' }}>
            A virtual software company, run by AI agents.
          </Title>
          <Flex vertical gap={token.marginLG}>
            {HIGHLIGHTS.map(h => (
              <Flex key={h.title} gap={token.margin} align="start">
                <Avatar size={40} icon={h.icon} style={{ background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                <div>
                  <Text strong style={{ color: '#fff', fontSize: token.fontSizeLG }}>{h.title}</Text>
                  <Paragraph style={{ color: 'rgba(255,255,255,0.8)', margin: 0 }}>{h.text}</Paragraph>
                </div>
              </Flex>
            ))}
          </Flex>
        </Flex>
      </Col>
      <Col xs={24} lg={12}>
        <Flex vertical justify="center" align="center" style={{ minHeight: '100vh', padding: token.paddingLG, position: 'relative' }}>
          <Segmented<ThemeMode>
            size="small"
            value={mode}
            onChange={setMode}
            style={{ position: 'absolute', top: token.paddingLG, right: token.paddingLG }}
            options={[
              { value: 'light', icon: <SunOutlined />, title: 'Light' },
              { value: 'dark', icon: <MoonOutlined />, title: 'Dark' },
              { value: 'system', icon: <DesktopOutlined />, title: 'Follow system' },
            ]}
          />
          <Card style={{ width: '100%', maxWidth: 420 }} styles={{ body: { padding: token.paddingXL } }}>
            <Space orientation="vertical" size={token.marginLG} style={{ width: '100%' }}>
              {sessionExpired && (
                <Alert type="info" showIcon title="Your session expired. Sign in again to continue where you left off." />
              )}
              <div>
                <Title level={3} style={{ margin: 0 }}>Welcome back</Title>
                <Text type="secondary">Sign in to your AI Corp workspace</Text>
              </div>
              <Tabs
                defaultActiveKey="login"
                items={[
                  { key: 'login', label: 'Login', children: loginForm },
                  { key: 'register', label: 'Register', children: registerForm },
                ]}
              />
            </Space>
          </Card>
        </Flex>
      </Col>
    </Row>
  );
};
