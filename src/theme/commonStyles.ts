import { StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { colors } from './colors';

// Use light theme as default for static styles
const defaultColors = colors.light;

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: defaultColors.background,
  },
  contentContainer: {
    flexGrow: 1,
    padding: theme.spacing.m,
    justifyContent: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: theme.spacing.m,
  },
  input: {
    backgroundColor: defaultColors.input,
    borderWidth: 1,
    borderColor: defaultColors.inputBorder,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    fontSize: theme.typography.fontSize.body,
    fontFamily: theme.typography.fonts.regular,
  },
  button: {
    backgroundColor: defaultColors.primary,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
    marginVertical: theme.spacing.s,
  },
  buttonText: {
    color: defaultColors.onPrimary,
    fontSize: theme.typography.fontSize.button,
    fontWeight: theme.typography.fontWeight.bold,
    fontFamily: theme.typography.fonts.semiBold,
  },
  buttonDisabled: {
    backgroundColor: defaultColors.disabled,
  },
  link: {
    padding: theme.spacing.s,
  },
  linkButton: {
    marginTop: theme.spacing.m,
    alignItems: 'center',
  },
  linkText: {
    color: defaultColors.primary,
    fontSize: theme.typography.fontSize.body,
    textDecorationLine: 'underline',
    fontFamily: theme.typography.fonts.medium,
  },
  title: {
    fontSize: theme.typography.fontSize.h2,
    fontWeight: theme.typography.fontWeight.bold,
    color: defaultColors.text,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
    fontFamily: theme.typography.fonts.bold,
  },
  error: {
    color: defaultColors.error,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
    fontFamily: theme.typography.fonts.medium,
  },
});

// Helper function to get dynamic styles based on current theme
export function getDynamicStyles(isDark: boolean) {
  const currentColors = isDark ? colors.dark : colors.light;
  
  return {
    container: {
      backgroundColor: currentColors.background,
    },
    input: {
      backgroundColor: currentColors.input,
      borderColor: currentColors.inputBorder,
    },
    button: {
      backgroundColor: currentColors.primary,
    },
    buttonText: {
      color: currentColors.onPrimary,
    },
    buttonDisabled: {
      backgroundColor: currentColors.disabled,
    },
    linkText: {
      color: currentColors.primary,
    },
    title: {
      color: currentColors.text,
    },
    error: {
      color: currentColors.error,
    },
  };
} 