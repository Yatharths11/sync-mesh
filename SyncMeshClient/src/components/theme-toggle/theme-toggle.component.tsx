import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { useThemeModeStore } from '../../store/theme-mode.store';

export function ThemeToggle() {
  const { colors } = useTheme();
  const mode = useThemeModeStore((state) => state.mode);
  const setMode = useThemeModeStore((state) => state.setMode);

  return (
    <Pressable
      style={[
        styles.button,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
    >
      <Text>{mode === 'dark' ? '☀️' : '🌙'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
