export const lightColors = {
  // Base colors
  background: '#F2F2F7',
  surface: '#FFFFFF',
  text: '#000000',
  textLight: '#666666',
  
  // Primary colors
  primary: '#007AFF',
  onPrimary: '#FFFFFF',
  primaryLight: '#5AA9FF',
  
  // Secondary colors
  secondary: '#5856D6',
  onSecondary: '#FFFFFF',
  
  // Accent colors
  accent: '#FF2D55',
  onAccent: '#FFFFFF',
  
  // Status colors
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FFCC00',
  info: '#5856D6',
  
  // UI elements
  border: '#E5E5EA',
  disabled: '#C7C7CC',
  divider: '#C6C6C8',
  
  // Card and surface colors
  card: '#FFFFFF',
  cardText: '#000000',
  
  // Input colors
  input: '#FFFFFF',
  inputBorder: '#E5E5EA',
  placeholder: '#C7C7CC',
};

export const darkColors = {
  // Base colors
  background: '#000000',
  surface: '#1C1C1E',
  text: '#FFFFFF',
  textLight: '#EBEBF5',
  
  // Primary colors
  primary: '#0A84FF',
  onPrimary: '#FFFFFF',
  primaryLight: '#5AA9FF',
  
  // Secondary colors
  secondary: '#5E5CE6',
  onSecondary: '#FFFFFF',
  
  // Accent colors
  accent: '#FF375F',
  onAccent: '#FFFFFF',
  
  // Status colors
  error: '#FF453A',
  success: '#32D74B',
  warning: '#FFD60A',
  info: '#5E5CE6',
  
  // UI elements
  border: '#38383A',
  disabled: '#3A3A3C',
  divider: '#38383A',
  
  // Card and surface colors
  card: '#1C1C1E',
  cardText: '#FFFFFF',
  
  // Input colors
  input: '#1C1C1E',
  inputBorder: '#38383A',
  placeholder: '#8E8E93',
};

export type ThemeColors = typeof lightColors;

export const colors = {
  light: lightColors,
  dark: darkColors,
}; 