import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: 'TaskLine',
  slug: 'taskline-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'taskline',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#f9fafb',
    dark: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0f172a',
    },
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.solvrlabs.taskline',
    buildNumber: '1',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'TaskLine uses your location to show property and client addresses on maps.',
      NSFaceIDUsageDescription:
        'TaskLine uses Face ID to quickly unlock the app and protect your data.',
    },
    config: {
      googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
  },
  android: {
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#2563eb',
    },
    package: 'com.solvrlabs.taskline',
    versionCode: 1,
    config: {
      googleMaps: {
        apiKey: GOOGLE_MAPS_API_KEY,
      },
    },
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-local-authentication',
    'expo-localization',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#2563eb',
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG ?? 'solvr-labs',
        project: process.env.SENTRY_PROJECT ?? 'taskline-mobile',
      },
    ],
  ],
  extra: {
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    router: {
      origin: false,
    },
    eas: {
      projectId: '6667d037-c647-46c5-8c6e-52829de8ef66',
    },
  },
  owner: 'jesuspadres',
});
