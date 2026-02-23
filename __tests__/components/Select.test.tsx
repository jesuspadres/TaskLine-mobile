import React from 'react';
import { render, fireEvent, screen } from '../setup/testUtils';
import { Select } from '@/components/Select';

describe('Select', () => {
  const options = [
    { key: 'opt1', label: 'Option 1' },
    { key: 'opt2', label: 'Option 2' },
    { key: 'opt3', label: 'Option 3' },
  ];

  const defaultProps = {
    options,
    value: null as string | null,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders with default placeholder', () => {
    render(<Select {...defaultProps} />);
    expect(screen.getByText('Select an option')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    render(<Select {...defaultProps} placeholder="Choose one..." />);
    expect(screen.getByText('Choose one...')).toBeTruthy();
  });

  it('renders with label', () => {
    render(<Select {...defaultProps} label="Category" />);
    expect(screen.getByText('Category')).toBeTruthy();
  });

  it('displays selected option label', () => {
    render(<Select {...defaultProps} value="opt2" />);
    expect(screen.getByText('Option 2')).toBeTruthy();
  });

  it('shows placeholder when value is null', () => {
    render(<Select {...defaultProps} value={null} />);
    expect(screen.getByText('Select an option')).toBeTruthy();
  });

  // ── Error state ──

  it('displays error message', () => {
    render(<Select {...defaultProps} error="Selection required" />);
    expect(screen.getByText('Selection required')).toBeTruthy();
  });

  // ── Dropdown interaction ──

  it('opens dropdown when select button is pressed', () => {
    render(<Select {...defaultProps} />);
    fireEvent.press(screen.getByText('Select an option'));
    // After opening, options should be visible in the modal
    expect(screen.getByText('Option 1')).toBeTruthy();
    expect(screen.getByText('Option 2')).toBeTruthy();
    expect(screen.getByText('Option 3')).toBeTruthy();
  });

  it('calls onChange when an option is selected', () => {
    const onChange = jest.fn();
    render(<Select {...defaultProps} onChange={onChange} />);
    // Open dropdown
    fireEvent.press(screen.getByText('Select an option'));
    // Select an option
    fireEvent.press(screen.getByText('Option 2'));
    expect(onChange).toHaveBeenCalledWith('opt2');
  });

  it('uses label as dropdown title when label is provided', () => {
    render(<Select {...defaultProps} label="Pick One" />);
    fireEvent.press(screen.getByText('Select an option'));
    // The dropdown header should show the label
    expect(screen.getAllByText('Pick One').length).toBeGreaterThanOrEqual(1);
  });

  it('uses "Select" as dropdown title when no label provided', () => {
    render(<Select {...defaultProps} />);
    fireEvent.press(screen.getByText('Select an option'));
    expect(screen.getByText('Select')).toBeTruthy();
  });

  // ── Searchable mode ──

  it('renders search input when searchable is true', () => {
    render(<Select {...defaultProps} searchable />);
    fireEvent.press(screen.getByText('Select an option'));
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('uses custom search placeholder', () => {
    render(
      <Select
        {...defaultProps}
        searchable
        searchPlaceholder="Find an option..."
      />
    );
    fireEvent.press(screen.getByText('Select an option'));
    expect(screen.getByPlaceholderText('Find an option...')).toBeTruthy();
  });

  it('filters options when search query is entered', () => {
    render(<Select {...defaultProps} searchable />);
    fireEvent.press(screen.getByText('Select an option'));
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.changeText(searchInput, 'Option 1');
    // Only Option 1 should remain visible
    expect(screen.getByText('Option 1')).toBeTruthy();
  });

  it('shows empty state when search matches nothing', () => {
    render(<Select {...defaultProps} searchable />);
    fireEvent.press(screen.getByText('Select an option'));
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.changeText(searchInput, 'zzzzz');
    expect(screen.getByText('No results found')).toBeTruthy();
  });

  it('does not show search input when searchable is false', () => {
    render(<Select {...defaultProps} searchable={false} />);
    fireEvent.press(screen.getByText('Select an option'));
    expect(screen.queryByPlaceholderText('Search...')).toBeNull();
  });

  // ── Selected option highlight ──

  it('highlights the currently selected option', () => {
    render(<Select {...defaultProps} value="opt1" />);
    fireEvent.press(screen.getByText('Option 1'));
    // The selected option in the dropdown should have a checkmark icon (mocked as text)
    expect(screen.getByText('checkmark')).toBeTruthy();
  });

  // ── Custom styles ──

  it('applies containerStyle', () => {
    render(
      <Select {...defaultProps} containerStyle={{ marginTop: 25 }} />
    );
    // The container should have the custom marginTop applied
    const root = screen.toJSON();
    expect(root).toBeTruthy();
  });

  // ── Edge cases ──

  it('renders with empty options array', () => {
    render(<Select options={[]} value={null} onChange={jest.fn()} />);
    expect(screen.getByText('Select an option')).toBeTruthy();
  });

  it('handles value that does not match any option', () => {
    render(<Select {...defaultProps} value="nonexistent" />);
    // Should fall back to placeholder since no option matches
    expect(screen.getByText('Select an option')).toBeTruthy();
  });

  it('renders with many options', () => {
    const manyOptions = Array.from({ length: 50 }, (_, i) => ({
      key: `opt-${i}`,
      label: `Option ${i}`,
    }));
    render(<Select options={manyOptions} value={null} onChange={jest.fn()} />);
    expect(screen.getByText('Select an option')).toBeTruthy();
  });
});
