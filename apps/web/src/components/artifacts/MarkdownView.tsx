import React, { useMemo } from 'react';
import { Divider, Table, Typography, theme } from 'antd';
import { Block, Inline, parseMarkdown } from './markdown';

const { Title, Paragraph, Text, Link } = Typography;

type Token = ReturnType<typeof theme.useToken>['token'];

function renderInline(nodes: Inline[]): React.ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <React.Fragment key={i}>{node.text}</React.Fragment>;
      case 'strong':
        return <Text key={i} strong>{renderInline(node.children)}</Text>;
      case 'em':
        return <Text key={i} italic>{renderInline(node.children)}</Text>;
      case 'code':
        return <Text key={i} code>{node.text}</Text>;
      case 'link':
        return /^https?:\/\//i.test(node.href)
          ? <Link key={i} href={node.href} target="_blank" rel="noopener noreferrer">{renderInline(node.children)}</Link>
          : <Text key={i} underline>{renderInline(node.children)}</Text>;
    }
  });
}

function renderBlock(block: Block, key: number, token: Token): React.ReactNode {
  switch (block.type) {
    case 'heading': {
      // Typography.Title has levels 1–5; h6 is shown as a level-5 title
      const level = Math.min(block.level, 5) as 1 | 2 | 3 | 4 | 5;
      return (
        <React.Fragment key={key}>
          <Title level={level} style={{ marginTop: token.marginLG, marginBottom: token.marginXS }}>
            {renderInline(block.children)}
          </Title>
          {block.level <= 2 && <Divider style={{ margin: `0 0 ${token.marginSM}px` }} />}
        </React.Fragment>
      );
    }
    case 'paragraph':
      return <Paragraph key={key} style={{ margin: `${token.marginXS}px 0` }}>{renderInline(block.children)}</Paragraph>;
    case 'list': {
      const items = block.items.map((item, i) => <li key={i}>{renderInline(item)}</li>);
      return (
        <Paragraph key={key} style={{ margin: `${token.marginXS}px 0` }}>
          {block.ordered
            ? <ol start={block.start} style={{ paddingLeft: 24, margin: 0 }}>{items}</ol>
            : <ul style={{ paddingLeft: 24, margin: 0 }}>{items}</ul>}
        </Paragraph>
      );
    }
    case 'table':
      return (
        <Table
          key={key}
          size="small"
          bordered
          pagination={false}
          scroll={{ x: 'max-content' }}
          style={{ margin: `${token.marginXS}px 0` }}
          rowKey="__row"
          columns={block.header.map((cell, c) => ({
            key: c,
            title: renderInline(cell),
            dataIndex: c,
            align: (block.align[c] || 'left') as 'left' | 'center' | 'right',
            render: (value: Inline[]) => renderInline(value ?? []),
          }))}
          dataSource={block.rows.map((row, r) => ({ __row: r, ...Object.fromEntries(row.map((cell, c) => [c, cell])) }))}
        />
      );
    case 'code':
      return (
        <pre
          key={key}
          style={{
            background: token.colorFillQuaternary,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadius,
            padding: token.paddingSM,
            fontSize: token.fontSizeSM,
            fontFamily: token.fontFamilyCode,
            overflow: 'auto',
            margin: `${token.marginXS}px 0`,
          }}
        >
          <code>{block.text}</code>
        </pre>
      );
    case 'quote':
      return (
        <blockquote
          key={key}
          style={{
            borderInlineStart: `3px solid ${token.colorBorder}`,
            margin: `${token.marginXS}px 0`,
            padding: `0 ${token.paddingSM}px`,
            color: token.colorTextSecondary,
          }}
        >
          {block.children.map((child, i) => renderBlock(child, i, token))}
        </blockquote>
      );
    case 'rule':
      return <Divider key={key} />;
  }
}

/** Renders generated Markdown as Ant Design Typography, Table and Divider elements (no HTML injection) */
export const MarkdownView: React.FC<{ source: string }> = ({ source }) => {
  const { token } = theme.useToken();
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return <Typography style={{ lineHeight: 1.7 }}>{blocks.map((block, i) => renderBlock(block, i, token))}</Typography>;
};
