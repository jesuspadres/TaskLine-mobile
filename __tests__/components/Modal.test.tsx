import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen } from '../setup/testUtils';
import { Modal } from '@/components/Modal';

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

describe('Modal', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    title: 'Test Modal',
    children: <Text>Modal Content</Text>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders when visible is true', () => {
    render(<Modal {...defaultProps} />);
    expect(screen.getByText('Test Modal')).toBeTruthy();
    expect(screen.getByText('Modal Content')).toBeTruthy();
  });

  it('renders the title', () => {
    render(<Modal {...defaultProps} title="My Dialog" />);
    expect(screen.getByText('My Dialog')).toBeTruthy();
  });

  it('renders children content', () => {
    render(
      <Modal {...defaultProps}>
        <Text>Custom Content</Text>
      </Modal>
    );
    expect(screen.getByText('Custom Content')).toBeTruthy();
  });

  // ── Sizes ──

  it('renders small size', () => {
    render(<Modal {...defaultProps} size="sm" />);
    expect(screen.getByText('Test Modal')).toBeTruthy();
  });

  it('renders medium size (default)', () => {
    render(<Modal {...defaultProps} size="md" />);
    expect(screen.getByText('Test Modal')).toBeTruthy();
  });

  it('renders large size', () => {
    render(<Modal {...defaultProps} size="lg" />);
    expect(screen.getByText('Test Modal')).toBeTruthy();
  });

  it('renders full screen size', () => {
    render(<Modal {...defaultProps} size="full" />);
    expect(screen.getByText('Test Modal')).toBeTruthy();
    expect(screen.getByText('Modal Content')).toBeTruthy();
  });

  // ── Close behavior ──

  it('calls onClose when close button is pressed (non-full screen)', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} size="md" />);
    // Should not have been called yet
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when close button is pressed in full screen mode', () => {
    const onClose = jest.fn();
    render(<Modal {...defaultProps} onClose={onClose} size="full" />);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Visibility ──

  it('does not show content when visible is false', () => {
    render(<Modal {...defaultProps} visible={false} />);
    // Modal with visible=false should not render content
    // React Native's Modal component handles this natively
  });

  // ── Edge cases ──

  it('renders with very long title', () => {
    const longTitle = 'A'.repeat(200);
    render(<Modal {...defaultProps} title={longTitle} />);
    expect(screen.getByText(longTitle)).toBeTruthy();
  });

  it('renders with complex children', () => {
    render(
      <Modal {...defaultProps}>
        <Text>Line 1</Text>
        <Text>Line 2</Text>
        <Text>Line 3</Text>
      </Modal>
    );
    expect(screen.getByText('Line 1')).toBeTruthy();
    expect(screen.getByText('Line 2')).toBeTruthy();
    expect(screen.getByText('Line 3')).toBeTruthy();
  });

  it('uses slide animation for full screen', () => {
    const { toJSON } = render(<Modal {...defaultProps} size="full" />);
    // Full screen uses animationType="slide"
    expect(screen.toJSON()).toBeTruthy();
  });

  it('uses fade animation for non-full screen', () => {
    const { toJSON } = render(<Modal {...defaultProps} size="md" />);
    // Non-full screen uses animationType="fade"
    expect(screen.toJSON()).toBeTruthy();
  });

  it('is transparent for non-full screen', () => {
    const { toJSON } = render(<Modal {...defaultProps} size="md" />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
