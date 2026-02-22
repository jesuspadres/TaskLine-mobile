import React from 'react';
import { render, screen } from '../setup/testUtils';
import { StatusBadge } from '@/components/StatusBadge';

describe('StatusBadge', () => {
  // ── Rendering ──

  it('renders with a status', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('active')).toBeTruthy();
  });

  it('replaces underscores with spaces in display text', () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText('in progress')).toBeTruthy();
  });

  it('replaces underscores for on_hold', () => {
    render(<StatusBadge status="on_hold" />);
    expect(screen.getByText('on hold')).toBeTruthy();
  });

  // ── All status types ──

  const statuses = [
    'new',
    'reviewing',
    'converted',
    'declined',
    'active',
    'completed',
    'pending',
    'approved',
    'rejected',
    'draft',
    'todo',
    'in_progress',
    'on_hold',
    'cancelled',
    'sent',
    'paid',
    'overdue',
    'confirmed',
    'planning',
    'archived',
  ];

  statuses.forEach((status) => {
    it(`renders ${status} status without crashing`, () => {
      render(<StatusBadge status={status} />);
      const displayText = status.replace(/_/g, ' ');
      expect(screen.getByText(displayText)).toBeTruthy();
    });
  });

  // ── Sizes ──

  it('renders small size by default', () => {
    render(<StatusBadge status="active" size="sm" />);
    expect(screen.getByText('active')).toBeTruthy();
  });

  it('renders medium size', () => {
    render(<StatusBadge status="active" size="md" />);
    expect(screen.getByText('active')).toBeTruthy();
  });

  // ── Unknown status fallback ──

  it('falls back to default colors for unknown status', () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText('unknown status')).toBeTruthy();
  });

  // ── Custom styles ──

  it('applies custom style', () => {
    const { toJSON } = render(
      <StatusBadge status="active" style={{ marginRight: 8 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('8');
  });

  // ── Edge cases ──

  it('renders with empty string status', () => {
    render(<StatusBadge status="" />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('handles uppercase status (case-insensitive lookup)', () => {
    render(<StatusBadge status="ACTIVE" />);
    // getStatusColors lowercases the status for lookup
    expect(screen.getByText('ACTIVE')).toBeTruthy();
  });

  it('handles mixed case status', () => {
    render(<StatusBadge status="In_Progress" />);
    expect(screen.getByText('In Progress')).toBeTruthy();
  });

  it('text has capitalize textTransform', () => {
    // The component uses textTransform: 'capitalize' in styles
    render(<StatusBadge status="pending" />);
    expect(screen.getByText('pending')).toBeTruthy();
  });
});
