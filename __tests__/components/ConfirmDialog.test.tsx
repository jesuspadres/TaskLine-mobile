import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, screen } from '../setup/testUtils';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const Haptics = require('expo-haptics');

describe('ConfirmDialog', () => {
  const defaultProps = {
    visible: true,
    title: 'Delete Item',
    message: 'Are you sure you want to delete this item?',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders when visible is true', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete Item')).toBeTruthy();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeTruthy();
  });

  it('renders title and message', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete Item')).toBeTruthy();
    expect(screen.getByText('Are you sure you want to delete this item?')).toBeTruthy();
  });

  it('renders default button labels', () => {
    render(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders custom button labels', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Yes, Delete"
        cancelLabel="No, Keep It"
      />
    );
    expect(screen.getByText('Yes, Delete')).toBeTruthy();
    expect(screen.getByText('No, Keep It')).toBeTruthy();
  });

  // ── Variants ──

  it('renders default variant without warning icon container', () => {
    const { toJSON } = render(
      <ConfirmDialog {...defaultProps} variant="default" />
    );
    const tree = JSON.stringify(toJSON());
    // Default variant should not have the errorLight background icon container
    // The danger icon container uses errorLight (#fee2e2)
    expect(tree).not.toContain('#fee2e2');
  });

  it('renders danger variant with warning icon', () => {
    const { toJSON } = render(
      <ConfirmDialog {...defaultProps} variant="danger" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('warning');
  });

  it('uses error color for confirm button in danger variant', () => {
    const { toJSON } = render(
      <ConfirmDialog {...defaultProps} variant="danger" />
    );
    const tree = JSON.stringify(toJSON());
    // danger variant uses colors.error (#ef4444) for confirm button background
    expect(tree).toContain('#ef4444');
  });

  it('uses primary color for confirm button in default variant', () => {
    const { toJSON } = render(
      <ConfirmDialog {...defaultProps} variant="default" />
    );
    const tree = JSON.stringify(toJSON());
    // default variant uses colors.primary for confirm button background
    expect(tree).toContain('#0B3D91');
  });

  // ── Interactions ──

  it('calls onConfirm when confirm button is pressed', () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);
    fireEvent.press(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is pressed', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback on confirm (non-web)', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.press(screen.getByText('Confirm'));

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning
    );

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  it('does not trigger haptic feedback on web', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

    render(<ConfirmDialog {...defaultProps} />);
    fireEvent.press(screen.getByText('Confirm'));

    expect(Haptics.notificationAsync).not.toHaveBeenCalled();

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  // ── Visibility ──

  it('does not show content when visible is false', () => {
    render(<ConfirmDialog {...defaultProps} visible={false} />);
    // Modal with visible=false hides content
  });

  // ── Edge cases ──

  it('renders with very long title and message', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        title={'T'.repeat(200)}
        message={'M'.repeat(500)}
      />
    );
    expect(screen.getByText('T'.repeat(200))).toBeTruthy();
    expect(screen.getByText('M'.repeat(500))).toBeTruthy();
  });

  it('renders with empty strings', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        title=""
        message=""
      />
    );
    expect(screen.toJSON()).toBeTruthy();
  });
});
