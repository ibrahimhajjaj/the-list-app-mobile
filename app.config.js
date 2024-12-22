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
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.ibrahimwithi.thelistapp'
  },
  web: {
    favicon: './assets/favicon.png'
  },
  extra: {
    API_URL: process.env.API_URL,
  },
  plugins: [
    'expo-secure-store'
  ],
  newArchEnabled: true
}; 