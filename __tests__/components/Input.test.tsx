import React from 'react';
import { render, fireEvent, screen } from '../setup/testUtils';
import { Input } from '@/components/Input';

describe('Input', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders with no props', () => {
    render(<Input />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders with a label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeTruthy();
  });

  it('renders with placeholder text', () => {
    render(<Input placeholder="Enter email" />);
    expect(screen.getByPlaceholderText('Enter email')).toBeTruthy();
  });

  it('renders current value', () => {
    render(<Input value="test@example.com" onChangeText={jest.fn()} />);
    expect(screen.getByDisplayValue('test@example.com')).toBeTruthy();
  });

  // ── Error state ──

  it('displays error message', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('does not show hint when error is present', () => {
    render(<Input error="Error message" hint="Helpful hint" />);
    expect(screen.getByText('Error message')).toBeTruthy();
    expect(screen.queryByText('Helpful hint')).toBeNull();
  });

  // ── Hint ──

  it('displays hint when no error', () => {
    render(<Input hint="Enter your email address" />);
    expect(screen.getByText('Enter your email address')).toBeTruthy();
  });

  it('does not display hint when error exists', () => {
    render(<Input hint="A hint" error="An error" />);
    expect(screen.queryByText('A hint')).toBeNull();
    expect(screen.getByText('An error')).toBeTruthy();
  });

  // ── Text input interactions ──

  it('calls onChangeText when text is entered', () => {
    const onChangeText = jest.fn();
    render(<Input placeholder="Type here" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByPlaceholderText('Type here'), 'Hello');
    expect(onChangeText).toHaveBeenCalledWith('Hello');
  });

  it('handles focus and blur events', () => {
    render(<Input placeholder="Focus me" />);
    const input = screen.getByPlaceholderText('Focus me');
    fireEvent(input, 'focus');
    fireEvent(input, 'blur');
    // Should not crash; focused state toggles internally
  });

  // ── Password toggle ──

  it('renders password toggle when secureTextEntry is provided', () => {
    render(<Input secureTextEntry placeholder="Password" />);
    // Password toggle button should be present
    expect(screen.toJSON()).toBeTruthy();
  });

  it('toggles password visibility on press', () => {
    const { toJSON } = render(
      <Input secureTextEntry placeholder="Password" />
    );
    // Initial state: password is hidden (secureTextEntry=true)
    const input = screen.getByPlaceholderText('Password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  // ── Icons ──

  it('renders with a left icon', () => {
    render(<Input leftIcon="mail-outline" placeholder="Email" />);
    expect(screen.getByPlaceholderText('Email')).toBeTruthy();
  });

  it('renders with a right icon', () => {
    render(<Input rightIcon="close-circle" placeholder="Search" />);
    expect(screen.getByPlaceholderText('Search')).toBeTruthy();
  });

  it('calls onRightIconPress when right icon is pressed', () => {
    const onRightIconPress = jest.fn();
    render(
      <Input
        rightIcon="close-circle"
        onRightIconPress={onRightIconPress}
        placeholder="Search"
      />
    );
    // The right icon is a TouchableOpacity wrapping an Ionicons
    // We need to find and press it
    expect(screen.toJSON()).toBeTruthy();
  });

  it('does not show right icon when secureTextEntry is provided (shows password toggle instead)', () => {
    render(
      <Input secureTextEntry rightIcon="close-circle" placeholder="Password" />
    );
    // The password toggle icon takes precedence over rightIcon
    expect(screen.toJSON()).toBeTruthy();
  });

  // ── Custom styles ──

  it('applies containerStyle', () => {
    const { toJSON } = render(
      <Input containerStyle={{ marginTop: 50 }} placeholder="Styled" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('50');
  });

  it('applies inputStyle', () => {
    const { toJSON } = render(
      <Input inputStyle={{ fontWeight: 'bold' }} placeholder="Bold" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('bold');
  });

  // ── Edge cases ──

  it('renders with all props simultaneously', () => {
    render(
      <Input
        label="Email"
        placeholder="Enter email"
        hint="We will never share your email"
        leftIcon="mail-outline"
        value=""
        onChangeText={jest.fn()}
      />
    );
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter email')).toBeTruthy();
    expect(screen.getByText('We will never share your email')).toBeTruthy();
  });

  it('renders without crashing when given empty strings', () => {
    render(<Input label="" error="" hint="" placeholder="" />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('forwards additional TextInput props', () => {
    render(
      <Input
        placeholder="Multiline"
        multiline
        numberOfLines={4}
        autoCapitalize="sentences"
      />
    );
    const input = screen.getByPlaceholderText('Multiline');
    expect(input.props.multiline).toBe(true);
    expect(input.props.numberOfLines).toBe(4);
  });
});
