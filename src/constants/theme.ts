import { StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export const fonts = {
  regular: 'Poppins-Regular',
  medium: 'Poppins-Medium',
  semiBold: 'Poppins-SemiBold',
  bold: 'Poppins-Bold',
};

const lightColors = {
  background: 'hsl(0, 0%, 100%)',          // White
  foreground: 'hsl(222.2, 84%, 4.9%)',     // Near Black
  card: 'hsl(0, 0%, 100%)',                // White
  cardForeground: 'hsl(222.2, 84%, 4.9%)', // Near Black
  popover: 'hsl(0, 0%, 100%)',             // White
  popoverForeground: 'hsl(222.2, 84%, 4.9%)', // Near Black
  primary: 'hsl(222.2, 47.4%, 11.2%)',     // Dark Blue
  primaryForeground: 'hsl(210, 40%, 98%)', // Light Blue
  secondary: 'hsl(210, 40%, 96.1%)',       // Light Gray
  secondaryForeground: 'hsl(222.2, 47.4%, 11.2%)', // Dark Blue
  muted: 'hsl(210, 40%, 96.1%)',           // Light Gray
  mutedForeground: 'hsl(215.4, 16.3%, 46.9%)', // Medium Gray
  accent: 'hsl(210, 40%, 96.1%)',          // Light Gray
  accentForeground: 'hsl(222.2, 47.4%, 11.2%)', // Dark Blue
  destructive: 'hsl(0, 84.2%, 60.2%)',     // Red
  destructiveForeground: 'hsl(210, 40%, 98%)', // Light Blue
  border: 'hsl(214.3, 31.8%, 91.4%)',      // Very Light Gray
  input: 'hsl(214.3, 31.8%, 91.4%)',       // Very Light Gray
  ring: 'hsl(222.2, 84%, 4.9%)',           // Near Black
};

const darkColors = {
  background: 'hsl(222.2, 84%, 4.9%)',     // Near Black
  foreground: 'hsl(210, 40%, 98%)',        // Light Blue
  card: 'hsl(222.2, 84%, 4.9%)',           // Near Black
  cardForeground: 'hsl(210, 40%, 98%)',    // Light Blue
  popover: 'hsl(222.2, 84%, 4.9%)',        // Near Black
  popoverForeground: 'hsl(210, 40%, 98%)', // Light Blue
  primary: 'hsl(210, 40%, 98%)',           // Light Blue
  primaryForeground: 'hsl(222.2, 47.4%, 11.2%)', // Dark Blue
  secondary: 'hsl(217.2, 32.6%, 17.5%)',   // Dark Gray
  secondaryForeground: 'hsl(210, 40%, 98%)', // Light Blue
  muted: 'hsl(217.2, 32.6%, 17.5%)',       // Dark Gray
  mutedForeground: 'hsl(215, 20.2%, 65.1%)', // Medium Gray
  accent: 'hsl(217.2, 32.6%, 17.5%)',      // Dark Gray
  accentForeground: 'hsl(210, 40%, 98%)',  // Light Blue
  destructive: 'hsl(0, 62.8%, 30.6%)',     // Dark Red
  destructiveForeground: 'hsl(210, 40%, 98%)', // Light Blue
  border: 'hsl(217.2, 32.6%, 25%)',        // Darker gray for better contrast in dark mode
  input: 'hsl(217.2, 32.6%, 17.5%)',       // Dark Gray
  ring: 'hsl(212.7, 26.8%, 83.9%)',        // Light Gray
};

export const theme = {
  colors: {
    light: lightColors,
    dark: darkColors,
  },
  typography: {
    fonts,
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
    xxl: 48,
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
      borderWidth: 1,
      borderRadius: 6,
      height: 36,
      paddingHorizontal: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    destructive: {
      borderRadius: 6,
      height: 36,
      paddingHorizontal: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }
  },
} as const;

// Create a hook to get the current theme colors
export const useThemeColors = () => {
  const { isDark } = useTheme();
  return isDark ? theme.colors.dark : theme.colors.light;
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.m,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: theme.borderRadius.m,
    paddingHorizontal: theme.spacing.m,
    marginBottom: theme.spacing.m,
    fontFamily: fonts.regular,
  },
  button: {
    height: 48,
    borderRadius: theme.borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: fonts.semiBold,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.bold,
    marginBottom: theme.spacing.m,
  },
  error: {
    marginBottom: theme.spacing.m,
    fontFamily: fonts.medium,
  },
  link: {
    textDecorationLine: 'underline',
    fontFamily: fonts.medium,
  },
}); 