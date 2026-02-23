/**
 * Dashboard Screen Integration Tests
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

jest.mock('@/components', () => ({
  NotificationBell: () => {
    const { View, Text } = require('react-native');
    return <View testID="notification-bell"><Text>NotificationBell</Text></View>;
  },
  CriticalAlertsCard: () => {
    const { View, Text } = require('react-native');
    return <View testID="critical-alerts"><Text>CriticalAlerts</Text></View>;
  },
  StatsSkeleton: () => {
    const { View, Text } = require('react-native');
    return <View testID="stats-skeleton"><Text>StatsSkeleton</Text></View>;
  },
  ListSkeleton: ({ count }: any) => {
    const { View, Text } = require('react-native');
    return <View testID="list-skeleton"><Text>ListSkeleton</Text></View>;
  },
  StatusBadge: ({ status }: any) => {
    const { Text } = require('react-native');
    return <Text>{status}</Text>;
  },
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

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: any) => resolve({ data: [], error: null, count: 0 })),
    })),
  },
}));

import DashboardScreen from '@/app/(app)/(tabs)/dashboard';

const createDashboardData = (overrides?: any) => ({
  stats: {
    totalClients: 5,
    onboardedClients: 3,
    totalProjects: 8,
    activeProjects: 4,
    totalTasks: 20,
    completedTasks: 12,
    pendingApprovals: 2,
    tasksCompletedThisWeek: 3,
  },
  revenue: {
    totalRevenue: 5000,
    paidRevenue: 3000,
    outstandingRevenue: 1500,
    overdueRevenue: 500,
  },
  newRequests: [],
  todayTasks: [],
  upcomingDeadlines: [],
  upcomingBookings: [],
  upcomingTasks: [],
  recentInvoices: [],
  ...overrides,
});

describe('DashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockAuthUser({ id: 'user-1', email: 'test@test.com', user_metadata: { name: 'Test User' } });
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
    mockOfflineData.data = null;

    render(<DashboardScreen />);

    expect(screen.getByTestId('stats-skeleton')).toBeTruthy();
    expect(screen.getByTestId('list-skeleton')).toBeTruthy();
  });

  it('renders welcome message with user name', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    expect(screen.getByText('dashboard.welcome')).toBeTruthy();
    expect(screen.getByText('Test User!')).toBeTruthy();
  });

  it('renders notification bell', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    expect(screen.getByTestId('notification-bell')).toBeTruthy();
  });

  it('renders critical alerts card', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    expect(screen.getByTestId('critical-alerts')).toBeTruthy();
  });

  it('renders stat cards with correct values', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    // Stats labels
    expect(screen.getByText('dashboard.clients')).toBeTruthy();
    expect(screen.getByText('dashboard.projects')).toBeTruthy();
    expect(screen.getByText('dashboard.tasks')).toBeTruthy();
    expect(screen.getByText('dashboard.requests')).toBeTruthy();
    expect(screen.getByText('dashboard.approvals')).toBeTruthy();

    // Stats values
    expect(screen.getByText('5')).toBeTruthy(); // totalClients
    expect(screen.getByText('4')).toBeTruthy(); // activeProjects
    expect(screen.getByText('8')).toBeTruthy(); // totalTasks - completedTasks = 20 - 12
    expect(screen.getByText('0')).toBeTruthy(); // newRequests.length
    expect(screen.getByText('2')).toBeTruthy(); // pendingApprovals
  });

  it('renders today section with nothing scheduled when empty', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    expect(screen.getByText('dashboard.today')).toBeTruthy();
    expect(screen.getByText('dashboard.nothingScheduled')).toBeTruthy();
  });

  it('renders today tasks when present', () => {
    const task = factories.task({
      id: 'task-today',
      title: 'Fix bug today',
      status: 'pending',
      priority: 'high',
      due_date: new Date().toISOString(),
      project: { name: 'Project A' },
    });

    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData({
      todayTasks: [task],
    });

    render(<DashboardScreen />);

    expect(screen.getByText('Fix bug today')).toBeTruthy();
  });

  it('renders recent invoices section', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    expect(screen.getByText('dashboard.recentInvoices')).toBeTruthy();
  });

  it('renders recent invoices when available', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData({
      recentInvoices: [
        {
          id: 'inv-1',
          invoice_number: 'INV-001',
          status: 'paid',
          total: 1000,
          due_date: '2024-02-01',
          client: { name: 'Client A' },
        },
      ],
    });

    render(<DashboardScreen />);

    expect(screen.getByText('INV-001')).toBeTruthy();
    expect(screen.getByText('Client A')).toBeTruthy();
  });

  it('renders revenue overview section', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    expect(screen.getByText('dashboard.revenueOverview')).toBeTruthy();
    expect(screen.getByText('dashboard.paid')).toBeTruthy();
    expect(screen.getByText('dashboard.pending')).toBeTruthy();
    expect(screen.getByText('dashboard.overdue')).toBeTruthy();
  });

  it('navigates to clients on client stat press', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    fireEvent.press(screen.getByText('dashboard.clients'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/clients' as any);
  });

  it('navigates to projects on project stat press', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    fireEvent.press(screen.getByText('dashboard.projects'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/projects' as any);
  });

  it('navigates to tasks on task stat press', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    fireEvent.press(screen.getByText('dashboard.tasks'));

    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/tasks' as any);
  });

  it('renders weekly progress section', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData();

    render(<DashboardScreen />);

    expect(screen.getByText('dashboard.thisWeek')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy(); // tasksCompletedThisWeek
  });

  it('shows empty invoice state with create button', () => {
    mockOfflineData.loading = false;
    mockOfflineData.data = createDashboardData({ recentInvoices: [] });

    render(<DashboardScreen />);

    expect(screen.getByText('dashboard.noRecentInvoices')).toBeTruthy();
    expect(screen.getByText('dashboard.createInvoice')).toBeTruthy();
  });
});
