import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, Card, Form, InputNumber, Input, Select, Skeleton, Space, Switch, Tag, Typography, theme } from 'antd';
import { ApartmentOutlined, BranchesOutlined } from '@ant-design/icons';
import { WorkflowTemplateParameter } from '@ai-corp/shared-types';
import { useTemplatePreview, useWorkflowTemplates } from '../../lib/api/hooks/workflows';
import { parameterDefaults, templateOutline } from './templateOutline';
import { roleColor } from '../../theme/palette';

const { Text } = Typography;

/** Value of the "no template" option: the platform's default workflow */
export const DEFAULT_WORKFLOW = '__default__';
export const DEFAULT_TEMPLATE_ID = 'ooad-software-project';

const ParameterInput: React.FC<{ param: WorkflowTemplateParameter }> = ({ param }) => {
  const label = param.label;
  const common = { name: ['templateParams', param.name], label, tooltip: param.description, style: { marginBottom: 12 } };
  switch (param.type) {
    case 'boolean':
      return <Form.Item {...common} valuePropName="checked"><Switch /></Form.Item>;
    case 'number':
      return <Form.Item {...common} rules={[{ required: param.required }]}><InputNumber min={param.min} max={param.max} style={{ width: 120 }} /></Form.Item>;
    case 'enum':
      return (
        <Form.Item {...common} rules={[{ required: param.required }]}>
          <Select options={(param.options || []).map(o => ({ value: o, label: o }))} style={{ width: 200 }} />
        </Form.Item>
      );
    default:
      return <Form.Item {...common} rules={[{ required: param.required }]}><Input allowClear /></Form.Item>;
  }
};

/**
 * Workflow choice for a new project (Task 19): template, its parameters, and a preview of the
 * nodes it will run with sub-workflows and parallel branches expanded. Lives inside the create form
 * and writes `templateId` and `templateParams`.
 */
export const TemplatePicker: React.FC = () => {
  const form = Form.useFormInstance();
  const { data: templates = [], isLoading } = useWorkflowTemplates();
  const templateId: string | undefined = Form.useWatch('templateId', form);
  const rawParams = Form.useWatch('templateParams', form);
  const params = rawParams || {};
  const template = templates.find(t => t.id === templateId);
  const shownTemplate = useRef<string | undefined>();

  // Fill in the template's defaults when the template changes or the form was reset
  useEffect(() => {
    if (!template) return;
    if (shownTemplate.current !== template.id || rawParams === undefined) {
      shownTemplate.current = template.id;
      form.setFieldValue('templateParams', parameterDefaults(template.parameters));
    }
  }, [template, rawParams, form]);

  const previewParams = useMemo(() => (template ? { ...parameterDefaults(template.parameters), ...params } : {}), [template, JSON.stringify(params)]);
  const preview = useTemplatePreview(template?.id, previewParams);
  const outline = useMemo(() => (preview.data ? templateOutline(preview.data) : []), [preview.data]);

  const { token } = theme.useToken();
  if (isLoading) return <Skeleton active paragraph={{ rows: 1 }} />;

  return (
    <>
      <Form.Item name="templateId" label="Workflow" initialValue={DEFAULT_TEMPLATE_ID}>
        <Select
          options={[
            ...templates.map(t => ({ value: t.id, label: t.name })),
            { value: DEFAULT_WORKFLOW, label: 'Default workflow (no template)' },
          ]}
        />
      </Form.Item>

      {template && (
        <Card size="small" style={{ marginBottom: token.margin }} styles={{ body: { paddingBottom: token.paddingXS } }}>
          <Text type="secondary" style={{ fontSize: token.fontSizeSM, display: 'block', marginBottom: token.marginSM }}>{template.description}</Text>
          {template.parameters.map(p => <ParameterInput key={p.name} param={p} />)}

          <Text strong style={{ fontSize: token.fontSizeSM, display: 'block', margin: '4px 0 6px' }}>Preview</Text>
          {preview.isError ? (
            <Alert type="error" showIcon title={(preview.error as any)?.response?.data?.message || 'Invalid parameters'} />
          ) : !preview.data ? (
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <div
              aria-label="Workflow preview"
              style={{ background: token.colorFillQuaternary, borderRadius: token.borderRadius, padding: token.paddingXS, maxHeight: 220, overflow: 'auto', marginBottom: token.marginXS }}
            >
              <Space size={4} style={{ marginBottom: 6 }}>
                <Tag color="purple" variant="outlined">{preview.data.definition.id}@{preview.data.definition.version}</Tag>
              </Space>
              {outline.map(row => (
                <div key={row.key} style={{ paddingLeft: row.depth * 16, fontSize: token.fontSizeSM, lineHeight: '22px' }}>
                  {row.type === 'sub_workflow' && <ApartmentOutlined style={{ color: token.purple6, marginRight: 6 }} />}
                  {row.type === 'parallel' && <BranchesOutlined style={{ color: token.colorPrimary, marginRight: 6 }} />}
                  {row.label}
                  {row.role && <Tag color={roleColor(row.role)} style={{ marginInlineStart: 6, fontSize: 10, lineHeight: '16px' }}>{row.role}</Tag>}
                  {!row.role && row.type !== 'agent_task' && <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>{row.type.replace('_', ' ')}</Text>}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </>
  );
};
