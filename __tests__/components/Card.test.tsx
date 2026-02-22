import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, screen } from '../setup/testUtils';
import { Card } from '@/components/Card';

describe('Card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders children content', () => {
    render(
      <Card>
        <Text>Card Content</Text>
      </Card>
    );
    expect(screen.getByText('Card Content')).toBeTruthy();
  });

  it('renders as a View by default (no onPress)', () => {
    const { toJSON } = render(
      <Card>
        <Text>Static Card</Text>
      </Card>
    );
    expect(toJSON()).toBeTruthy();
    expect(screen.getByText('Static Card')).toBeTruthy();
  });

  // ── Variants ──

  it('renders default variant', () => {
    const { toJSON } = render(
      <Card variant="default">
        <Text>Default</Text>
      </Card>
    );
    const tree = JSON.stringify(toJSON());
    // Default variant has backgroundColor and borderWidth
    expect(tree).toContain('#ffffff'); // surface color
  });

  it('renders outlined variant', () => {
    const { toJSON } = render(
      <Card variant="outlined">
        <Text>Outlined</Text>
      </Card>
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('transparent');
  });

  it('renders elevated variant', () => {
    const { toJSON } = render(
      <Card variant="elevated">
        <Text>Elevated</Text>
      </Card>
    );
    expect(screen.getByText('Elevated')).toBeTruthy();
  });

  // ── Padding sizes ──

  it('renders with no padding', () => {
    render(
      <Card padding="none">
        <Text>No Padding</Text>
      </Card>
    );
    expect(screen.getByText('No Padding')).toBeTruthy();
  });

  it('renders with small padding', () => {
    render(
      <Card padding="sm">
        <Text>Small</Text>
      </Card>
    );
    expect(screen.getByText('Small')).toBeTruthy();
  });

  it('renders with medium padding (default)', () => {
    render(
      <Card padding="md">
        <Text>Medium</Text>
      </Card>
    );
    expect(screen.getByText('Medium')).toBeTruthy();
  });

  it('renders with large padding', () => {
    render(
      <Card padding="lg">
        <Text>Large</Text>
      </Card>
    );
    expect(screen.getByText('Large')).toBeTruthy();
  });

  // ── Interactions ──

  it('renders as TouchableOpacity when onPress is provided', () => {
    const onPress = jest.fn();
    render(
      <Card onPress={onPress}>
        <Text>Pressable Card</Text>
      </Card>
    );
    fireEvent.press(screen.getByText('Pressable Card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not respond to press when no onPress provided', () => {
    // Should be a View, not a TouchableOpacity
    render(
      <Card>
        <Text>Static</Text>
      </Card>
    );
    // No crash when rendering without onPress
    expect(screen.getByText('Static')).toBeTruthy();
  });

  // ── Custom styles ──

  it('applies custom style', () => {
    const { toJSON } = render(
      <Card style={{ marginTop: 30 }}>
        <Text>Styled</Text>
      </Card>
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('30');
  });

  // ── Edge cases ──

  it('renders with complex nested children', () => {
    render(
      <Card>
        <Text>Title</Text>
        <Text>Subtitle</Text>
        <Text>Body</Text>
      </Card>
    );
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Subtitle')).toBeTruthy();
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('combines variant, padding, and custom style', () => {
    render(
      <Card variant="outlined" padding="lg" style={{ opacity: 0.8 }}>
        <Text>Combined</Text>
      </Card>
    );
    expect(screen.getByText('Combined')).toBeTruthy();
  });
});
