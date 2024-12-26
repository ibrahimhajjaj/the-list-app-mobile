export default {
  name: 'The List App',
  slug: 'the-list-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
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
    ]
  },
  web: {
    favicon: './assets/favicon.png'
  },
  extra: {
    API_URL: process.env.API_URL,
  },
  plugins: [
    'expo-secure-store',
    'expo-splash-screen',
    'expo-notifications',
    'expo-system-ui'
  ],
  newArchEnabled: true
};