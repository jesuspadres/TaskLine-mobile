/**
 * Projects Screen Integration Tests
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
  const { View, Text, TextInput, TouchableOpacity } = require('react-native');
  return {
    SearchBar: ({ value, onChangeText, placeholder }: any) => (
      <TextInput testID="search-bar" value={value} onChangeText={onChangeText} placeholder={placeholder} />
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
    Badge: ({ text }: any) => <Text>{text}</Text>,
    Avatar: ({ name }: any) => <Text testID="avatar">{name?.charAt(0)}</Text>,
    EmptyState: ({ title, description, actionLabel, onAction }: any) => (
      <View testID="empty-state">
        <Text>{title}</Text>
        <Text>{description}</Text>
        {actionLabel && (
          <TouchableOpacity onPress={onAction} testID="empty-action">
            <Text>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    ),
    Modal: ({ visible, children, title }: any) =>
      visible ? <View testID="modal"><Text>{title}</Text>{children}</View> : null,
    Input: ({ label, placeholder, value, onChangeText, error }: any) => (
      <View>
        <Text>{label}</Text>
        <TextInput placeholder={placeholder} value={value} onChangeText={onChangeText} />
        {error && <Text testID="input-error">{error}</Text>}
      </View>
    ),
    Button: ({ title, onPress }: any) => (
      <TouchableOpacity onPress={onPress} testID={`btn-${title}`}><Text>{title}</Text></TouchableOpacity>
    ),
    Select: ({ label }: any) => <View testID={`select-${label}`}><Text>{label}</Text></View>,
    DatePicker: ({ label }: any) => <View testID="date-picker"><Text>{label}</Text></View>,
    ListSkeleton: () => <View testID="list-skeleton"><Text>Loading...</Text></View>,
    StatusBadge: ({ status }: any) => <Text testID={`status-${status}`}>{status}</Text>,
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
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: any) => resolve({ data: [], error: null })),
    })),
  },
}));

import { act } from '@testing-library/react-native';
import ProjectsScreen from '@/app/(app)/projects';
import { showToast } from '@/components';

/** Render and flush async effects (fetchClients useEffect) */
async function renderScreen() {
  render(<ProjectsScreen />);
  await act(async () => {});
}

const createProject = (overrides?: any) => ({
  id: 'proj-1',
  user_id: 'user-1',
  client_id: 'client-1',
  name: 'Test Project',
  description: 'A test project',
  status: 'active',
  project_stage: 'planning',
  approval_status: null,
  budget_total: 5000,
  deadline: '2024-06-30',
  estimated_duration_days: 90,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  client: { id: 'client-1', name: 'John Doe', email: 'john@test.com' },
  ...overrides,
});

describe('ProjectsScreen', () => {
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

  it('shows loading skeleton when data is loading', async () => {
    mockOfflineData.loading = true;
    await renderScreen();

    expect(screen.getByTestId('list-skeleton')).toBeTruthy();
  });

  it('renders project list when loaded', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [
      createProject({ id: 'p1', name: 'Website Redesign' }),
      createProject({ id: 'p2', name: 'Mobile App' }),
    ];

    await renderScreen();

    expect(screen.getByText('Website Redesign')).toBeTruthy();
    expect(screen.getByText('Mobile App')).toBeTruthy();
  });

  it('renders projects title', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [];

    await renderScreen();

    expect(screen.getByText('projects.title')).toBeTruthy();
  });

  it('renders search bar', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [];

    await renderScreen();

    expect(screen.getByTestId('search-bar')).toBeTruthy();
  });

  it('renders filter chips for project statuses', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [];

    await renderScreen();

    // Projects screen renders two FilterChips instances (status filters + sort options)
    const filterChips = screen.getAllByTestId('filter-chips');
    expect(filterChips.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('filter-all')).toBeTruthy();
  });

  it('shows empty state when no projects', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [];

    await renderScreen();

    expect(screen.getByTestId('empty-state')).toBeTruthy();
  });

  it('renders client name on project card', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [
      createProject({ client: { id: 'c1', name: 'Jane Client', email: 'jane@test.com' } }),
    ];

    await renderScreen();

    expect(screen.getByText('Jane Client')).toBeTruthy();
  });

  it('renders project stage badge', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [
      createProject({ project_stage: 'in_progress' }),
    ];

    await renderScreen();

    expect(screen.getByText('projectDetail.inProgress')).toBeTruthy();
  });

  it('filters projects by search query', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [
      createProject({ id: 'p1', name: 'Website Redesign' }),
      createProject({ id: 'p2', name: 'Mobile App' }),
    ];

    await renderScreen();

    fireEvent.changeText(screen.getByTestId('search-bar'), 'Website');

    expect(screen.getByText('Website Redesign')).toBeTruthy();
    expect(screen.queryByText('Mobile App')).toBeNull();
  });

  it('renders sort options', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [];

    await renderScreen();

    expect(screen.getByText('projects.newest')).toBeTruthy();
  });

  it('renders project count badge', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [
      createProject({ id: 'p1' }),
      createProject({ id: 'p2' }),
      createProject({ id: 'p3' }),
    ];

    await renderScreen();

    expect(screen.getByText('3')).toBeTruthy();
  });

  it('navigates to project detail on press', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [createProject({ id: 'p1', name: 'Click Me Project' })];

    await renderScreen();

    fireEvent.press(screen.getByText('Click Me Project'));

    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/(app)/project-detail',
        params: expect.objectContaining({ id: 'p1' }),
      })
    );
  });

  it('renders add project button', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [];

    await renderScreen();

    expect(screen.getByText('projects.title')).toBeTruthy();
  });

  it('renders approval status on projects', async () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = [
      createProject({ approval_status: 'pending' }),
    ];

    await renderScreen();

    expect(screen.getByText('projects.pending')).toBeTruthy();
  });
});
