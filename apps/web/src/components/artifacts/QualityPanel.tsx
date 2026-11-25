import React from 'react';
import { Alert, Card, Col, Collapse, Flex, Progress, Row, Space, Statistic, Steps, Tag, Typography, theme } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SafetyCertificateOutlined, WarningOutlined } from '@ant-design/icons';
import { OoadProjectMetrics } from '../../lib/api/hooks/artifacts';
import { describeCheck, GateView, WarningView } from './qualityGate';

const { Text } = Typography;

/** ooadMetadata summary: what the BA, Architect and QC produced */
export const OoadSummary: React.FC<{ metrics: OoadProjectMetrics | null | undefined }> = ({ metrics }) => {
  if (!metrics) return null;
  const trace = metrics.traceability;
  return (
    <Card size="small" title={<Space><SafetyCertificateOutlined />OOAD summary</Space>}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={4}><Statistic title="Use cases" value={metrics.useCaseCount} /></Col>
        <Col xs={12} md={4}><Statistic title="Entities" value={metrics.entityCount} /></Col>
        <Col xs={12} md={4}><Statistic title="Patterns" value={metrics.patternCount} /></Col>
        <Col xs={12} md={4}><Statistic title="Gate pass rate" value={metrics.gatePassRate} suffix="%" /></Col>
        <Col xs={24} md={8}>
          <Text type="secondary">Use case test coverage</Text>
          {metrics.testCoverage === null ? (
            <div><Text type="secondary">Not verified yet</Text></div>
          ) : (
            <Progress
              percent={metrics.testCoverage}
              status={metrics.testCoverage < 80 ? 'exception' : trace?.failingUseCases.length ? 'normal' : 'success'}
            />
          )}
          {trace && (
            <Space size={4} wrap>
              <Tag color={trace.executed ? 'blue' : 'default'}>{trace.executed ? 'tests executed' : 'tests not executed'}</Tag>
              {trace.executed && <Tag color="green">{trace.testsPassed} passed</Tag>}
              {trace.executed && trace.testsFailed > 0 && <Tag color="red">{trace.testsFailed} failed</Tag>}
              {trace.failingUseCases.map(id => <Tag key={id} color="red">{id} failing</Tag>)}
              {trace.missingUseCases.map(id => <Tag key={id} color="orange">{id} missing</Tag>)}
            </Space>
          )}
        </Col>
      </Row>
    </Card>
  );
};

export const QualityGateList: React.FC<{ gates: GateView[] }> = ({ gates }) => {
  const { token } = theme.useToken();
  if (gates.length === 0) return null;
  return (
    <Collapse
      defaultActiveKey={gates.filter(g => !g.passed).map(g => `${g.gateId}-${g.at}`)}
      items={gates.map(gate => ({
        key: `${gate.gateId}-${gate.at}`,
        label: (
          <Space wrap>
            {gate.passed ? <CheckCircleOutlined style={{ color: token.colorSuccess }} /> : <CloseCircleOutlined style={{ color: token.colorError }} />}
            <Text strong>Quality gate: {gate.gateId}</Text>
            <Tag color={gate.passed ? 'success' : 'error'}>{gate.passed ? 'passed' : 'failed'}</Tag>
            {gate.live && <Tag color="processing">live</Tag>}
          </Space>
        ),
        extra: (
          <Flex gap={token.marginSM} align="center">
            <Progress type="circle" size={28} percent={gate.score} status={gate.passed ? 'success' : 'exception'} format={() => ''} />
            <Text type="secondary" style={{ fontSize: 12 }}>{gate.score}% · {new Date(gate.at).toLocaleString()}</Text>
          </Flex>
        ),
        children: (
          <Steps
            orientation="vertical"
            size="small"
            items={gate.checklist.map(item => ({
              title: item.name,
              content: describeCheck(item),
              status: item.passed ? 'finish' : 'error',
              icon: item.passed ? <CheckCircleOutlined /> : <CloseCircleOutlined />,
            }))}
          />
        ),
      }))}
    />
  );
};

export const QualityWarnings: React.FC<{ warnings: WarningView[] }> = ({ warnings }) => (
  <>
    {warnings.map((w, i) => (
      <Alert
        key={`${w.at}-${i}`}
        type={w.severity === 'error' ? 'error' : w.severity === 'info' ? 'info' : 'warning'}
        showIcon
        icon={<WarningOutlined />}
        title={w.message}
        description={[
          w.failingUseCases?.length ? `Failing: ${w.failingUseCases.join(', ')}` : '',
          w.missingUseCases?.length ? `Missing tests: ${w.missingUseCases.join(', ')}` : '',
        ].filter(Boolean).join(' · ') || undefined}
      />
    ))}
  </>
);
