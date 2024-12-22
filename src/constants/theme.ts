import { StyleSheet } from 'react-native';

export const theme = {
  colors: {
    primary: '#0f172a',
    primaryDark: '#0056B3',
    secondary: '#5856D6',
    success: '#34C759',
    warning: '#FF9500',
    error: '#ef4444',
    background: '#FFFFFF',
    surface: '#F2F2F7',
    text: '#000000',
    textSecondary: '#666666',
    disabled: '#C7C7CC',
    border: '#E5E5EA',
    accent: '#f1f5f9',
    onPrimary: '#FFFFFF',
  },
  typography: {
    fontSize: {
      h1: 32,
      h2: 24,
      h3: 20,
      body: 16,
      button: 16,
      caption: 14,
      small: 12,
    },
    fontWeight: {
      regular: '400',
      medium: '500',
      bold: '700',
    },
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 16,
    xl: 24,
    round: 9999,
  },
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 6,
      },
      shadowOpacity: 0.37,
      shadowRadius: 7.49,
      elevation: 6,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 3,
    },
  },
  buttons: {
    sizes: {
      default: {
        height: 36,
        paddingHorizontal: 12,
      },
      large: {
        height: 48,
        paddingHorizontal: 16,
      },
    },
    outline: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 6,
      height: 36,
      paddingHorizontal: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    destructive: {
      backgroundColor: '#ef4444',
      borderRadius: 6,
      height: 36,
      paddingHorizontal: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }
  },
} as const;

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.m,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    backgroundColor: theme.colors.surface,
  },
  button: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: theme.spacing.m,
    color: theme.colors.text,
  },
  error: {
    color: theme.colors.error,
    marginBottom: theme.spacing.m,
  },
  link: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
}); 