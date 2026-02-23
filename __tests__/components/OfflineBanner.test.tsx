import React from 'react';
import { render, screen, mockT, setTranslation, clearTranslations } from '../setup/testUtils';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOfflineStore } from '@/stores/offlineStore';

describe('OfflineBanner', () => {
  // Get reference to the mocked store state
  const getStoreState = () => (useOfflineStore as any).getState();

  beforeEach(() => {
    jest.clearAllMocks();
    clearTranslations();

    // Set up i18n translations
    setTranslation('offline.youreOffline', "You're offline");
    setTranslation('offline.syncing', 'Syncing changes...');
    setTranslation('offline.syncFailed', 'Sync failed');
    setTranslation('offline.pendingChanges', '2 pending changes');

    // Reset store state to default (online)
    const state = getStoreState();
    state.isOnline = true;
    state.isSyncing = false;
    state.pendingMutations = [];
    state.failedMutations = [];
  });

  // ── Hidden when online ──

  it('returns null when online and no issues', () => {
    const state = getStoreState();
    state.isOnline = true;
    state.isSyncing = false;
    state.failedMutations = [];

    const { toJSON } = render(<OfflineBanner />);
    expect(toJSON()).toBeNull();
  });

  // ── Offline state ──

  it('shows banner when offline', () => {
    const state = getStoreState();
    state.isOnline = false;
    state.isSyncing = false;
    state.pendingMutations = [];
    state.failedMutations = [];

    render(<OfflineBanner />);
    expect(screen.getByText("You're offline")).toBeTruthy();
  });

  it('shows offline banner with warning color', () => {
    const state = getStoreState();
    state.isOnline = false;

    const { toJSON } = render(<OfflineBanner />);
    const tree = JSON.stringify(toJSON());
    // Warning color from theme
    expect(tree).toContain('#f59e0b');
  });

  it('shows cloud-offline icon when offline', () => {
    const state = getStoreState();
    state.isOnline = false;

    const { toJSON } = render(<OfflineBanner />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('cloud-offline');
  });

  // ── Syncing state ──

  it('shows syncing banner when isSyncing is true', () => {
    const state = getStoreState();
    state.isOnline = true;
    state.isSyncing = true;
    state.pendingMutations = [{ id: '1' }, { id: '2' }] as any;

    render(<OfflineBanner />);
    expect(screen.getByText('Syncing changes...')).toBeTruthy();
  });

  it('shows syncing banner with info color', () => {
    const state = getStoreState();
    state.isOnline = true;
    state.isSyncing = true;
    state.pendingMutations = [{ id: '1' }] as any;

    const { toJSON } = render(<OfflineBanner />);
    const tree = JSON.stringify(toJSON());
    // Info color
    expect(tree).toContain('#3b82f6');
  });

  it('shows sync icon when syncing', () => {
    const state = getStoreState();
    state.isOnline = true;
    state.isSyncing = true;
    state.pendingMutations = [{ id: '1' }] as any;

    const { toJSON } = render(<OfflineBanner />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('sync');
  });

  // ── Failed state ──

  it('shows sync failed banner when there are failed mutations (online)', () => {
    const state = getStoreState();
    state.isOnline = true;
    state.isSyncing = false;
    state.failedMutations = [{ id: '1' }] as any;

    render(<OfflineBanner />);
    expect(screen.getByText('Sync failed')).toBeTruthy();
  });

  it('shows failed banner with error color', () => {
    const state = getStoreState();
    state.isOnline = true;
    state.failedMutations = [{ id: '1' }] as any;

    const { toJSON } = render(<OfflineBanner />);
    const tree = JSON.stringify(toJSON());
    // Error color
    expect(tree).toContain('#ef4444');
  });

  it('shows alert-circle icon when sync failed', () => {
    const state = getStoreState();
    state.isOnline = true;
    state.failedMutations = [{ id: '1' }] as any;

    const { toJSON } = render(<OfflineBanner />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('alert-circle');
  });

  // ── Priority: failed > syncing > offline ──

  it('prioritizes failed state over syncing when online', () => {
    const state = getStoreState();
    state.isOnline = true;
    state.isSyncing = true;
    state.failedMutations = [{ id: '1' }] as any;

    render(<OfflineBanner />);
    expect(screen.getByText('Sync failed')).toBeTruthy();
  });

  // ── Edge cases ──

  it('shows banner when offline with pending mutations', () => {
    const state = getStoreState();
    state.isOnline = false;
    state.pendingMutations = [{ id: '1' }, { id: '2' }] as any;

    render(<OfflineBanner />);
    // Should show offline message with pending count
    expect(screen.toJSON()).toBeTruthy();
  });

  it('text color is white', () => {
    const state = getStoreState();
    state.isOnline = false;

    const { toJSON } = render(<OfflineBanner />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#fff');
  });
});
