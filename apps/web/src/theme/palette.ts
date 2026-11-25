/**
 * Semantic colours of the app, expressed as Ant Design preset colour names so that Tag, Badge,
 * Avatar and charts pick the right shade for the light or the dark algorithm.
 * Hex values come from `@ant-design/colors` (the 6th shade = the preset's primary).
 */
import { presetPalettes, presetDarkPalettes } from '@ant-design/colors';

export type PresetColor =
  | 'blue' | 'purple' | 'cyan' | 'green' | 'magenta' | 'red' | 'orange'
  | 'gold' | 'lime' | 'geekblue' | 'volcano' | 'yellow' | 'grey';

/** One colour per agent role, used for avatars, tags and chart series */
export const ROLE_COLOR: Record<string, PresetColor> = {
  CEO: 'gold',
  BA: 'cyan',
  ARCHITECT: 'purple',
  PM: 'blue',
  DEV: 'green',
  QC: 'volcano',
  QA: 'magenta',
  MARKETING: 'orange',
  DEVOPS: 'geekblue',
  SYSTEM: 'grey',
  USER: 'geekblue',
};

export function roleColor(role?: string | null): PresetColor {
  return (role && ROLE_COLOR[role.toUpperCase()]) || 'geekblue';
}

/** Hex of a preset colour for places that need a raw value (charts, avatars, borders) */
export function presetHex(color: PresetColor, dark = false, shade = 5): string {
  const palette = (dark ? presetDarkPalettes : presetPalettes)[color];
  return palette?.[shade] ?? palette?.primary ?? '#1677ff';
}

export function roleHex(role: string | null | undefined, dark = false): string {
  return presetHex(roleColor(role), dark);
}

/** Tag colour of a project / workflow / step / task status (Tag `color` accepts these names) */
export const STATUS_COLOR: Record<string, string> = {
  active: 'processing',
  running: 'processing',
  in_progress: 'processing',
  pending: 'default',
  todo: 'default',
  waiting: 'warning',
  waiting_approval: 'warning',
  review: 'warning',
  paused: 'warning',
  completed: 'success',
  done: 'success',
  approved: 'success',
  passed: 'success',
  failed: 'error',
  rejected: 'error',
  cancelled: 'default',
  skipped: 'default',
};

export function statusColor(status?: string | null): string {
  return (status && STATUS_COLOR[status]) || 'default';
}

/** Tag colour of a task priority */
export const PRIORITY_COLOR: Record<string, PresetColor> = {
  high: 'red',
  medium: 'gold',
  low: 'green',
};
