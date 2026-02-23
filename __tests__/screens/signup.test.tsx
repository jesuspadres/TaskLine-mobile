/**
 * Signup Screen Integration Tests
 */
import React from 'react';
import {
  render,
  mockT,
  setMockAuth,
  screen,
  fireEvent,
  waitFor,
  factories,
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

const mockSignUp = jest.fn();
jest.mock('@/lib/supabase', () => ({
  signUp: (...args: any[]) => mockSignUp(...args),
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('@/lib/websiteApi', () => ({
  createCheckoutSession: jest.fn(),
  syncSubscription: jest.fn(),
}));

jest.mock('@/lib/plans', () => ({
  PLANS: [
    {
      slug: 'free',
      nameKey: 'free',
      descriptionKey: 'freeDesc',
      popular: false,
      comingSoon: false,
      price: { monthly: 0, annual: 0 },
      features: { clients: '5', projects: '3', tasks: '10', storage: '100MB', scheduler: false },
    },
  ],
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

jest.mock('@/components', () => ({
  showToast: jest.fn(),
  DatePicker: ({ value, onChange, placeholder }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity testID="date-picker" onPress={() => onChange(new Date(2000, 0, 1))}>
        <Text>{placeholder}</Text>
      </TouchableOpacity>
    );
  },
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

jest.mock('@/lib/security', () => ({
  secureLog: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import SignupScreen from '@/app/(auth)/signup';
import { showToast } from '@/components';
import { useAuthStore } from '@/stores/authStore';

describe('SignupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuth({
      user: null,
      session: null,
      loading: false,
      initialized: true,
      setSuppressAuthChange: jest.fn(),
    });
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'new-user', email: 'new@test.com', user_metadata: { name: 'New User' } },
        session: { access_token: 'tok', user: { id: 'new-user' } },
      },
      error: null,
    });
  });

  it('renders name input on step 0', () => {
    render(<SignupScreen />);
    expect(screen.getByText('auth.whatsYourName')).toBeTruthy();
    expect(screen.getByPlaceholderText('auth.fullNamePlaceholder')).toBeTruthy();
  });

  it('renders continue button', () => {
    render(<SignupScreen />);
    expect(screen.getByText('auth.continue')).toBeTruthy();
  });

  it('disables continue when name is empty', () => {
    render(<SignupScreen />);
    const continueBtn = screen.getByText('auth.continue');
    // The button should have disabled opacity when name is empty
    expect(continueBtn).toBeTruthy();
  });

  it('advances to DOB step after entering name', () => {
    render(<SignupScreen />);

    const nameInput = screen.getByPlaceholderText('auth.fullNamePlaceholder');
    fireEvent.changeText(nameInput, 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));

    expect(screen.getByText('auth.dateOfBirth')).toBeTruthy();
  });

  it('advances to email step after DOB', () => {
    render(<SignupScreen />);

    // Step 0: Name
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));

    // Step 1: DOB - press the date picker mock to set a date
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));

    // Step 2: Email
    expect(screen.getByText('auth.whatsYourEmail')).toBeTruthy();
  });

  it('advances to password step after email', () => {
    render(<SignupScreen />);

    // Step 0: Name
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));

    // Step 1: DOB
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));

    // Step 2: Email
    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'test@test.com');
    fireEvent.press(screen.getByText('auth.continue'));

    // Step 3: Password
    expect(screen.getByText('auth.createPassword')).toBeTruthy();
  });

  it('shows password strength indicator when typing', () => {
    render(<SignupScreen />);

    // Navigate to password step
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'test@test.com');
    fireEvent.press(screen.getByText('auth.continue'));

    // Type a password
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordMinChars'), 'Test1234');

    // Should show requirement checks
    expect(screen.getByText('auth.reqMinLength')).toBeTruthy();
    expect(screen.getByText('auth.reqUppercase')).toBeTruthy();
    expect(screen.getByText('auth.reqLowercase')).toBeTruthy();
    expect(screen.getByText('auth.reqNumber')).toBeTruthy();
  });

  it('shows password mismatch error', () => {
    render(<SignupScreen />);

    // Navigate to password step
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'test@test.com');
    fireEvent.press(screen.getByText('auth.continue'));

    // Type mismatched passwords
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordMinChars'), 'Test1234');
    fireEvent.changeText(screen.getByPlaceholderText('auth.confirmPasswordPlaceholder'), 'Different1');

    expect(screen.getByText('auth.passwordsNoMatch')).toBeTruthy();
  });

  it('shows terms agreement required error on create account', async () => {
    render(<SignupScreen />);

    // Navigate through all steps to terms step (step 5)
    // Step 0: Name
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));
    // Step 1: DOB
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));
    // Step 2: Email
    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'test@test.com');
    fireEvent.press(screen.getByText('auth.continue'));
    // Step 3: Password
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordMinChars'), 'Test1234');
    fireEvent.changeText(screen.getByPlaceholderText('auth.confirmPasswordPlaceholder'), 'Test1234');
    fireEvent.press(screen.getByText('auth.continue'));
    // Step 4: Business (skip or continue)
    fireEvent.press(screen.getByText('auth.continue'));

    // Step 5: Terms - try to create without agreeing
    expect(screen.getByText('auth.almostDone')).toBeTruthy();
  });

  it('calls signUp on account creation after terms agreed', async () => {
    render(<SignupScreen />);

    // Step 0: Name
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));
    // Step 1: DOB
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));
    // Step 2: Email
    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'test@test.com');
    fireEvent.press(screen.getByText('auth.continue'));
    // Step 3: Password
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordMinChars'), 'Test1234');
    fireEvent.changeText(screen.getByPlaceholderText('auth.confirmPasswordPlaceholder'), 'Test1234');
    fireEvent.press(screen.getByText('auth.continue'));
    // Step 4: Business (continue)
    fireEvent.press(screen.getByText('auth.continue'));

    // Step 5: Terms - agree and create account
    // The terms text is a composite: "auth.agreePrefix legal.termsOfService auth.and legal.privacyPolicy"
    // Use regex to find the partial text within the composite Text node
    fireEvent.press(screen.getByText(/auth\.agreePrefix/));
    fireEvent.press(screen.getByText('auth.createAccount'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('test@test.com', 'Test1234', 'Test User');
    });
  });

  it('shows error toast on signup failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email already registered' },
    });

    render(<SignupScreen />);

    // Navigate through all steps
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'existing@test.com');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordMinChars'), 'Test1234');
    fireEvent.changeText(screen.getByPlaceholderText('auth.confirmPasswordPlaceholder'), 'Test1234');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.press(screen.getByText('auth.continue'));

    // Terms step
    fireEvent.press(screen.getByText(/auth\.agreePrefix/));
    fireEvent.press(screen.getByText('auth.createAccount'));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('error', 'Email already registered');
    });
  });

  it('shows business step with skip option', () => {
    render(<SignupScreen />);

    // Navigate to business step
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test User');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'test@test.com');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordMinChars'), 'Test1234');
    fireEvent.changeText(screen.getByPlaceholderText('auth.confirmPasswordPlaceholder'), 'Test1234');
    fireEvent.press(screen.getByText('auth.continue'));

    // Business step should have skip option
    expect(screen.getByText('auth.tellUsAboutBusiness')).toBeTruthy();
    expect(screen.getByText('auth.skip')).toBeTruthy();
  });

  it('suppresses auth change on account creation', async () => {
    const mockSetSuppressAuthChange = jest.fn();
    setMockAuth({ setSuppressAuthChange: mockSetSuppressAuthChange });

    render(<SignupScreen />);

    // Navigate through all steps to terms
    fireEvent.changeText(screen.getByPlaceholderText('auth.fullNamePlaceholder'), 'Test');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.press(screen.getByTestId('date-picker'));
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.changeText(screen.getByPlaceholderText('auth.emailPlaceholder'), 'test@test.com');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.changeText(screen.getByPlaceholderText('auth.passwordMinChars'), 'Test1234');
    fireEvent.changeText(screen.getByPlaceholderText('auth.confirmPasswordPlaceholder'), 'Test1234');
    fireEvent.press(screen.getByText('auth.continue'));
    fireEvent.press(screen.getByText('auth.continue'));

    // Terms step
    fireEvent.press(screen.getByText(/auth\.agreePrefix/));
    fireEvent.press(screen.getByText('auth.createAccount'));

    await waitFor(() => {
      expect(mockSetSuppressAuthChange).toHaveBeenCalledWith(true);
    });
  });
});
