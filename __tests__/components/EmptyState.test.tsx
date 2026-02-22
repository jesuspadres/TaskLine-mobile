import React from 'react';
import { render, fireEvent, screen, mockT, setTranslation, clearTranslations } from '../setup/testUtils';
import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearTranslations();
  });

  // ── Rendering ──

  it('renders title', () => {
    render(<EmptyState title="No Items" />);
    expect(screen.getByText('No Items')).toBeTruthy();
  });

  it('renders with default icon', () => {
    const { toJSON } = render(<EmptyState title="Empty" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('document-outline');
  });

  it('renders with custom icon', () => {
    const { toJSON } = render(
      <EmptyState title="No Clients" icon="people-outline" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('people-outline');
  });

  // ── Description / Message ──

  it('renders message text', () => {
    render(
      <EmptyState title="No Items" message="You have no items yet." />
    );
    expect(screen.getByText('You have no items yet.')).toBeTruthy();
  });

  it('renders description text (alias for message)', () => {
    render(
      <EmptyState title="No Items" description="Create your first item." />
    );
    expect(screen.getByText('Create your first item.')).toBeTruthy();
  });

  it('prefers message over description when both provided', () => {
    render(
      <EmptyState
        title="No Items"
        message="Message text"
        description="Description text"
      />
    );
    expect(screen.getByText('Message text')).toBeTruthy();
    expect(screen.queryByText('Description text')).toBeNull();
  });

  it('does not render description when neither message nor description provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText('Empty')).toBeTruthy();
  });

  // ── Action button ──

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        title="No Projects"
        actionLabel="Create Project"
        onAction={onAction}
      />
    );
    expect(screen.getByText('Create Project')).toBeTruthy();
  });

  it('calls onAction when action button is pressed', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        title="No Projects"
        actionLabel="Create Project"
        onAction={onAction}
      />
    );
    fireEvent.press(screen.getByText('Create Project'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when only actionLabel is provided', () => {
    render(
      <EmptyState title="No Items" actionLabel="Add Item" />
    );
    // Without onAction, the button should not render
    expect(screen.queryByText('Add Item')).toBeNull();
  });

  it('does not render action button when only onAction is provided', () => {
    render(
      <EmptyState title="No Items" onAction={jest.fn()} />
    );
    // Without actionLabel, the button should not render
    expect(screen.getByText('No Items')).toBeTruthy();
  });

  // ── Offline mode ──

  it('shows offline icon when offline prop is true', () => {
    setTranslation('common.offlineTitle', 'You are offline');
    setTranslation('common.offlineDescription', 'Check your internet connection.');

    const { toJSON } = render(<EmptyState title="Ignored" offline />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('cloud-offline-outline');
  });

  it('shows offline title from i18n', () => {
    setTranslation('common.offlineTitle', 'You are offline');
    setTranslation('common.offlineDescription', 'Check your internet connection.');

    render(<EmptyState title="Ignored" offline />);
    expect(screen.getByText('You are offline')).toBeTruthy();
  });

  it('shows offline description from i18n', () => {
    setTranslation('common.offlineTitle', 'You are offline');
    setTranslation('common.offlineDescription', 'Check your internet connection.');

    render(<EmptyState title="Ignored" offline />);
    expect(screen.getByText('Check your internet connection.')).toBeTruthy();
  });

  it('hides action button when offline', () => {
    setTranslation('common.offlineTitle', 'Offline');
    setTranslation('common.offlineDescription', 'No connection.');

    render(
      <EmptyState
        title="No Items"
        actionLabel="Add Item"
        onAction={jest.fn()}
        offline
      />
    );
    // Action button should be hidden in offline mode
    expect(screen.queryByText('Add Item')).toBeNull();
  });

  // ── Custom styles ──

  it('applies custom style', () => {
    const { toJSON } = render(
      <EmptyState title="Empty" style={{ marginTop: 40 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('40');
  });

  // ── Edge cases ──

  it('renders with empty title', () => {
    render(<EmptyState title="" />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders with very long title and description', () => {
    render(
      <EmptyState
        title={'T'.repeat(200)}
        description={'D'.repeat(500)}
      />
    );
    expect(screen.getByText('T'.repeat(200))).toBeTruthy();
    expect(screen.getByText('D'.repeat(500))).toBeTruthy();
  });
});
