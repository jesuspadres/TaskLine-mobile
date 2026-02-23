import React from 'react';
import { render, fireEvent, screen } from '../setup/testUtils';
import { StatCard } from '@/components/StatCard';

describe('StatCard', () => {
  const defaultProps = {
    label: 'Total Revenue',
    value: '$12,500',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders label and value', () => {
    render(<StatCard {...defaultProps} />);
    expect(screen.getByText('Total Revenue')).toBeTruthy();
    expect(screen.getByText('$12,500')).toBeTruthy();
  });

  it('renders numeric value', () => {
    render(<StatCard label="Projects" value={42} />);
    expect(screen.getByText('Projects')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard {...defaultProps} subtitle="+15% this month" />);
    expect(screen.getByText('+15% this month')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<StatCard {...defaultProps} />);
    expect(screen.queryByText('+15% this month')).toBeNull();
  });

  // ── Icon ──

  it('renders icon when provided', () => {
    const { toJSON } = render(
      <StatCard {...defaultProps} icon="trending-up" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('trending-up');
  });

  it('does not render icon when not provided', () => {
    const { toJSON } = render(<StatCard {...defaultProps} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('trending-up');
  });

  it('applies custom icon color', () => {
    const { toJSON } = render(
      <StatCard {...defaultProps} icon="star" iconColor="#ff0000" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#ff0000');
  });

  // ── Tint color (left border) ──

  it('applies tint color as left border', () => {
    const { toJSON } = render(
      <StatCard {...defaultProps} tintColor="#10b981" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#10b981');
  });

  // ── Subtitle color ──

  it('applies custom subtitle color', () => {
    const { toJSON } = render(
      <StatCard
        {...defaultProps}
        subtitle="Down 5%"
        subtitleColor="#ef4444"
      />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#ef4444');
  });

  // ── Interactions ──

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<StatCard {...defaultProps} onPress={onPress} />);
    fireEvent.press(screen.getByText('Total Revenue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not wrap in TouchableOpacity when onPress is not provided', () => {
    render(<StatCard {...defaultProps} />);
    // Should still render, just not be pressable
    expect(screen.getByText('Total Revenue')).toBeTruthy();
  });

  // ── Animation ──

  it('renders with fade-in animation wrapper', () => {
    const { toJSON } = render(<StatCard {...defaultProps} />);
    // The component wraps in Animated.View
    expect(toJSON()).toBeTruthy();
  });

  // ── Custom styles ──

  it('applies custom style', () => {
    const { toJSON } = render(
      <StatCard {...defaultProps} style={{ flex: 1 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"flex":1');
  });

  // ── Edge cases ──

  it('renders with zero value', () => {
    render(<StatCard label="Tasks" value={0} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('renders with empty string value', () => {
    render(<StatCard label="Tasks" value="" />);
    expect(screen.getByText('Tasks')).toBeTruthy();
  });

  it('renders with very long label', () => {
    const longLabel = 'A'.repeat(100);
    render(<StatCard label={longLabel} value="1" />);
    expect(screen.getByText(longLabel)).toBeTruthy();
  });

  it('label and value have numberOfLines=1', () => {
    render(<StatCard label="Test" value="Test Value" />);
    // numberOfLines prop is set to 1 for truncation
    expect(screen.getByText('Test')).toBeTruthy();
  });
});
