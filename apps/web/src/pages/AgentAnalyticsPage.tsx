import React, { useState } from 'react';
import { Alert, Avatar, Card, Col, Empty, Flex, Progress, Row, Segmented, Statistic, Table, Tag, Tooltip, Typography } from 'antd';
import { AimOutlined, ArrowDownOutlined, ArrowUpOutlined, CheckCircleOutlined, DollarOutlined, LineChartOutlined, NodeIndexOutlined, TrophyOutlined } from '@ant-design/icons';
import { Column, Heatmap, Line } from '@ant-design/plots';
import { AgentRow, useAgentAnalytics, useEstimationModel } from '../lib/api/hooks/analytics';
import { duration, heatmapMatrix, pct, successSeries, trendText, trendTone, usd } from '../components/analytics/analyticsFormat';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { roleColor } from '../theme/palette';
import { useChartTheme } from '../theme/charts';

const { Text } = Typography;
const TONE_TYPE = { good: 'success', bad: 'danger', neutral: 'secondary' } as const;

const Trend: React.FC<{ value: number | null; kind: 'points' | 'relative'; higherIsBetter: boolean }> = ({ value, kind, higherIsBetter }) => {
  const tone = trendTone(value, higherIsBetter);
  if (value === null) return <Text type="secondary">–</Text>;
  return (
    <Text type={TONE_TYPE[tone]} style={{ fontSize: 12 }}>
      {value > 0 ? <ArrowUpOutlined /> : value < 0 ? <ArrowDownOutlined /> : null} {trendText(value, kind)}
    </Text>
  );
};

/**
 * Agent performance analytics (Phase 6, Task 24) and the estimation model's accuracy (Task 25).
 */
export const AgentAnalyticsPage: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useAgentAnalytics(days);
  const { data: model } = useEstimationModel();
  const chart = useChartTheme();
  const { token } = chart;

  const series = successSeries(data?.daily ?? []);
  const heatmap = heatmapMatrix(data?.heatmap ?? []);
  const totalRuns = data?.roles.reduce((s, r) => s + r.executionCount, 0) ?? 0;
  const totalCost = data?.roles.reduce((s, r) => s + r.totalCost, 0) ?? 0;
  const finished = data?.roles.reduce((s, r) => s + r.completed + r.failed, 0) ?? 0;
  const completed = data?.roles.reduce((s, r) => s + r.completed, 0) ?? 0;

  const columns = [
    { title: '#', dataIndex: 'rank', key: 'rank', width: 50, render: (r: number) => (r <= 3 ? <TrophyOutlined style={{ color: [token.gold6, token.colorTextTertiary, token.orange7][r - 1], fontSize: 16 }} /> : <Text type="secondary">{r}</Text>) },
    { title: 'Agent', dataIndex: 'agentRole', key: 'role', render: (r: string) => <Tag color={roleColor(r)}>{r}</Tag> },
    { title: 'Steps', dataIndex: 'executionCount', key: 'n', align: 'right' as const, width: 70 },
    {
      title: 'Success', key: 'success', width: 170,
      render: (_: unknown, r: AgentRow) => (
        <Flex vertical>
          <Progress percent={Math.round((r.successRate ?? 0) * 100)} size="small" format={() => pct(r.successRate)} status={(r.successRate ?? 0) < 0.6 ? 'exception' : 'normal'} />
          <Trend value={r.trend.successRateDelta} kind="points" higherIsBetter />
        </Flex>
      ),
    },
    {
      title: 'Avg duration', key: 'dur', width: 130,
      render: (_: unknown, r: AgentRow) => <Flex vertical><Text>{duration(r.avgDurationMs)}</Text><Trend value={r.trend.avgDurationChange} kind="relative" higherIsBetter={false} /></Flex>,
    },
    { title: 'p95', dataIndex: 'p95DurationMs', key: 'p95', width: 90, render: (ms: number) => duration(ms) },
    {
      title: 'Cost / success', key: 'cps', width: 130,
      render: (_: unknown, r: AgentRow) => <Flex vertical><Text>{usd(r.costPerSuccess)}</Text><Trend value={r.trend.costPerExecutionChange} kind="relative" higherIsBetter={false} /></Flex>,
    },
    {
      title: 'Quality', key: 'quality',
      render: (_: unknown, r: AgentRow) => (
        <Tooltip title={`${r.quality.samples} samples`}>
          <Flex vertical>
            <Text>{pct(r.quality.value)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{r.quality.basis}</Text>
          </Flex>
        </Tooltip>
      ),
    },
  ];

  const lineData = series.rows.flatMap(row =>
    series.roles.filter(role => row[role] != null).map(role => ({ date: String(row.date), role, rate: Number(row[role]) })),
  );
  const costData = (data?.roles ?? []).map(r => ({ role: r.agentRole, cost: r.costPerSuccess ?? 0 }));
  const heatData = heatmap.rows.flatMap(row => row.counts.map((count, hour) => ({ day: row.label, hour: String(hour), count })));

  return (
    <Flex vertical gap={16} style={{ maxWidth: 1400, margin: '0 auto' }}>
      <PageHeader
        title="Agent Analytics"
        avatar={<Avatar shape="square" size={44} icon={<LineChartOutlined />} style={{ background: token.colorPrimaryBg, color: token.colorPrimary }} />}
        subTitle={`Compared with the ${days} days before. Quality is role-specific: QA approvals for DEV, OOAD gate results for the Architect, QC test results for QC, first-attempt success for the others.`}
        extra={<Segmented value={days} onChange={v => setDays(Number(v))} options={[{ label: '7 days', value: 7 }, { label: '30 days', value: 30 }, { label: '90 days', value: 90 }]} />}
      />

      {data?.anomalies.map(a => (
        <Alert key={`${a.agentRole}-${a.type}`} type={a.severity === 'high' ? 'error' : 'warning'} showIcon title={a.message} description={`Rule: ${a.type.replace(/_/g, ' ')} (threshold ${a.threshold})`} />
      ))}

      <Row gutter={[16, 16]}>
        <Col xs={12} xl={6}><StatCard title="Agent steps" value={totalRuns} loading={isLoading} icon={<NodeIndexOutlined />} color="blue" /></Col>
        <Col xs={12} xl={6}><StatCard title="Success rate" value={finished ? pct(completed / finished) : '–'} loading={isLoading} icon={<CheckCircleOutlined />} color="green" /></Col>
        <Col xs={12} xl={6}><StatCard title="LLM cost" value={usd(totalCost)} loading={isLoading} icon={<DollarOutlined />} color="gold" /></Col>
        <Col xs={12} xl={6}>
          <Tooltip title="Static-analysis prediction of the DEV step against the next QA verdict">
            <div style={{ height: '100%' }}>
              <StatCard
                title="QA prediction accuracy"
                value={pct(data?.qaPrediction.accuracy)}
                suffix={data?.qaPrediction.samples ? <Text type="secondary" style={{ fontSize: 12 }}>({data.qaPrediction.samples})</Text> : null}
                loading={isLoading}
                icon={<AimOutlined />}
                color="purple"
              />
            </div>
          </Tooltip>
        </Col>
      </Row>

      <Card title={<Flex gap={8} align="center"><TrophyOutlined style={{ color: token.gold6 }} />Leaderboard</Flex>} styles={{ body: { padding: 0 } }}>
        <Table rowKey="agentRole" size="middle" loading={isLoading} pagination={false} dataSource={data?.roles ?? []} columns={columns} scroll={{ x: 900 }} locale={{ emptyText: <Empty description="No agent steps in this period" /> }} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Success rate per day (%)" style={{ height: '100%' }}>
            {lineData.length ? (
              <Line
                data={lineData}
                xField="date"
                yField="rate"
                colorField="role"
                height={280}
                theme={chart.theme}
                scale={{ ...chart.roleScale(series.roles), y: { domain: [0, 100] } }}
                point={{ shapeField: 'circle', sizeField: 3 }}
                style={{ lineWidth: 2 }}
                legend={{ color: { position: 'top' } }}
                tooltip={{ items: [{ channel: 'y', valueFormatter: (v: number) => `${v}%` }] }}
              />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Cost per successful step" style={{ height: '100%' }}>
            {costData.length ? (
              <Column
                data={costData}
                xField="role"
                yField="cost"
                colorField="role"
                height={280}
                theme={chart.theme}
                scale={chart.roleScale(costData.map(c => c.role))}
                legend={false}
                style={{ radiusTopLeft: 4, radiusTopRight: 4 }}
                tooltip={{ items: [{ channel: 'y', name: 'Cost / success', valueFormatter: (v: number) => usd(v) }] }}
              />
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
      </Row>

      <Card title="Activity by day and hour (UTC)">
        <Heatmap
          data={heatData}
          xField="hour"
          yField="day"
          colorField="count"
          mark="cell"
          height={260}
          theme={chart.theme}
          scale={{ color: { range: [token.colorFillQuaternary, token.colorPrimaryBorder, token.colorPrimary] }, y: { domain: heatmap.rows.map(r => r.label) } }}
          style={{ inset: 1.5, radius: 3 }}
          legend={false}
          tooltip={{ title: (d: { day: string; hour: string }) => `${d.day} ${d.hour}:00`, items: [{ channel: 'color', name: 'Steps' }] }}
        />
      </Card>

      <Card title="Effort & cost estimation model" extra={model && <Text type="secondary">trained on {model.trainingProjects} finished projects; regression from {model.minRegressionSamples} samples</Text>}>
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Table
              rowKey="role" size="small" pagination={false} dataSource={model?.roles ?? []}
              columns={[
                { title: 'Agent', dataIndex: 'role', key: 'role', render: (r: string) => <Tag color={roleColor(r)}>{r}</Tag> },
                { title: 'Samples', dataIndex: 'samples', key: 's', align: 'right' as const },
                { title: 'Method', dataIndex: 'method', key: 'm', render: (m: string) => <Tag>{m}</Tag> },
                { title: 'LOO error (time)', key: 'e', render: (_: unknown, r: any) => pct(r.evaluation.mapeDuration) },
                { title: 'LOO error (cost)', key: 'c', render: (_: unknown, r: any) => pct(r.evaluation.mapeCost) },
              ]}
              locale={{ emptyText: <Empty description="No finished project yet" /> }}
            />
          </Col>
          <Col xs={24} lg={12}>
            <Flex vertical gap={8}>
              <Text type="secondary">Forecast made when the workflow started, against the outcome (mean absolute error: time {pct(model?.meanAbsoluteDurationError)}, cost {pct(model?.meanAbsoluteCostError)})</Text>
              <Table
                rowKey="projectId" size="small" pagination={{ pageSize: 5 }} dataSource={model?.accuracy ?? []}
                columns={[
                  { title: 'Project', dataIndex: 'projectName', key: 'p', ellipsis: true },
                  { title: 'Time (pred → actual)', key: 't', render: (_: unknown, a: any) => `${duration(a.predictedDurationMs)} → ${duration(a.actualDurationMs)}` },
                  { title: 'Cost (pred → actual)', key: 'c', render: (_: unknown, a: any) => `${usd(a.predictedCost)} → ${usd(a.actualCost)}` },
                  { title: 'Error', key: 'e', render: (_: unknown, a: any) => trendText(a.durationError, 'relative') },
                ]}
                locale={{ emptyText: <Empty description="No finished project with a forecast yet" /> }}
              />
            </Flex>
          </Col>
        </Row>
      </Card>
    </Flex>
  );
};
