import React from 'react';
import { Card, Empty } from 'antd';
import { Column } from '@ant-design/plots';
import { AgentCostBreakdown } from '../../lib/api/hooks/cost';
import { useChartTheme } from '../../theme/charts';

interface CostBreakdownChartProps {
  data: AgentCostBreakdown[];
  height?: number;
}

/** Cost of each agent as a column chart (Ant Design Charts), one colour per role */
export const CostBreakdownChart: React.FC<CostBreakdownChartProps> = ({ data, height = 280 }) => {
  const chart = useChartTheme();

  if (!data || data.length === 0) {
    return (
      <Card>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No cost data available" />
      </Card>
    );
  }

  const rows = data.map(d => ({ role: d.agentRole, cost: Number(d.totalCost.toFixed(4)) }));

  return (
    <Card title="Cost Breakdown by Agent">
      <Column
        data={rows}
        xField="role"
        yField="cost"
        colorField="role"
        height={height}
        theme={chart.theme}
        scale={chart.roleScale(rows.map(r => r.role))}
        legend={false}
        style={{ radiusTopLeft: 4, radiusTopRight: 4 }}
        tooltip={{ items: [{ channel: 'y', name: 'Cost', valueFormatter: (v: number) => `$${v.toFixed(4)}` }] }}
      />
    </Card>
  );
};
