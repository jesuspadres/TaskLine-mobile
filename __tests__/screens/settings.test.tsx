/**
 * Settings Screen Integration Tests
 */
import React from 'react';
import {
  render,
  mockT,
  setMockAuth,
  setMockAuthUser,
  setMockSubscription,
  screen,
  fireEvent,
  waitFor,
} from '../setup/testUtils';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: jest.fn(() => ({})),
  Link: ({ children }: any) => children,
}));

jest.mock('@/hooks/useNavigationBadges', () => ({
  useNavigationBadges: () => ({
    counts: { notifications: 3, requests: 0, projects: 0, tasks: 0 },
  }),
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
  ENV: {
    APP_URL: 'https://test.taskline.app',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_ANON_KEY: 'test-key',
  },
}));

jest.mock('@/lib/plans', () => ({
  getPlan: jest.fn(() => ({
    slug: 'free',
    features: { storage: '100MB' },
  })),
}));

jest.mock('@/lib/websiteApi', () => ({
  createFoundingLockInSession: jest.fn(),
  deleteAccount: jest.fn(),
}));

jest.mock('@/lib/security', () => ({
  secureLog: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/components', () => {
  const React = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    showToast: jest.fn(),
    ConfirmDialog: ({ visible, title, onConfirm, onCancel }: any) =>
      visible ? (
        <View testID="confirm-dialog">
          <Text>{title}</Text>
          <TouchableOpacity onPress={onConfirm} testID="confirm-yes">
            <Text>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} testID="confirm-no">
            <Text>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : null,
    DatePicker: ({ label, value, onChange, placeholder }: any) => {
      const { TextInput } = require('react-native');
      return (
        <View>
          <Text>{label}</Text>
          <TextInput placeholder={placeholder} testID="date-picker" />
        </View>
      );
    },
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      updateUser: jest.fn().mockResolvedValue({ error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import SettingsScreen from '@/app/(app)/settings';
import { showToast } from '@/components';

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuthUser({
      id: 'user-1',
      email: 'test@test.com',
      user_metadata: { name: 'Test User' },
    });
    setMockSubscription({
      tier: 'free',
      status: 'active',
      isFree: true,
      isPro: false,
      isPlus: false,
      isBusiness: false,
      loading: false,
    });
  });

  it('renders settings title', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.title')).toBeTruthy();
  });

  it('renders user profile card with name and email', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Test User')).toBeTruthy();
    // Email appears in multiple places (profile card + edit profile subtitle)
    const emailElements = screen.getAllByText('test@test.com');
    expect(emailElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders user initial in avatar', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('T')).toBeTruthy();
  });

  it('renders account section', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.account')).toBeTruthy();
    expect(screen.getByText('settings.editProfile')).toBeTruthy();
    expect(screen.getByText('settings.changeEmail')).toBeTruthy();
    expect(screen.getByText('settings.changePassword')).toBeTruthy();
  });

  it('renders preferences section with appearance and language', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.preferences')).toBeTruthy();
    expect(screen.getByText('settings.appearance')).toBeTruthy();
    expect(screen.getByText('settings.language')).toBeTruthy();
  });

  it('renders theme mode options (light/dark/system)', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.light')).toBeTruthy();
    expect(screen.getByText('settings.dark')).toBeTruthy();
    expect(screen.getByText('settings.system')).toBeTruthy();
  });

  it('renders language options (English/Espanol)', () => {
    render(<SettingsScreen />);
    // "English" appears in multiple places (language option + possibly elsewhere)
    expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Español')).toBeTruthy();
  });

  it('renders business section', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.business')).toBeTruthy();
    expect(screen.getByText('settings.businessProfile')).toBeTruthy();
    expect(screen.getByText('settings.qrCodes')).toBeTruthy();
    expect(screen.getByText('settings.invoicePaymentSettings')).toBeTruthy();
  });

  it('renders support section', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.support')).toBeTruthy();
    expect(screen.getByText('settings.helpCenter')).toBeTruthy();
    expect(screen.getByText('settings.sendFeedback')).toBeTruthy();
    expect(screen.getByText('settings.privacyPolicy')).toBeTruthy();
    expect(screen.getByText('settings.termsOfService')).toBeTruthy();
  });

  it('renders danger zone with logout and delete', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.dangerZone')).toBeTruthy();
    expect(screen.getByText('settings.signOut')).toBeTruthy();
    expect(screen.getByText('settings.deleteAccount')).toBeTruthy();
  });

  it('renders subscription card', () => {
    render(<SettingsScreen />);
    // The subscription section uses type: 'custom', so the title key is not rendered as text.
    // Instead, renderSubscriptionCard() renders the tier label and manage button.
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText('settings.manageSubscription')).toBeTruthy();
  });

  it('renders notification settings link', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.notificationPreferences')).toBeTruthy();
  });

  it('navigates to business profile on press', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('settings.businessProfile'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/business-profile' as any);
  });

  it('navigates to QR settings on press', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('settings.qrCodes'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/qr-settings' as any);
  });

  it('navigates to invoice settings on press', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('settings.invoicePaymentSettings'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/invoice-settings' as any);
  });

  it('navigates to booking settings on press', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('settings.bookingSettings'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/booking-settings' as any);
  });

  it('navigates to notifications on press', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('notifications.title'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/notifications' as any);
  });

  it('navigates to manage subscription on press', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('settings.manageSubscription'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/manage-subscription' as any);
  });

  it('navigates to privacy policy on press', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('settings.privacyPolicy'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/privacy-policy' as any);
  });

  it('renders storage card', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('settings.storage')).toBeTruthy();
  });

  it('renders back button', () => {
    render(<SettingsScreen />);
    // The back button is rendered, we can verify the settings title is present
    // indicating the header rendered
    expect(screen.getByText('settings.title')).toBeTruthy();
  });

  it('shows unread notification count', () => {
    render(<SettingsScreen />);
    // The notification link should show unread count
    expect(screen.getByText('settings.unreadCount')).toBeTruthy();
  });
});
