/* global jest */
// ──────────────────────────────────────────────
// Global test setup — mocks for native modules
// ──────────────────────────────────────────────

// ── expo-haptics ──
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// ── expo-secure-store ──
const secureStoreData = {};
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key) => Promise.resolve(secureStoreData[key] || null)),
  setItemAsync: jest.fn((key, value) => {
    secureStoreData[key] = value;
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key) => {
    delete secureStoreData[key];
    return Promise.resolve();
  }),
}));

// ── expo-localization ──
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en', languageTag: 'en-US' }]),
  locale: 'en-US',
}));

// ── expo-constants ──
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        appUrl: 'https://test.taskline.app',
        googleMapsApiKey: 'test-maps-key',
        sentryDsn: 'https://test@sentry.io/123',
      },
    },
  },
}));

// ── expo-notifications ──
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'ExponentPushToken[test]' })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { MAX: 5, HIGH: 4 },
  setNotificationChannelAsync: jest.fn(),
}));

// ── expo-device ──
jest.mock('expo-device', () => ({
  isDevice: true,
  modelName: 'Test Device',
}));

// ── expo-clipboard ──
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

// ── expo-linking ──
jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
  createURL: jest.fn((path) => `taskline://${path}`),
}));

// ── expo-web-browser ──
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  dismissBrowser: jest.fn(),
}));

// ── expo-file-system ──
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
}));

// ── expo-print ──
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: '/mock/file.pdf' })),
}));

// ── expo-sharing ──
jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
}));

// ── @react-native-async-storage/async-storage ──
const asyncStorageData = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(asyncStorageData[key] || null)),
  setItem: jest.fn((key, value) => {
    asyncStorageData[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete asyncStorageData[key];
    return Promise.resolve();
  }),
  multiGet: jest.fn((keys) =>
    Promise.resolve(keys.map((k) => [k, asyncStorageData[k] || null]))
  ),
  multiSet: jest.fn((pairs) => {
    pairs.forEach(([k, v]) => { asyncStorageData[k] = v; });
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((k) => { delete asyncStorageData[k]; });
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(asyncStorageData))),
  clear: jest.fn(() => {
    Object.keys(asyncStorageData).forEach((k) => delete asyncStorageData[k]);
    return Promise.resolve();
  }),
}));

// ── @react-native-community/netinfo ──
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({ isConnected: true, isInternetReachable: true, type: 'wifi' })
  ),
}));

// ── @sentry/react-native ──
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  Severity: { Error: 'error', Warning: 'warning', Info: 'info' },
  wrap: (component) => component,
}));

// ── react-native-reanimated ──
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// ── react-native-gesture-handler ──
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: require('react-native').ScrollView,
    Slider: View,
    Switch: View,
    TextInput: require('react-native').TextInput,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: require('react-native').FlatList,
    gestureHandlerRootHOC: jest.fn((comp) => comp),
    Directions: {},
    GestureHandlerRootView: View,
  };
});

// ── react-native-maps ──
jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MockMapView = (props) => View(props);
  MockMapView.Marker = View;
  MockMapView.Callout = View;
  MockMapView.Polyline = View;
  MockMapView.Polygon = View;
  MockMapView.Circle = View;
  return { __esModule: true, default: MockMapView, Marker: View, PROVIDER_GOOGLE: 'google' };
});

// ── react-native-qrcode-svg ──
jest.mock('react-native-qrcode-svg', () => 'QRCode');

// ── react-native-svg ──
jest.mock('react-native-svg', () => {
  const React = require('react');
  const mockComponent = (name) => {
    const Component = (props) => React.createElement(name, props);
    Component.displayName = name;
    return Component;
  };
  return {
    __esModule: true,
    default: mockComponent('Svg'),
    Svg: mockComponent('Svg'),
    Circle: mockComponent('Circle'),
    Rect: mockComponent('Rect'),
    Path: mockComponent('Path'),
    G: mockComponent('G'),
    Text: mockComponent('Text'),
    Line: mockComponent('Line'),
    Defs: mockComponent('Defs'),
    LinearGradient: mockComponent('LinearGradient'),
    Stop: mockComponent('Stop'),
  };
});

// ── @expo/vector-icons ──
jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name, ...props }) => React.createElement(Text, { ...props, testID: `icon-${name}` }, name),
  };
});
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const MockIcon = ({ name, ...props }) => React.createElement(Text, { ...props, testID: `icon-${name}` }, name);
  return {
    __esModule: true,
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
    FontAwesome: MockIcon,
    default: MockIcon,
  };
});

// ── expo-router ──
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  setParams: jest.fn(),
  navigate: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: jest.fn(() => ({})),
  useSegments: jest.fn(() => []),
  usePathname: jest.fn(() => '/'),
  router: mockRouter,
  Link: 'Link',
  Tabs: { Screen: 'Screen' },
  Stack: { Screen: 'Screen' },
  Redirect: 'Redirect',
}));

// ── Suppress Animated warnings in tests ──
// NativeAnimatedHelper doesn't exist at the old path in RN 0.81+
// jest-expo preset handles Animated mocking for us

// ── Export mockRouter for tests ──
global.mockRouter = mockRouter;

// ── Global test timeout ──
jest.setTimeout(10000);
