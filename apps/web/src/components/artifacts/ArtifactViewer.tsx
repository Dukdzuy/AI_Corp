import React, { useEffect, useState } from 'react';
import { Alert, Empty, Flex, Image, Segmented, Skeleton, Space, Tag, Typography, theme } from 'antd';
import { FileOutlined } from '@ant-design/icons';
import { ArtifactContent } from '../../lib/api/hooks/artifacts';
import { MarkdownView } from './MarkdownView';
import { plantUmlSvgUrl } from './plantuml';
import { formatSize } from './fileTree';

const { Text } = Typography;

/** Source with line numbers on the theme's code colours, with a copy button */
const CodeBlock: React.FC<{ text: string }> = ({ text }) => {
  const { token } = theme.useToken();
  const lines = text.split('\n');
  const width = String(lines.length).length;
  return (
    <div style={{ position: 'relative' }}>
      <Text copyable={{ text }} style={{ position: 'absolute', top: 6, right: 10, zIndex: 1 }} />
      <pre
        style={{
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          padding: token.paddingSM,
          fontSize: token.fontSizeSM,
          fontFamily: token.fontFamilyCode,
          overflow: 'auto',
          maxHeight: 640,
          margin: 0,
          whiteSpace: 'pre',
        }}
      >
        {lines.map((line, i) => (
          <div key={i}>
            <span style={{ color: token.colorTextQuaternary, userSelect: 'none', display: 'inline-block', width: `${width + 1}ch` }}>{i + 1}</span>
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
};

const PlantUmlView: React.FC<{ source: string }> = ({ source }) => {
  const [mode, setMode] = useState<'diagram' | 'source'>('diagram');
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setUrl(undefined);
    plantUmlSvgUrl(source).then(u => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [source]);

  if (url === null) {
    return (
      <Flex vertical gap={8}>
        <Alert type="info" showIcon title="Diagram rendering is turned off (VITE_PLANTUML_SERVER is empty)." />
        <CodeBlock text={source} />
      </Flex>
    );
  }

  return (
    <Flex vertical gap={8}>
      <Segmented
        size="small"
        value={mode}
        onChange={v => setMode(v as 'diagram' | 'source')}
        options={[{ label: 'Diagram', value: 'diagram' }, { label: 'Source', value: 'source' }]}
      />
      {mode === 'source' ? (
        <CodeBlock text={source} />
      ) : url === undefined ? (
        <Skeleton.Image active style={{ width: 320, height: 200 }} />
      ) : failed ? (
        <Alert type="warning" showIcon title="The PlantUML server could not render this diagram" description="Check the source for syntax errors or the VITE_PLANTUML_SERVER setting." />
      ) : (
        <div style={{ background: '#ffffff', borderRadius: 6, padding: 12, overflow: 'auto', maxHeight: 720, textAlign: 'center' }}>
          {/* Ant Design Image: click to open the preview with zoom and rotate */}
          <Image src={url} alt="PlantUML diagram" style={{ maxWidth: '100%' }} onError={() => setFailed(true)} />
        </div>
      )}
    </Flex>
  );
};

export const ArtifactViewer: React.FC<{ file: ArtifactContent | undefined; loading: boolean; error?: unknown }> = ({ file, loading, error }) => {
  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (error) {
    const status = (error as any)?.response?.status;
    return (
      <Alert
        type="error"
        showIcon
        title={status === 413 ? 'This file is too large to preview; download the project archive instead.' : 'Could not load this file.'}
      />
    );
  }
  if (!file) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a file" />;

  let body: React.ReactNode;
  switch (file.kind) {
    case 'markdown':
      body = <MarkdownView source={file.content} />;
      break;
    case 'plantuml':
      body = <PlantUmlView source={file.content} />;
      break;
    case 'json': {
      let pretty = file.content;
      try {
        pretty = JSON.stringify(JSON.parse(file.content), null, 2);
      } catch {
        // show as-is
      }
      body = <CodeBlock text={pretty} />;
      break;
    }
    default:
      body = <CodeBlock text={file.content} />;
  }

  return (
    <Flex vertical gap={12}>
      <Space wrap>
        <FileOutlined />
        <Text code copyable={{ text: file.path }}>{file.path}</Text>
        <Tag color="blue">{file.kind}</Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>{formatSize(file.size)}</Text>
      </Space>
      {body}
    </Flex>
  );
};
