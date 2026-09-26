import { useColorScheme } from 'react-native';

const lightColors = {
  background: '#FAFAF8',
  surface: '#FFFFFF',
  border: '#E5E4E0',
  textPrimary: '#1C1C1E',
  textSecondary: '#7A7A78',
  accent: '#2F6FED',
  accentText: '#FFFFFF',
  placeholder: '#B0AFAC',
};

const darkColors = {
  background: '#121212',
  surface: '#1C1C1E',
  border: '#2E2E2E',
  textPrimary: '#F2F2F0',
  textSecondary: '#9A9A98',
  accent: '#5B93FF',
  accentText: '#0B0B0B',
  placeholder: '#5C5C5A',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

export const typography = {
  title: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18 },
  editor: { fontSize: 17, fontWeight: '400' as const, lineHeight: 26 },
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    spacing,
    radius,
    typography,
  };
}
