import React from 'react';
import { render, fireEvent, screen } from '../setup/testUtils';
import { FilterChips } from '@/components/FilterChips';

describe('FilterChips', () => {
  const options = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'archived', label: 'Archived' },
  ];

  const defaultProps = {
    options,
    selected: 'all',
    onSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders all options', () => {
    render(<FilterChips {...defaultProps} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
  });

  it('renders with the selected chip highlighted', () => {
    const { toJSON } = render(
      <FilterChips {...defaultProps} selected="active" />
    );
    // The active chip should have primary backgroundColor
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#0B3D91'); // primary color for active chip
  });

  // ── Interactions ──

  it('calls onSelect when a chip is pressed', () => {
    const onSelect = jest.fn();
    render(<FilterChips {...defaultProps} onSelect={onSelect} />);
    fireEvent.press(screen.getByText('Active'));
    expect(onSelect).toHaveBeenCalledWith('active');
  });

  it('calls onSelect with correct key for each chip', () => {
    const onSelect = jest.fn();
    render(<FilterChips {...defaultProps} onSelect={onSelect} />);

    fireEvent.press(screen.getByText('Completed'));
    expect(onSelect).toHaveBeenCalledWith('completed');

    fireEvent.press(screen.getByText('Archived'));
    expect(onSelect).toHaveBeenCalledWith('archived');
  });

  it('calls onSelect for already selected chip', () => {
    const onSelect = jest.fn();
    render(
      <FilterChips {...defaultProps} selected="all" onSelect={onSelect} />
    );
    fireEvent.press(screen.getByText('All'));
    expect(onSelect).toHaveBeenCalledWith('all');
  });

  // ── Active state styling ──

  it('applies white color to active chip text', () => {
    const { toJSON } = render(
      <FilterChips {...defaultProps} selected="active" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#fff');
  });

  // ── Scrollable mode ──

  it('renders in scrollable mode when scrollable is true', () => {
    render(<FilterChips {...defaultProps} scrollable />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('renders without scroll wrapper by default', () => {
    render(<FilterChips {...defaultProps} />);
    // All chips should be visible
    expect(screen.getByText('All')).toBeTruthy();
  });

  // ── Custom styles ──

  it('applies custom container style', () => {
    const { toJSON } = render(
      <FilterChips {...defaultProps} style={{ marginHorizontal: 20 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('20');
  });

  // ── Edge cases ──

  it('renders with empty options array', () => {
    render(<FilterChips options={[]} selected="" onSelect={jest.fn()} />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders with a single option', () => {
    render(
      <FilterChips
        options={[{ key: 'only', label: 'Only Option' }]}
        selected="only"
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText('Only Option')).toBeTruthy();
  });

  it('renders with many options', () => {
    const manyOptions = Array.from({ length: 20 }, (_, i) => ({
      key: `opt-${i}`,
      label: `Option ${i}`,
    }));
    render(
      <FilterChips options={manyOptions} selected="opt-0" onSelect={jest.fn()} />
    );
    expect(screen.getByText('Option 0')).toBeTruthy();
    expect(screen.getByText('Option 19')).toBeTruthy();
  });

  it('handles selected key not matching any option', () => {
    render(
      <FilterChips
        {...defaultProps}
        selected="nonexistent"
      />
    );
    // No chip should be highlighted but all should render
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });
});
