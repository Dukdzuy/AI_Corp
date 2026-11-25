import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Flex, Spin } from 'antd';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AuthPage } from './pages/AuthPage';
import { RequirePermission } from './components/auth/RequirePermission';
import { NotFound } from './pages/NotFound';
import { Permission } from '@ai-corp/shared-types';
import { apiClient } from './lib/api/client';
import socketClient from './lib/websocket/socket-client';
import { useAuthStore } from './stores/authStore';

// Pages load on demand, so the sign-in page and the first screen download less
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const VirtualOffice = lazy(() => import('./pages/VirtualOffice').then(m => ({ default: m.VirtualOffice })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(m => ({ default: m.ProjectDetail })));
const AgentDetail = lazy(() => import('./pages/AgentDetail').then(m => ({ default: m.AgentDetail })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AgentSettings = lazy(() => import('./pages/AgentSettings').then(m => ({ default: m.AgentSettings })));
const LlmProvidersPage = lazy(() => import('./pages/LlmProvidersPage').then(m => ({ default: m.LlmProvidersPage })));
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const AgentAnalyticsPage = lazy(() => import('./pages/AgentAnalyticsPage').then(m => ({ default: m.AgentAnalyticsPage })));

const PageLoading = () => (
  <Flex justify="center" align="center" style={{ minHeight: 320 }}>
    <Spin size="large" />
  </Flex>
);

export function App() {
  const { isAuthenticated, setUser, returnTo } = useAuthStore();

  // Phase 5: pick up role changes made by an admin since the last login
  useEffect(() => {
    if (!isAuthenticated) return;
    apiClient.get('/auth/me').then(res => setUser(res.data)).catch(() => undefined);
  }, [isAuthenticated, setUser]);

  useEffect(() => {
    if (isAuthenticated) {
      socketClient.connect();
      return () => {
        socketClient.disconnect();
      };
    }
  }, [isAuthenticated]);

  return (
    <>
      <Router>
        <Suspense fallback={<PageLoading />}>
          <Routes>
          <Route path="/auth" element={isAuthenticated ? <Navigate to={returnTo || '/'} replace /> : <AuthPage />} />
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/virtual-office" element={<VirtualOffice />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/agents/:id" element={<AgentDetail />} />
            <Route path="/admin" element={<RequirePermission permission={Permission.REPORT_VIEW}><AdminDashboard /></RequirePermission>} />
            <Route path="/agents" element={<RequirePermission permission={Permission.PROJECT_READ}><AgentSettings /></RequirePermission>} />
            <Route path="/providers" element={<RequirePermission permission={Permission.AGENT_CONFIGURE}><LlmProvidersPage /></RequirePermission>} />
            <Route path="/users" element={<RequirePermission permission={Permission.USER_MANAGE}><UsersPage /></RequirePermission>} />
            <Route path="/audit" element={<RequirePermission permission={Permission.AUDIT_VIEW}><AuditLogPage /></RequirePermission>} />
            <Route path="/analytics" element={<RequirePermission permission={Permission.REPORT_VIEW}><AgentAnalyticsPage /></RequirePermission>} />
            <Route path="/integrations" element={<RequirePermission permission={Permission.INTEGRATION_MANAGE}><IntegrationsPage /></RequirePermission>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </Suspense>
      </Router>
    </>
  );
}
