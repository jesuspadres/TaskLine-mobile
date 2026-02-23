import React from 'react';
import { Text, Platform } from 'react-native';
import { render, fireEvent, screen } from '../setup/testUtils';
import { Button } from '@/components/Button';

// Access the mocked Haptics module
const Haptics = require('expo-haptics');

describe('Button', () => {
  const defaultProps = {
    title: 'Press Me',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders with default props', () => {
    render(<Button {...defaultProps} />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders the title text', () => {
    render(<Button title="Save" onPress={jest.fn()} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders an icon when provided', () => {
    const icon = <Text testID="icon">ICON</Text>;
    render(<Button {...defaultProps} icon={icon} />);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });

  // ── Variants ──

  it('renders primary variant by default', () => {
    const { toJSON } = render(<Button {...defaultProps} />);
    const tree = toJSON();
    // Primary variant should have primary background color
    expect(tree).toBeTruthy();
  });

  it('renders secondary variant', () => {
    render(<Button {...defaultProps} variant="secondary" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders danger variant', () => {
    render(<Button {...defaultProps} variant="danger" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders ghost variant', () => {
    render(<Button {...defaultProps} variant="ghost" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  // ── Sizes ──

  it('renders small size', () => {
    render(<Button {...defaultProps} size="sm" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders medium size (default)', () => {
    render(<Button {...defaultProps} size="md" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders large size', () => {
    render(<Button {...defaultProps} size="lg" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  // ── Interactions ──

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button title="Click" onPress={onPress} />);
    fireEvent.press(screen.getByText('Click'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback on press (non-web)', () => {
    // Platform is already set to non-web by default in test env
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });

    const onPress = jest.fn();
    render(<Button title="Tap" onPress={onPress} />);
    fireEvent.press(screen.getByText('Tap'));

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
    expect(onPress).toHaveBeenCalled();

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  it('does not trigger haptic feedback on web', () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });

    const onPress = jest.fn();
    render(<Button title="Tap" onPress={onPress} />);
    fireEvent.press(screen.getByText('Tap'));

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(onPress).toHaveBeenCalled();

    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  // ── States ──

  it('shows ActivityIndicator when loading', () => {
    const { toJSON } = render(<Button {...defaultProps} loading />);
    const tree = JSON.stringify(toJSON());
    // When loading, the title text should NOT be rendered
    expect(screen.queryByText('Press Me')).toBeNull();
  });

  it('is not pressable when loading', () => {
    const onPress = jest.fn();
    const { UNSAFE_root } = render(<Button title="Click" onPress={onPress} loading />);
    // The button is disabled when loading, so pressing it should not trigger onPress
    fireEvent.press(UNSAFE_root);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is not pressable when disabled', () => {
    const onPress = jest.fn();
    render(<Button title="Click" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Click'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('applies disabled opacity when disabled', () => {
    const { toJSON } = render(<Button {...defaultProps} disabled />);
    const tree = JSON.stringify(toJSON());
    // Disabled style includes opacity: 0.5
    expect(tree).toContain('0.5');
  });

  it('applies disabled opacity when loading', () => {
    const { toJSON } = render(<Button {...defaultProps} loading />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('0.5');
  });

  // ── Full Width ──

  it('applies fullWidth style', () => {
    const { toJSON } = render(<Button {...defaultProps} fullWidth />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('100%');
  });

  // ── Custom styles ──

  it('applies custom style to container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} style={{ marginTop: 20 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('20');
  });

  it('applies custom textStyle', () => {
    const { toJSON } = render(
      <Button {...defaultProps} textStyle={{ letterSpacing: 2 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('2');
  });

  // ── Edge cases ──

  it('renders with empty title', () => {
    render(<Button title="" onPress={jest.fn()} />);
    // Should not crash
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders with very long title', () => {
    const longTitle = 'A'.repeat(200);
    render(<Button title={longTitle} onPress={jest.fn()} />);
    expect(screen.getByText(longTitle)).toBeTruthy();
  });
});
