import React from 'react';
import { Card, Col, Empty, Row, Skeleton, Table, Tag, Typography } from 'antd';
import { BarChartOutlined, CloudOutlined, DollarOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Column, Line, Pie } from '@ant-design/plots';
import { useCostSummary } from '../../lib/api/hooks/cost';
import { StatCard } from '../common/StatCard';
import { useChartTheme } from '../../theme/charts';

const { Text } = Typography;

interface CostDashboardProps {
  projectId?: string;
}

/** LLM cost and token usage: KPI tiles, Ant Design Charts (donut, grouped columns, line) and a model table */
export const CostDashboard: React.FC<CostDashboardProps> = ({ projectId }) => {
  const { data: summary, isLoading } = useCostSummary(projectId);
  const chart = useChartTheme();

  if (isLoading) {
    return <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>;
  }

  if (!summary) return null;

  const hasData = summary.totalTokens > 0;
  const roles = summary.byAgent.map(a => a.agentRole);

  const agentPieData = summary.byAgent.map(a => ({ role: a.agentRole, cost: Number(a.totalCost.toFixed(4)) }));
  const tokenData = summary.byAgent.flatMap(a => [
    { role: a.agentRole, kind: 'Tokens', value: a.totalTokens },
    { role: a.agentRole, kind: 'RTK Saved', value: a.rtkTokensSaved },
  ]);

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} xl={6}>
          <StatCard title="Total Cost" value={summary.totalCost} precision={4} prefix="$" icon={<DollarOutlined />} color="gold" />
        </Col>
        <Col xs={12} xl={6}>
          <StatCard title="Total Tokens" value={summary.totalTokens} icon={<ThunderboltOutlined />} color="blue" />
        </Col>
        <Col xs={12} xl={6}>
          <StatCard title="RTK Tokens Saved" value={summary.rtkTokensSaved} icon={<CloudOutlined />} color="green" />
        </Col>
        <Col xs={12} xl={6}>
          <StatCard title="Models Used" value={summary.byModel.length} icon={<BarChartOutlined />} color="purple" />
        </Col>
      </Row>

      {hasData ? (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={9}>
            <Card title="Cost by Agent" style={{ height: '100%' }}>
              {agentPieData.length > 0 ? (
                <Pie
                  data={agentPieData}
                  angleField="cost"
                  colorField="role"
                  innerRadius={0.62}
                  height={280}
                  theme={chart.theme}
                  scale={chart.roleScale(roles)}
                  label={false}
                  legend={{ color: { position: 'bottom', layout: { justifyContent: 'center' } } }}
                  tooltip={{ items: [{ channel: 'y', name: 'Cost', valueFormatter: (v: number) => `$${v.toFixed(4)}` }] }}
                  annotations={[
                    {
                      type: 'text',
                      style: {
                        text: `$${summary.totalCost.toFixed(2)}`,
                        x: '50%',
                        y: '50%',
                        textAlign: 'center',
                        fontSize: 20,
                        fontWeight: 600,
                        fill: chart.token.colorText,
                      },
                    },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={15}>
            <Card title="Token Usage by Agent" style={{ height: '100%' }}>
              <Column
                data={tokenData}
                xField="role"
                yField="value"
                colorField="kind"
                group
                height={280}
                theme={chart.theme}
                scale={{ color: { range: [chart.token.colorPrimary, chart.token.colorSuccess] } }}
                style={{ radiusTopLeft: 4, radiusTopRight: 4 }}
                axis={{ y: { labelFormatter: '~s' } }}
                legend={{ color: { position: 'top' } }}
                tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => v.toLocaleString() }] }}
              />
            </Card>
          </Col>

          {summary.costOverTime.length > 0 && (
            <Col xs={24}>
              <Card title="Cost Over Time">
                <Line
                  data={summary.costOverTime}
                  xField="date"
                  yField="cost"
                  height={240}
                  theme={chart.theme}
                  shapeField="smooth"
                  style={{ lineWidth: 2, stroke: chart.token.colorWarning }}
                  area={{ style: { fill: `linear-gradient(-90deg, ${chart.token.colorWarning}00 0%, ${chart.token.colorWarning}55 100%)` } }}
                  axis={{ y: { labelFormatter: (v: number) => `$${v}` } }}
                  tooltip={{ items: [{ channel: 'y', name: 'Cost', valueFormatter: (v: number) => `$${v.toFixed(4)}` }] }}
                />
              </Card>
            </Col>
          )}

          <Col xs={24}>
            <Card title="Model Usage Breakdown" styles={{ body: { padding: 0 } }}>
              <Table
                dataSource={summary.byModel}
                rowKey="model"
                size="middle"
                pagination={false}
                scroll={{ x: 720 }}
                columns={[
                  { title: 'Model', dataIndex: 'model', key: 'model', render: (model: string) => <Text code>{model}</Text> },
                  { title: 'Provider', dataIndex: 'provider', key: 'provider', render: (provider: string) => <Tag color="blue">{provider}</Tag> },
                  { title: 'Requests', dataIndex: 'requestCount', key: 'requestCount', align: 'right' as const, sorter: (a, b) => a.requestCount - b.requestCount },
                  {
                    title: 'Tokens',
                    dataIndex: 'totalTokens',
                    key: 'totalTokens',
                    align: 'right' as const,
                    sorter: (a, b) => a.totalTokens - b.totalTokens,
                    render: (v: number) => v.toLocaleString(),
                  },
                  {
                    title: 'Cost',
                    dataIndex: 'cost',
                    key: 'cost',
                    align: 'right' as const,
                    defaultSortOrder: 'descend' as const,
                    sorter: (a, b) => a.cost - b.cost,
                    render: (v: number) => <Text type="warning">${v.toFixed(4)}</Text>,
                  },
                  {
                    title: 'Fallbacks',
                    dataIndex: 'fallbackTriggered',
                    key: 'fallbackTriggered',
                    align: 'center' as const,
                    render: (v: number) => <Tag color={v > 0 ? 'orange' : 'default'}>{v}</Tag>,
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      ) : (
        <Card>
          <Empty description="No cost data yet. Data will appear when LLM calls are made." />
        </Card>
      )}
    </div>
  );
};
