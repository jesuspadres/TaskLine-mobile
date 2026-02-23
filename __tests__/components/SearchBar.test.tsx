import React from 'react';
import { render, fireEvent, screen } from '../setup/testUtils';
import { SearchBar } from '@/components/SearchBar';

describe('SearchBar', () => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders with default placeholder', () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    render(<SearchBar {...defaultProps} placeholder="Find clients..." />);
    expect(screen.getByPlaceholderText('Find clients...')).toBeTruthy();
  });

  it('renders the current value', () => {
    render(<SearchBar {...defaultProps} value="test query" />);
    expect(screen.getByDisplayValue('test query')).toBeTruthy();
  });

  // ── Interactions ──

  it('calls onChangeText when text is entered', () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByPlaceholderText('Search...'), 'hello');
    expect(onChangeText).toHaveBeenCalledWith('hello');
  });

  // ── Clear button ──

  it('does not show clear button when value is empty', () => {
    const { toJSON } = render(<SearchBar value="" onChangeText={jest.fn()} />);
    const tree = JSON.stringify(toJSON());
    // close-circle icon should not be present
    expect(tree).not.toContain('close-circle');
  });

  it('shows clear button when value is not empty', () => {
    const { toJSON } = render(
      <SearchBar value="query" onChangeText={jest.fn()} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('close-circle');
  });

  it('renders close-circle icon for clear functionality when value present', () => {
    const onChangeText = jest.fn();
    render(<SearchBar value="query" onChangeText={onChangeText} />);
    // Verify the clear button (close-circle icon) is rendered
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('close-circle');
  });

  // ── Custom styles ──

  it('applies custom container style', () => {
    const { toJSON } = render(
      <SearchBar {...defaultProps} style={{ marginBottom: 15 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('15');
  });

  // ── Edge cases ──

  it('renders with empty string value', () => {
    render(<SearchBar value="" onChangeText={jest.fn()} />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders with very long value', () => {
    const longValue = 'A'.repeat(500);
    render(<SearchBar value={longValue} onChangeText={jest.fn()} />);
    expect(screen.getByDisplayValue(longValue)).toBeTruthy();
  });

  it('has autoCapitalize set to none', () => {
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search...');
    expect(input.props.autoCapitalize).toBe('none');
  });

  it('has autoCorrect set to false', () => {
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search...');
    expect(input.props.autoCorrect).toBe(false);
  });
});
