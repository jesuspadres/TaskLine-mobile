/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|@supabase/.*|zustand|i18n-js|react-native-qrcode-svg|react-native-svg|react-native-reanimated|react-native-gesture-handler|react-native-maps|react-native-url-polyfill)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.(test|spec).(ts|tsx)',
    '**/*.(test|spec).(ts|tsx)',
  ],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'stores/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/index.tsx',
    '!lib/database.types.ts',
    '!lib/env.ts',
    '!lib/env.example.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 15,
      lines: 18,
      statements: 18,
    },
    './hooks/': {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './stores/': {
      branches: 85,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  // Let jest-expo preset control the test environment
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
