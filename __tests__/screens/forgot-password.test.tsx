/**
 * Forgot Password Screen Integration Tests
 */
import React from 'react';
import {
  render,
  mockT,
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
  Link: ({ children, asChild }: any) => asChild ? children : <>{children}</>,
}));

const mockResetPassword = jest.fn();
jest.mock('@/lib/supabase', () => ({
  resetPassword: (...args: any[]) => mockResetPassword(...args),
}));

jest.mock('@/components', () => ({
  showToast: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

import ForgotPasswordScreen from '@/app/(auth)/forgot-password';
import { showToast } from '@/components';

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResetPassword.mockResolvedValue({ error: null });
  });

  it('renders the forgot password form', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByText('auth.forgotPasswordTitle')).toBeTruthy();
    expect(screen.getByText('auth.forgotPasswordSubtitle')).toBeTruthy();
  });

  it('renders email input', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByPlaceholderText('auth.emailPlaceholder')).toBeTruthy();
  });

  it('renders send reset button', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByText('auth.sendReset')).toBeTruthy();
  });

  it('renders back to login link', () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByText('auth.login')).toBeTruthy();
    expect(screen.getByText('auth.rememberPassword')).toBeTruthy();
  });

  it('shows error toast when email is empty', async () => {
    render(<ForgotPasswordScreen />);

    fireEvent.press(screen.getByText('auth.sendReset'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('error', 'auth.enterEmail');
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it('calls resetPassword with entered email', async () => {
    render(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'user@test.com');
    fireEvent.press(screen.getByText('auth.sendReset'));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('user@test.com');
    });
  });

  it('shows success state after sending reset email', async () => {
    mockResetPassword.mockResolvedValue({ error: null });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'user@test.com');
    fireEvent.press(screen.getByText('auth.sendReset'));

    await waitFor(() => {
      expect(screen.getByText('auth.checkYourEmail')).toBeTruthy();
    });
    // The email is rendered as a nested <Text> inside the success message text,
    // so use regex to match within the composite text node
    expect(screen.getByText('user@test.com')).toBeTruthy();
    expect(screen.getByText(/auth\.resetLinkSentTo/)).toBeTruthy();
  });

  it('shows back to sign in button on success state', async () => {
    mockResetPassword.mockResolvedValue({ error: null });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'user@test.com');
    fireEvent.press(screen.getByText('auth.sendReset'));

    await waitFor(() => {
      expect(screen.getByText('auth.backToSignIn')).toBeTruthy();
    });
  });

  it('navigates to login when pressing back to sign in', async () => {
    mockResetPassword.mockResolvedValue({ error: null });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'user@test.com');
    fireEvent.press(screen.getByText('auth.sendReset'));

    await waitFor(() => {
      expect(screen.getByText('auth.backToSignIn')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('auth.backToSignIn'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('shows error toast on reset password failure', async () => {
    mockResetPassword.mockResolvedValue({
      error: { message: 'User not found' },
    });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'unknown@test.com');
    fireEvent.press(screen.getByText('auth.sendReset'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('error', 'User not found');
    });
  });

  it('does not show success state on error', async () => {
    mockResetPassword.mockResolvedValue({
      error: { message: 'User not found' },
    });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'unknown@test.com');
    fireEvent.press(screen.getByText('auth.sendReset'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalled();
    });

    // Should still show the form, not success state
    expect(screen.getByPlaceholderText('auth.emailPlaceholder')).toBeTruthy();
    expect(screen.queryByText('auth.checkYourEmail')).toBeNull();
  });

  it('shows hint about not receiving email on success', async () => {
    mockResetPassword.mockResolvedValue({ error: null });

    render(<ForgotPasswordScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'user@test.com');
    fireEvent.press(screen.getByText('auth.sendReset'));

    await waitFor(() => {
      expect(screen.getByText('auth.didntReceiveEmail')).toBeTruthy();
    });
  });
});
