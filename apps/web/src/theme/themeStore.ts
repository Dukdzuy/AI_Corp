import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  /** Light, dark, or follow the operating system */
  mode: ThemeMode;
  /** Ant Design compact algorithm: denser tables and forms */
  compact: boolean;
  /** Whether the side menu is collapsed to icons */
  siderCollapsed: boolean;
  setMode: (mode: ThemeMode) => void;
  setCompact: (compact: boolean) => void;
  setSiderCollapsed: (collapsed: boolean) => void;
}

/** The viewer's look-and-feel choices, kept in this browser */
export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      mode: 'dark',
      compact: false,
      siderCollapsed: false,
      setMode: mode => set({ mode }),
      setCompact: compact => set({ compact }),
      setSiderCollapsed: siderCollapsed => set({ siderCollapsed }),
    }),
    { name: 'ui-theme' },
  ),
);
