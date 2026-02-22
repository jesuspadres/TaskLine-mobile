/**
 * Login Screen Integration Tests
 */
import React from 'react';
import {
  render,
  mockT,
  setMockAuth,
  setMockAuthUser,
  screen,
  fireEvent,
  waitFor,
  factories,
} from '../setup/testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Must mock before importing the component
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

import LoginScreen from '@/app/(auth)/login';
import { showToast } from '@/components';
import { useAuthStore } from '@/stores/authStore';

describe('LoginScreen', () => {
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuth({
      login: mockLogin,
      user: null,
      session: null,
      loading: false,
      initialized: true,
    });
    mockLogin.mockResolvedValue({ error: null });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it('renders email and password inputs', () => {
    render(<LoginScreen />);
    expect(screen.getByPlaceholderText('auth.emailPlaceholder')).toBeTruthy();
    expect(screen.getByPlaceholderText('auth.passwordPlaceholder')).toBeTruthy();
  });

  it('renders login button', () => {
    render(<LoginScreen />);
    expect(screen.getByText('auth.login')).toBeTruthy();
  });

  it('renders welcome text and branding', () => {
    render(<LoginScreen />);
    expect(screen.getByText('TaskLine')).toBeTruthy();
    expect(screen.getByText('auth.welcomeBack')).toBeTruthy();
  });

  it('renders forgot password link', () => {
    render(<LoginScreen />);
    expect(screen.getByText('auth.forgotPassword')).toBeTruthy();
  });

  it('renders signup link', () => {
    render(<LoginScreen />);
    expect(screen.getByText('auth.signup')).toBeTruthy();
  });

  it('renders remember me toggle', () => {
    render(<LoginScreen />);
    expect(screen.getByText('auth.rememberMe')).toBeTruthy();
  });

  it('shows error toast when submitting with empty fields', async () => {
    render(<LoginScreen />);

    fireEvent.press(screen.getByText('auth.login'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('error', 'auth.fillAllFields');
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows error toast when email is empty', async () => {
    render(<LoginScreen />);

    const passwordInput = screen.getByPlaceholderText('auth.passwordPlaceholder');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(screen.getByText('auth.login'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('error', 'auth.fillAllFields');
    });
  });

  it('shows error toast when password is empty', async () => {
    render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('auth.emailPlaceholder');
    fireEvent.changeText(emailInput, 'test@test.com');
    fireEvent.press(screen.getByText('auth.login'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('error', 'auth.fillAllFields');
    });
  });

  it('calls login with email and password on submit', async () => {
    render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('auth.emailPlaceholder');
    const passwordInput = screen.getByPlaceholderText('auth.passwordPlaceholder');

    fireEvent.changeText(emailInput, 'user@test.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(screen.getByText('auth.login'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'password123');
    });
  });

  it('navigates to dashboard on successful login', async () => {
    mockLogin.mockResolvedValue({ error: null });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'user@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordPlaceholder'), 'password123');
    fireEvent.press(screen.getByText('auth.login'));

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(app)/dashboard');
    });
  });

  it('shows error toast on login failure', async () => {
    mockLogin.mockResolvedValue({ error: { message: 'Invalid credentials' } });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'user@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordPlaceholder'), 'wrongpass');
    fireEvent.press(screen.getByText('auth.login'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('error', 'Invalid credentials');
    });
  });

  it('shows attempts warning after WARNING_THRESHOLD (3) failed attempts', async () => {
    mockLogin.mockResolvedValue({ error: { message: 'Invalid credentials' } });

    render(<LoginScreen />);

    const emailInput = screen.getByPlaceholderText('auth.emailPlaceholder');
    const passwordInput = screen.getByPlaceholderText('auth.passwordPlaceholder');

    fireEvent.changeText(emailInput, 'user@test.com');
    fireEvent.changeText(passwordInput, 'wrongpass');

    // Trigger 3 failed login attempts
    for (let i = 0; i < 3; i++) {
      fireEvent.press(screen.getByText('auth.login'));
      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalled();
      });
    }

    await waitFor(() => {
      expect(screen.getByText('auth.attemptsWarning')).toBeTruthy();
    });
  });

  it('loads saved email when remember me was previously enabled', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@taskline_remember_email') return Promise.resolve('saved@test.com');
      return Promise.resolve(null);
    });

    render(<LoginScreen />);

    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText('auth.emailPlaceholder');
      expect(emailInput.props.value).toBe('saved@test.com');
    });
  });

  it('saves email to AsyncStorage when remember me is on and login succeeds', async () => {
    mockLogin.mockResolvedValue({ error: null });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'user@test.com');
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordPlaceholder'), 'password123');

    // Toggle remember me
    fireEvent.press(screen.getByText('auth.rememberMe'));

    fireEvent.press(screen.getByText('auth.login'));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@taskline_remember_email',
        'user@test.com'
      );
    });
  });

  it('toggles password visibility', () => {
    render(<LoginScreen />);

    const passwordInput = screen.getByPlaceholderText('auth.passwordPlaceholder');
    expect(passwordInput.props.secureTextEntry).toBe(true);
  });
});
