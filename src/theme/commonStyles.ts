import { StyleSheet } from 'react-native';
import { theme } from '../constants/theme';

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.m,
    padding: theme.spacing.m,
    marginBottom: theme.spacing.m,
    fontSize: theme.typography.fontSize.body,
  },
  button: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.m,
    borderRadius: theme.borderRadius.m,
    alignItems: 'center',
    marginVertical: theme.spacing.s,
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.fontSize.button,
    fontWeight: theme.typography.fontWeight.bold,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.disabled,
  },
  link: {
    padding: theme.spacing.s,
  },
  linkButton: {
    marginTop: theme.spacing.m,
    alignItems: 'center',
  },
  linkText: {
    color: theme.colors.primary,
    fontSize: theme.typography.fontSize.body,
    textDecorationLine: 'underline',
  },
  title: {
    fontSize: theme.typography.fontSize.h2,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
  },
  error: {
    color: theme.colors.error,
    marginBottom: theme.spacing.m,
    textAlign: 'center',
  },
}); 