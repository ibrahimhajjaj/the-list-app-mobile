export const lightColors = {
	// Base colors
	background: 'hsl(0, 0%, 100%)',          // White
	foreground: 'hsl(222.2, 84%, 4.9%)',     // Near Black
	destructive: 'hsl(0, 84.2%, 60.2%)',     // Red
	destructiveForeground: 'hsl(210, 40%, 98%)', // Light Blue
  
	surface: '#FFFFFF',
	text: '#000000',
	textLight: '#666666',
	
	// Primary colors
	primary: 'hsl(222.2, 47.4%, 11.2%)',     // Dark Blue
	primaryForeground: 'hsl(210, 40%, 98%)', // Light Blue
	
	// Secondary colors
	secondary: 'hsl(210, 40%, 96.1%)',       // Light Gray
	secondaryForeground: 'hsl(222.2, 47.4%, 11.2%)', // Dark Blue
	
	// Accent colors
	muted: 'hsl(210, 40%, 96.1%)',           // Light Gray
	mutedForeground: 'hsl(215.4, 16.3%, 46.9%)', // Medium Gray
	accent: 'hsl(210, 40%, 96.1%)',          // Light Gray
	accentForeground: 'hsl(222.2, 47.4%, 11.2%)', // Dark Blue
	
	// Status colors
	error: '#FF3B30',
	success: '#34C759',
	warning: '#FFCC00',
	info: '#5856D6',
	
	// UI elements
	border: 'hsl(214.3, 31.8%, 91.4%)',      // Very Light Gray
	disabled: '#C7C7CC',
	divider: '#C6C6C8',
	
	// Card and surface colors
	card: 'hsl(0, 0%, 100%)',                // White
	cardForeground: 'hsl(222.2, 84%, 4.9%)', // Near Black
	popover: 'hsl(0, 0%, 100%)',             // White
	popoverForeground: 'hsl(222.2, 84%, 4.9%)', // Near Black
	
	// Input colors
	input: 'hsl(214.3, 31.8%, 91.4%)',       // Very Light Gray
	ring: 'hsl(222.2, 84%, 4.9%)',           // Near Black
	placeholder: '#C7C7CC',
  };
  
  export const darkColors = {
	background: 'hsl(222.2, 84%, 4.9%)',     // Near Black
	foreground: 'hsl(210, 40%, 98%)',        // Light Blue
	primary: 'hsl(210, 40%, 98%)',           // Light Blue
	primaryForeground: 'hsl(222.2, 47.4%, 11.2%)', // Dark Blue
	secondary: 'hsl(217.2, 32.6%, 17.5%)',   // Dark Gray
	secondaryForeground: 'hsl(210, 40%, 98%)', // Light Blue
	muted: 'hsl(217.2, 32.6%, 17.5%)',       // Dark Gray
	mutedForeground: 'hsl(215, 20.2%, 65.1%)', // Medium Gray
	destructive: 'hsl(0, 62.8%, 30.6%)',     // Dark Red
	destructiveForeground: 'hsl(210, 40%, 98%)', // Light Blue
	onSecondary: '#FFFFFF',
	
	// Accent colors
	accent: 'hsl(217.2, 32.6%, 17.5%)',      // Dark Gray
	accentForeground: 'hsl(210, 40%, 98%)',  // Light Blue
	onAccent: '#FFFFFF',
	
	// Status colors
	error: '#FF453A',
	success: '#32D74B',
	warning: '#FFD60A',
	info: '#5E5CE6',
	
	// UI elements
	border: 'hsl(217.2, 32.6%, 25%)',        // Darker gray for better contrast in dark mode
	ring: 'hsl(212.7, 26.8%, 83.9%)',        // Light Gray	// Secondary colors
	disabled: '#3A3A3C',
	divider: '#38383A',
	
	// Card and surface colors
	card: 'hsl(222.2, 84%, 4.9%)',           // Near Black
	cardForeground: 'hsl(210, 40%, 98%)',    // Light Blue
	popover: 'hsl(222.2, 84%, 4.9%)',        // Near Black
	popoverForeground: 'hsl(210, 40%, 98%)', // Light Blue
	
	// Input colors
	input: 'hsl(217.2, 32.6%, 17.5%)',       // Dark Gray
	inputBorder: '#38383A',
	placeholder: '#8E8E93',
  };
  
  export type ThemeColors = typeof lightColors;
  
  export const colors = {
	light: lightColors,
	dark: darkColors,
  }; 