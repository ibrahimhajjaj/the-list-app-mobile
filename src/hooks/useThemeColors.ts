import { useColorScheme } from 'react-native';
import { colors, ThemeColors } from '../theme/colors';

export function useThemeColors(): ThemeColors {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? colors.dark : colors.light;
} 