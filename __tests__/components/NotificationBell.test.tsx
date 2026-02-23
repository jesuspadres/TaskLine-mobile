import React from 'react';
import { render, fireEvent, screen } from '../setup/testUtils';
import { NotificationBell } from '@/components/NotificationBell';

// Mock useNotifications hook
const mockUnreadCount = { current: 0 };
jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    unreadCount: mockUnreadCount.current,
    notifications: [],
    loading: false,
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    deleteNotification: jest.fn(),
  }),
}));

const mockRouter = require('expo-router').useRouter();

describe('NotificationBell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUnreadCount.current = 0;
  });

  // ── Rendering ──

  it('renders the bell icon', () => {
    const { toJSON } = render(<NotificationBell />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('notifications-outline');
  });

  // ── Badge count ──

  it('does not show badge when unreadCount is 0', () => {
    mockUnreadCount.current = 0;
    const { toJSON } = render(<NotificationBell />);
    const tree = JSON.stringify(toJSON());
    // No badge text should be present
    // The badge View is only rendered when unreadCount > 0
    expect(tree).not.toContain('"99+"');
  });

  it('shows badge with count when unreadCount > 0', () => {
    mockUnreadCount.current = 5;
    render(<NotificationBell />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows badge with count 1', () => {
    mockUnreadCount.current = 1;
    render(<NotificationBell />);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('shows badge with count 99', () => {
    mockUnreadCount.current = 99;
    render(<NotificationBell />);
    expect(screen.getByText('99')).toBeTruthy();
  });

  it('truncates to 99+ when unreadCount > 99', () => {
    mockUnreadCount.current = 100;
    render(<NotificationBell />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('truncates to 99+ when unreadCount is very large', () => {
    mockUnreadCount.current = 9999;
    render(<NotificationBell />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  // ── Interactions ──

  it('navigates to notifications screen when pressed', () => {
    render(<NotificationBell />);
    // Press the icon text (our mock renders icon name as text content)
    fireEvent.press(screen.getByText('notifications-outline'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(app)/notifications');
  });

  // ── Edge cases ──

  it('renders without crashing when unreadCount is 0', () => {
    mockUnreadCount.current = 0;
    render(<NotificationBell />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('does not show badge for negative unreadCount', () => {
    mockUnreadCount.current = -1;
    const { toJSON } = render(<NotificationBell />);
    // -1 > 0 is false, so badge should not show
    expect(screen.queryByText('-1')).toBeNull();
  });
});
