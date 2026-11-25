import React from 'react';
import { Card, Col, Empty, Flex, Row, Space, Statistic, Tag, Timeline, Typography, theme } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExperimentOutlined, RiseOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import { useAgentLearning } from '../../lib/api/hooks/learning';
import { useChartTheme } from '../../theme/charts';

const { Text, Paragraph } = Typography;

const SIGNAL_LABELS: Record<string, string> = {
  ooad_gate: 'OOAD gate',
  qc_verification: 'QC tests',
  qa_review: 'QA review',
};

/** Success rate over time and the lessons the agent refined from its outcomes (Task 14) */
export const LearningPanel: React.FC<{ role: string }> = ({ role }) => {
  const { data, isLoading } = useAgentLearning(role);
  const chart = useChartTheme();
  const { token } = theme.useToken();

  return (
    <Card
      loading={isLoading}
      style={{ marginBottom: token.marginLG }}
      title={
        <Space>
          <RiseOutlined style={{ color: token.colorPrimary }} />
          Learning
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>last 30 days</Text>
        </Space>
      }
    >
      {!data || data.outcomes === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No graded executions yet. Outcomes come from the OOAD gate (BA, Architect), QC tests (DEV) and QA reviews (DEV, QC)."
        />
      ) : (
        <Flex vertical gap={20}>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Statistic title="Success rate" value={data.successRate ?? 0} suffix="%" />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title="Graded executions" value={data.outcomes} />
            </Col>
            <Col xs={24} md={12}>
              <Text type="secondary">By signal</Text>
              <Flex wrap gap={4} style={{ marginTop: 6 }}>
                {Object.entries(data.bySignal).map(([signal, s]) => (
                  <Tag key={signal} color={s.successes === s.total ? 'success' : s.successes === 0 ? 'error' : 'warning'}>
                    {SIGNAL_LABELS[signal] || signal}: {s.successes}/{s.total}
                  </Tag>
                ))}
              </Flex>
            </Col>
          </Row>

          {data.timeline.length > 1 && (
            <div>
              <Text type="secondary">Success rate per day (%)</Text>
              <Line
                data={data.timeline}
                xField="date"
                yField="successRate"
                height={200}
                theme={chart.theme}
                scale={{ y: { domain: [0, 100] } }}
                style={{ lineWidth: 2, stroke: token.colorPrimary }}
                point={{ shapeField: 'circle', sizeField: 4, style: { fill: token.colorPrimary } }}
                tooltip={{
                  title: 'date',
                  items: [
                    { channel: 'y', name: 'Success', valueFormatter: (v: number) => `${v}%` },
                    (d: any) => ({ name: 'Graded', value: `${d.successes} of ${d.total}` }),
                  ],
                }}
              />
            </div>
          )}

          <div>
            <Space style={{ marginBottom: 8 }}>
              <ExperimentOutlined style={{ color: token.colorWarning }} />
              <Text strong>Top lessons</Text>
            </Space>
            {data.lessons.length === 0 ? (
              <Text type="secondary" style={{ display: 'block' }}>No lessons refined yet (one is written every few graded executions).</Text>
            ) : (
              <Flex vertical gap={8}>
                {data.lessons.map((lesson, i) => (
                  <Card key={i} size="small" style={{ background: token.colorFillQuaternary }}>
                    <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{lesson.content}</Paragraph>
                    <Text type="secondary" style={{ fontSize: 11 }}>{new Date(lesson.createdAt).toLocaleString()}</Text>
                  </Card>
                ))}
              </Flex>
            )}
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>Recent outcomes</Text>
            <Timeline
              items={data.recentOutcomes.map((o, i) => ({
                key: i,
                color: o.success ? 'green' : 'red',
                icon: o.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />,
                content: <Text style={{ fontSize: 12 }}>{o.content}</Text>,
              }))}
            />
          </div>
        </Flex>
      )}
    </Card>
  );
};
