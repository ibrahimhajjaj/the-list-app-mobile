export default {
	name: 'The List App',
	slug: 'the-list-app',
	version: '1.0.0',
	orientation: 'portrait',
	icon: './assets/icon.png',
	userInterfaceStyle: 'automatic',
	splash: {
	  image: './assets/splash.png',
	  resizeMode: 'contain',
	  backgroundColor: '#ffffff'
	},
	assetBundlePatterns: [
	  '**/*'
	],
	ios: {
	  supportsTablet: true,
	  bundleIdentifier: 'com.ibrahimwithi.thelistapp'
	},
	android: {
	  adaptiveIcon: {
		foregroundImage: './assets/icon.png',
		backgroundColor: '#ffffff'
	  },
	  package: 'com.ibrahimwithi.thelistapp',
	  permissions: [
		'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'
	  ],
	  intentFilters: [
		{
		  action: 'android.intent.action.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
		  data: {
			scheme: 'package',
			host: 'com.ibrahimwithi.thelistapp'
		  },
		  category: ['android.intent.category.DEFAULT']
		}
	  ],
	  googleServicesFile: './google-services.json'
	},
	web: {
	  favicon: './assets/favicon.png'
	},
	extra: {
	  API_URL: process.env.API_URL,
	  WS_URL: process.env.WS_URL,
	  EXPO_PROJECT_ID: process.env.EXPO_PROJECT_ID,
	  eas: {
		projectId: process.env.EXPO_PROJECT_ID
	  }
	},
	owner: "ibrahimwithi",
	scheme: "thelistapp",
	plugins: [
	  'expo-secure-store',
	  'expo-splash-screen',
	  'expo-notifications',
	  'expo-system-ui',
	  'expo-sqlite',
	  [
		'expo-font',
		{
		  fonts: [
			'./assets/fonts/Poppins/Poppins-Regular.ttf',
			'./assets/fonts/Poppins/Poppins-Medium.ttf',
			'./assets/fonts/Poppins/Poppins-SemiBold.ttf',
			'./assets/fonts/Poppins/Poppins-Bold.ttf'
		  ]
		}
	  ]
	],
	newArchEnabled: true
  };