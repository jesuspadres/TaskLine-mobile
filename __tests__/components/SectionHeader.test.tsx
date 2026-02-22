import React from 'react';
import { render, fireEvent, screen } from '../setup/testUtils';
import { SectionHeader } from '@/components/SectionHeader';

describe('SectionHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──

  it('renders the title', () => {
    render(<SectionHeader title="Recent Projects" />);
    expect(screen.getByText('Recent Projects')).toBeTruthy();
  });

  it('renders with icon', () => {
    const { toJSON } = render(
      <SectionHeader title="Tasks" icon="checkbox-outline" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('checkbox-outline');
  });

  it('does not render icon when not provided', () => {
    const { toJSON } = render(<SectionHeader title="Tasks" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain('checkbox-outline');
  });

  it('applies custom icon color', () => {
    const { toJSON } = render(
      <SectionHeader title="Tasks" icon="star" iconColor="#ff0000" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#ff0000');
  });

  // ── Badge count ──

  it('renders count badge when count > 0', () => {
    render(<SectionHeader title="Tasks" count={5} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('does not render count badge when count is 0', () => {
    render(<SectionHeader title="Tasks" count={0} />);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('does not render count badge when count is undefined', () => {
    render(<SectionHeader title="Tasks" />);
    // Should not crash, no count badge rendered
    expect(screen.getByText('Tasks')).toBeTruthy();
  });

  it('renders large count number', () => {
    render(<SectionHeader title="Tasks" count={999} />);
    expect(screen.getByText('999')).toBeTruthy();
  });

  // ── Action button ──

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = jest.fn();
    render(
      <SectionHeader title="Projects" actionLabel="View All" onAction={onAction} />
    );
    expect(screen.getByText('View All')).toBeTruthy();
  });

  it('calls onAction when action button is pressed', () => {
    const onAction = jest.fn();
    render(
      <SectionHeader title="Projects" actionLabel="View All" onAction={onAction} />
    );
    fireEvent.press(screen.getByText('View All'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when only actionLabel is provided (no onAction)', () => {
    render(<SectionHeader title="Projects" actionLabel="View All" />);
    expect(screen.queryByText('View All')).toBeNull();
  });

  it('does not render action button when only onAction is provided (no actionLabel)', () => {
    render(<SectionHeader title="Projects" onAction={jest.fn()} />);
    // No action label text to find
    expect(screen.getByText('Projects')).toBeTruthy();
  });

  // ── Edge cases ──

  it('renders with all props', () => {
    const onAction = jest.fn();
    render(
      <SectionHeader
        title="My Section"
        icon="folder-outline"
        iconColor="#3b82f6"
        count={12}
        actionLabel="See More"
        onAction={onAction}
      />
    );
    expect(screen.getByText('My Section')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('See More')).toBeTruthy();
  });

  it('renders with empty title', () => {
    render(<SectionHeader title="" />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders with very long title', () => {
    const longTitle = 'A'.repeat(200);
    render(<SectionHeader title={longTitle} />);
    expect(screen.getByText(longTitle)).toBeTruthy();
  });
});
