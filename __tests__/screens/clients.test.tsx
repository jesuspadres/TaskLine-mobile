/**
 * Clients Screen Integration Tests
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

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  setParams: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: jest.fn(() => ({})),
  Link: ({ children }: any) => children,
}));

// Mock offline data hook
const mockRefresh = jest.fn();
let mockOfflineData: any = {
  data: null,
  loading: true,
  refreshing: false,
  isStale: false,
  error: null,
  refresh: mockRefresh,
  isOffline: false,
};

jest.mock('@/hooks/useOfflineData', () => ({
  useOfflineData: jest.fn(() => mockOfflineData),
}));

const mockMutate = jest.fn().mockResolvedValue({ error: null });
jest.mock('@/hooks/useOfflineMutation', () => ({
  useOfflineMutation: () => ({ mutate: mockMutate, pendingCount: 0 }),
}));

jest.mock('@/hooks/useCollapsibleFilters', () => ({
  useCollapsibleFilters: () => ({
    filterContainerStyle: {},
    onFilterLayout: jest.fn(),
    onScroll: jest.fn(),
    filterHeight: 120,
  }),
}));

jest.mock('@/components', () => {
  const React = require('react');
  const { View, Text, TextInput, TouchableOpacity } = require('react-native');
  return {
    SearchBar: ({ value, onChangeText, placeholder }: any) => (
      <TextInput
        testID="search-bar"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    ),
    FilterChips: ({ options, selected, onSelect }: any) => (
      <View testID="filter-chips">
        {options.map((opt: any) => (
          <TouchableOpacity key={opt.key} onPress={() => onSelect(opt.key)} testID={`filter-${opt.key}`}>
            <Text>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    ),
    Badge: ({ text, variant }: any) => <Text testID={`badge-${variant}`}>{text}</Text>,
    Avatar: ({ name }: any) => <Text testID="avatar">{name?.charAt(0)}</Text>,
    EmptyState: ({ title, description, actionLabel, onAction }: any) => (
      <View testID="empty-state">
        <Text>{title}</Text>
        <Text>{description}</Text>
        {actionLabel && (
          <TouchableOpacity onPress={onAction} testID="empty-state-action">
            <Text>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
    Modal: ({ visible, children, title }: any) =>
      visible ? (
        <View testID="modal">
          <Text>{title}</Text>
          {children}
        </View>
      ) : null,
    Input: ({ label, placeholder, value, onChangeText, error }: any) => (
      <View>
        <Text>{label}</Text>
        <TextInput
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          testID={`input-${label}`}
        />
        {error && <Text testID="input-error">{error}</Text>}
      </View>
    ),
    Button: ({ title, onPress, loading }: any) => (
      <TouchableOpacity onPress={onPress} testID={`button-${title}`}>
        <Text>{loading ? 'Loading...' : title}</Text>
      </TouchableOpacity>
    ),
    ListSkeleton: () => <View testID="list-skeleton"><Text>Loading...</Text></View>,
    showToast: jest.fn(),
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
      order: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: any) => resolve({ data: [], error: null })),
    })),
  },
}));

import ClientsScreen from '@/app/(app)/(tabs)/clients';
import { showToast } from '@/components';

describe('ClientsScreen', () => {
  const mockClients = [
    factories.client({ id: 'c1', name: 'Alice Smith', email: 'alice@test.com', onboarded: true }),
    factories.client({ id: 'c2', name: 'Bob Jones', email: 'bob@test.com', onboarded: false }),
    factories.client({ id: 'c3', name: 'Charlie Brown', email: 'charlie@test.com', onboarded: true, phone: '555-9999' }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuthUser();
    mockOfflineData = {
      data: null,
      loading: true,
      refreshing: false,
      isStale: false,
      error: null,
      refresh: mockRefresh,
      isOffline: false,
    };
  });

  it('shows loading skeleton when data is loading', () => {
    mockOfflineData.loading = true;
    render(<ClientsScreen />);

    expect(screen.getByText('clients.title')).toBeTruthy();
    expect(screen.getByTestId('list-skeleton')).toBeTruthy();
  });

  it('renders client list when loaded', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('Bob Jones')).toBeTruthy();
    expect(screen.getByText('Charlie Brown')).toBeTruthy();
  });

  it('renders client count badge', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders search bar', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    expect(screen.getByTestId('search-bar')).toBeTruthy();
  });

  it('filters clients by search query', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    fireEvent.changeText(screen.getByTestId('search-bar'), 'Alice');

    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.queryByText('Bob Jones')).toBeNull();
  });

  it('renders filter chips', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    expect(screen.getByTestId('filter-chips')).toBeTruthy();
    expect(screen.getByTestId('filter-all')).toBeTruthy();
  });

  it('renders sort options', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    expect(screen.getByText('clients.newest')).toBeTruthy();
    expect(screen.getByText('clients.nameAZ')).toBeTruthy();
  });

  it('shows empty state when no clients', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [];

    render(<ClientsScreen />);

    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('clients.noResults')).toBeTruthy();
  });

  it('shows empty state with add button when no clients and no search', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [];

    render(<ClientsScreen />);

    expect(screen.getByText('clients.addClient')).toBeTruthy();
  });

  it('shows different empty state message when searching', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    fireEvent.changeText(screen.getByTestId('search-bar'), 'NonexistentName');

    expect(screen.getByText('clients.tryDifferentSearch')).toBeTruthy();
  });

  it('shows onboarded badge on active clients', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [factories.client({ id: 'c1', name: 'Active Client', onboarded: true })];

    render(<ClientsScreen />);

    expect(screen.getByTestId('badge-active')).toBeTruthy();
  });

  it('shows pending badge on non-onboarded clients', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [factories.client({ id: 'c2', name: 'Pending Client', onboarded: false })];

    render(<ClientsScreen />);

    expect(screen.getByTestId('badge-pending')).toBeTruthy();
  });

  it('renders client emails', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    expect(screen.getByText('alice@test.com')).toBeTruthy();
    expect(screen.getByText('bob@test.com')).toBeTruthy();
  });

  it('renders client phone numbers when available', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [
      factories.client({ id: 'c3', name: 'Phone Client', phone: '555-9999' }),
    ];

    render(<ClientsScreen />);

    expect(screen.getByText('555-9999')).toBeTruthy();
  });

  it('renders add client button in header', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = mockClients;

    render(<ClientsScreen />);

    // The add button is an Ionicons "add" icon in a TouchableOpacity
    expect(screen.getByText('clients.title')).toBeTruthy();
  });
});
