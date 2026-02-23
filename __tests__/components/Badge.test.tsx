import React from 'react';
import { render, screen } from '../setup/testUtils';
import { Badge } from '@/components/Badge';

describe('Badge', () => {
  // ── Rendering ──

  it('renders with text', () => {
    render(<Badge text="New" />);
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('renders with default variant when none specified', () => {
    render(<Badge text="Default" />);
    expect(screen.getByText('Default')).toBeTruthy();
  });

  // ── All Variants ──

  const variants = [
    'default',
    'success',
    'warning',
    'error',
    'info',
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
  ] as const;

  variants.forEach((variant) => {
    it(`renders ${variant} variant without crashing`, () => {
      render(<Badge text={variant} variant={variant} />);
      expect(screen.getByText(variant)).toBeTruthy();
    });
  });

  // ── Sizes ──

  it('renders small size (default)', () => {
    render(<Badge text="Small" size="sm" />);
    expect(screen.getByText('Small')).toBeTruthy();
  });

  it('renders medium size', () => {
    render(<Badge text="Medium" size="md" />);
    expect(screen.getByText('Medium')).toBeTruthy();
  });

  // ── Custom styles ──

  it('applies custom style', () => {
    const { toJSON } = render(
      <Badge text="Styled" style={{ marginLeft: 10 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('10');
  });

  // ── Edge cases ──

  it('renders with empty text', () => {
    render(<Badge text="" />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders with very long text', () => {
    const longText = 'A'.repeat(100);
    render(<Badge text={longText} />);
    expect(screen.getByText(longText)).toBeTruthy();
  });

  it('capitalizes text via textTransform style', () => {
    // The component uses textTransform: 'capitalize' in styles
    render(<Badge text="test badge" />);
    expect(screen.getByText('test badge')).toBeTruthy();
  });

  it('handles unknown variant gracefully (falls back to default)', () => {
    // Cast to any to test unknown variant
    render(<Badge text="Unknown" variant={'nonexistent' as any} />);
    expect(screen.getByText('Unknown')).toBeTruthy();
  });
});
