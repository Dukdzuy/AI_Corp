import React from 'react';
import { Breadcrumb, Flex, Typography, theme } from 'antd';
import type { BreadcrumbProps } from 'antd';

interface PageHeaderProps {
  title: React.ReactNode;
  subTitle?: React.ReactNode;
  /** Icon or avatar shown before the title */
  avatar?: React.ReactNode;
  /** Status tags next to the title */
  tags?: React.ReactNode;
  /** Buttons on the right */
  extra?: React.ReactNode;
  breadcrumb?: BreadcrumbProps['items'];
  /** Content under the title row (descriptions, statistics, actions) */
  children?: React.ReactNode;
}

/**
 * Page title block. Ant Design 5+ dropped `PageHeader` from the core library, so this rebuilds
 * it from `Breadcrumb`, `Flex` and `Typography` with the theme's tokens.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ title, subTitle, avatar, tags, extra, breadcrumb, children }) => {
  const { token } = theme.useToken();
  return (
    <div style={{ marginBottom: token.marginLG }}>
      {breadcrumb && <Breadcrumb items={breadcrumb} style={{ marginBottom: token.marginSM }} />}
      <Flex justify="space-between" align="flex-start" gap={token.margin} wrap>
        <Flex gap={token.marginSM} align="center" style={{ minWidth: 0, flex: '1 1 480px' }}>
          {avatar}
          <div style={{ minWidth: 0 }}>
            <Flex align="center" gap={token.marginXS} wrap>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {title}
              </Typography.Title>
              {tags}
            </Flex>
            {subTitle && (
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: token.marginXXS, maxWidth: 860 }}>
                {subTitle}
              </Typography.Text>
            )}
          </div>
        </Flex>
        {extra && (
          <Flex gap={token.marginXS} wrap align="center">
            {extra}
          </Flex>
        )}
      </Flex>
      {children && <div style={{ marginTop: token.margin }}>{children}</div>}
    </div>
  );
};
