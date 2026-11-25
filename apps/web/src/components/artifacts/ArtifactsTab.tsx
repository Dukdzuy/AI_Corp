import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Empty, Flex, Grid, Input, Skeleton, Splitter, Tree, Typography, theme } from 'antd';
import { DownloadOutlined, FileMarkdownOutlined, FileOutlined, FileTextOutlined, PartitionOutlined, CodeOutlined } from '@ant-design/icons';
import {
  ArtifactKind,
  downloadProjectArchive,
  useOoadMetrics,
  useProjectFile,
  useProjectFiles,
  useQualityGates,
} from '../../lib/api/hooks/artifacts';
import { buildFileTree, defaultFile, FileTreeNode, folderKeys, formatSize } from './fileTree';
import { latestGates, GateView, WarningView } from './qualityGate';
import { ArtifactViewer } from './ArtifactViewer';
import { OoadSummary, QualityGateList, QualityWarnings } from './QualityPanel';

const { Text } = Typography;

const KIND_ICONS: Record<ArtifactKind, React.ReactNode> = {
  markdown: <FileMarkdownOutlined style={{ color: '#1677ff' }} />,
  plantuml: <PartitionOutlined style={{ color: '#9254de' }} />,
  code: <CodeOutlined style={{ color: '#fa8c16' }} />,
  json: <FileTextOutlined style={{ color: '#52c41a' }} />,
  text: <FileOutlined />,
};

const toTreeData = (nodes: FileTreeNode[], filter: string): any[] =>
  nodes
    .map(n => {
      const children = n.children ? toTreeData(n.children, filter) : undefined;
      const match = !filter || n.title.toLowerCase().includes(filter);
      if (n.isLeaf ? !match : !match && !children?.length) return null;
      return {
        key: n.key,
        title: n.isLeaf ? (
          <span>
            {n.title}
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{formatSize(n.size || 0)}</Text>
          </span>
        ) : (
          <Text strong>{n.title}</Text>
        ),
        icon: n.isLeaf ? KIND_ICONS[n.kind || 'text'] : undefined,
        isLeaf: n.isLeaf,
        selectable: n.isLeaf,
        children,
      };
    })
    .filter(Boolean);

interface Props {
  projectId: string;
  projectName: string;
  liveGates: GateView[];
  liveWarnings: WarningView[];
}

/**
 * Artifacts tab (Phase 3, Task 13): everything the agents generated for the project, i.e. the
 * use cases, diagrams, code, tests and traceability matrix, plus the quality gate checklist,
 * QC warnings and the OOAD summary.
 */
export const ArtifactsTab: React.FC<Props> = ({ projectId, projectName, liveGates, liveWarnings }) => {
  const { data, isLoading } = useProjectFiles(projectId);
  const { data: gateHistory = [] } = useQualityGates(projectId);
  const { data: metrics } = useOoadMetrics(projectId);
  const files = data?.files || [];
  const [selected, setSelected] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const fileQuery = useProjectFile(projectId, selected);
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const [filter, setFilter] = useState('');

  const tree = useMemo(() => buildFileTree(files), [files]);
  const treeData = useMemo(() => toTreeData(tree, filter.trim().toLowerCase()), [tree, filter]);
  const gates = useMemo(() => latestGates(gateHistory, liveGates), [gateHistory, liveGates]);

  useEffect(() => {
    if (!selected || !files.some(f => f.path === selected)) setSelected(defaultFile(files));
  }, [files, selected]);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadProjectArchive(projectId, `${projectName || projectId}.zip`);
    } catch {
      message.error('Could not download the project archive');
    } finally {
      setDownloading(false);
    }
  };

  const treePanel = (
    <Card
      size="small"
      style={{ height: '100%' }}
      title={`${files.length} files · ${formatSize(data?.totalSize || 0)}`}
      extra={<Button size="small" type="primary" ghost icon={<DownloadOutlined />} loading={downloading} onClick={download}>Download zip</Button>}
    >
      <Input.Search size="small" allowClear placeholder="Filter files" value={filter} onChange={e => setFilter(e.target.value)} style={{ marginBottom: token.marginXS }} />
      <Tree
        showIcon
        blockNode
        showLine
        defaultExpandedKeys={folderKeys(tree)}
        selectedKeys={selected ? [selected] : []}
        onSelect={keys => keys[0] && setSelected(String(keys[0]))}
        treeData={treeData}
        style={{ background: 'transparent', maxHeight: 640, overflow: 'auto' }}
      />
    </Card>
  );
  const viewerPanel = (
    <Card size="small" style={{ minHeight: 300, height: '100%' }}>
      <ArtifactViewer file={fileQuery.data} loading={fileQuery.isLoading && !!selected} error={fileQuery.error} />
    </Card>
  );

  return (
    <Flex vertical gap={16}>
      <QualityWarnings warnings={liveWarnings} />
      <OoadSummary metrics={metrics} />
      <QualityGateList gates={gates} />

      {isLoading ? (
        <Card><Skeleton active paragraph={{ rows: 6 }} /></Card>
      ) : files.length === 0 ? (
        <Card><Empty description="No generated files yet. The BA and Architect write them in the first workflow steps." /></Card>
      ) : screens.md ? (
        <Splitter style={{ minHeight: 480 }}>
          <Splitter.Panel defaultSize="30%" min="18%" max="50%" style={{ paddingInlineEnd: token.paddingXS }}>
            {treePanel}
          </Splitter.Panel>
          <Splitter.Panel style={{ paddingInlineStart: token.paddingXS }}>{viewerPanel}</Splitter.Panel>
        </Splitter>
      ) : (
        <Flex vertical gap={16}>
          {treePanel}
          {viewerPanel}
        </Flex>
      )}
    </Flex>
  );
};
