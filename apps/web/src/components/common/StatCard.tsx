import React from 'react';
import { Avatar, Card, Flex, Statistic, theme } from 'antd';
import type { StatisticProps } from 'antd';
import type { PresetColor } from '../../theme/palette';
import { presetHex } from '../../theme/palette';
import { useIsDark } from '../../theme/AppThemeProvider';

interface StatCardProps extends Pick<StatisticProps, 'value' | 'precision' | 'prefix' | 'suffix' | 'loading' | 'formatter'> {
  title: React.ReactNode;
  icon: React.ReactNode;
  color?: PresetColor;
  /** Small line under the value, e.g. a comparison */
  footer?: React.ReactNode;
  onClick?: () => void;
}

/** KPI tile: tinted icon + `Statistic`, coloured from an Ant Design preset palette */
export const StatCard: React.FC<StatCardProps> = ({ title, icon, color = 'blue', footer, onClick, ...stat }) => {
  const { token } = theme.useToken();
  const dark = useIsDark();
  return (
    <Card hoverable={!!onClick} onClick={onClick} styles={{ body: { padding: token.paddingLG } }} style={{ height: '100%' }}>
      <Flex gap={token.margin} align="center">
        <Avatar
          shape="square"
          size={48}
          icon={icon}
          style={{ background: presetHex(color, dark, 1), color: presetHex(color, dark, dark ? 6 : 5), flexShrink: 0, borderRadius: token.borderRadiusLG }}
        />
        <div style={{ minWidth: 0 }}>
          <Statistic title={title} {...stat} />
          {footer}
        </div>
      </Flex>
    </Card>
  );
};
