import { theme } from 'antd';
import { useIsDark } from './AppThemeProvider';
import { roleHex } from './palette';

/**
 * Shared settings for Ant Design Charts (`@ant-design/plots`): the G2 theme matching the
 * light / dark algorithm, a transparent background so charts sit on the Card colour, the
 * app font, and one colour per agent role.
 */
export function useChartTheme() {
  const dark = useIsDark();
  const { token } = theme.useToken();
  return {
    dark,
    token,
    theme: {
      type: dark ? 'classicDark' : 'classic',
      view: { viewFill: 'transparent' },
      fontFamily: token.fontFamily,
    } as any,
    /** `scale.color` that keeps every agent role on its own colour in every chart */
    roleScale: (roles: string[]) => ({ color: { domain: roles, range: roles.map(r => roleHex(r, dark)) } }),
  };
}
