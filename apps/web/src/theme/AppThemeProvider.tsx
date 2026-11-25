import React, { useEffect, useMemo, useState } from 'react';
import { App as AntApp, theme } from 'antd';
import { XProvider } from '@ant-design/x';
import type { ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';
import { useThemeStore } from './themeStore';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(DARK_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(DARK_QUERY);
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return dark;
}

/** True when the dark algorithm is in effect (explicit choice or the OS setting) */
export function useIsDark(): boolean {
  const mode = useThemeStore(s => s.mode);
  const systemDark = useSystemDark();
  return mode === 'dark' || (mode === 'system' && systemDark);
}

/** Brand seed tokens shared by both algorithms; everything else is derived by Ant Design */
const SEED: ThemeConfig['token'] = {
  colorPrimary: '#1677ff',
  colorInfo: '#1677ff',
  colorSuccess: '#52c41a',
  colorWarning: '#faad14',
  colorError: '#ff4d4f',
  borderRadius: 8,
  wireframe: false,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

export function buildTheme(dark: boolean, compact: boolean): ThemeConfig {
  const algorithm = [dark ? theme.darkAlgorithm : theme.defaultAlgorithm];
  if (compact) algorithm.push(theme.compactAlgorithm);
  return {
    algorithm,
    cssVar: { key: 'ai-corp', prefix: 'ai-corp' },
    hashed: false,
    token: {
      ...SEED,
      // A slightly deeper canvas than the stock dark theme so cards stand out
      ...(dark ? { colorBgLayout: '#0b0f17', colorBgContainer: '#141a23', colorBgElevated: '#1b222d', colorBorderSecondary: '#232b36' } : { colorBgLayout: '#f3f5f9' }),
    },
    components: {
      Layout: {
        headerBg: dark ? '#141a23' : '#ffffff',
        headerPadding: '0 24px',
        headerHeight: 56,
        siderBg: dark ? '#141a23' : '#ffffff',
        triggerBg: dark ? '#1b222d' : '#ffffff',
        triggerColor: dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)',
        bodyBg: dark ? '#0b0f17' : '#f3f5f9',
      },
      Menu: {
        itemBg: 'transparent',
        itemBorderRadius: 8,
        itemMarginInline: 8,
        activeBarBorderWidth: 0,
      },
      Card: { headerFontSize: 15 },
      Statistic: { contentFontSize: 26 },
      Table: { headerBorderRadius: 8 },
      Tabs: { horizontalMargin: '0 0 16px 0' },
      Tag: { defaultBg: dark ? 'rgba(255,255,255,0.06)' : undefined },
    },
  };
}

/** Copies the layout tokens onto <body> (outside the CSS-variable scope) and the scrollbars */
const DocumentTheme: React.FC = () => {
  const { token } = theme.useToken();
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--app-bg', token.colorBgLayout);
    root.setProperty('--app-text', token.colorText);
    root.setProperty('--app-scroll', token.colorFillSecondary);
    root.setProperty('--app-scroll-hover', token.colorFill);
  }, [token]);
  return null;
};

/**
 * Root of the Ant Design setup (`XProvider` = antd `ConfigProvider` + Ant Design X defaults): theme algorithm (light / dark / system, optional compact),
 * design tokens, CSS variables, locale, and the `App` context so `message`, `notification`
 * and `modal` follow the theme (use `App.useApp()` instead of the static functions).
 */
export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDark = useIsDark();
  const compact = useThemeStore(s => s.compact);
  const config = useMemo(() => buildTheme(isDark, compact), [isDark, compact]);

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  return (
    <XProvider
      theme={config}
      locale={enUS}
      componentSize={compact ? 'small' : 'middle'}
      card={{ variant: 'outlined' }}
      tag={{ variant: 'filled' }}
    >
      <AntApp message={{ maxCount: 3 }} notification={{ placement: 'topRight' }} style={{ minHeight: '100%' }}>
        <DocumentTheme />
        {children}
      </AntApp>
    </XProvider>
  );
};
