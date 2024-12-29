import { colors, ThemeColors } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';

export function useThemeColors(): ThemeColors {
  const { isDark } = useTheme();
  return isDark ? colors.dark : colors.light;
} 