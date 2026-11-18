import { create } from 'zustand';
import { getSetting, setSetting } from '../db/settings';

type ThemeMode = 'light' | 'dark';

type ThemeModeState = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const useThemeModeStore = create<ThemeModeState>((set) => ({
  mode: 'light',

  setMode: (mode) => {
    set({ mode });
    setSetting('themeMode', mode);
  },
}));

/**
 * Reads the persisted theme mode from sqlite. Call once at boot (after
 * initDb() has run) to hydrate the store.
 */
function loadPersistedThemeMode(): ThemeMode | null {
  return getSetting('themeMode') as ThemeMode | null;
}

export { useThemeModeStore, loadPersistedThemeMode };
