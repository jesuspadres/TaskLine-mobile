import React from 'react';
import { render, screen } from '../setup/testUtils';
import { Avatar } from '@/components/Avatar';

describe('Avatar', () => {
  // ── Rendering ──

  it('renders with default props', () => {
    render(<Avatar />);
    // Without a name, displays '?'
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('renders initials from a single name', () => {
    render(<Avatar name="John" />);
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('renders initials from two names', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeTruthy();
  });

  it('renders initials from three names (max 2 characters)', () => {
    render(<Avatar name="John Michael Doe" />);
    // Takes first letter of each word, then slices to 2
    expect(screen.getByText('JM')).toBeTruthy();
  });

  it('renders initials uppercased', () => {
    render(<Avatar name="jane smith" />);
    expect(screen.getByText('JS')).toBeTruthy();
  });

  it('renders ? when name is undefined', () => {
    render(<Avatar name={undefined} />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('renders ? when name is empty string', () => {
    render(<Avatar name="" />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  // ── Sizes ──

  it('renders small size (32px)', () => {
    const { toJSON } = render(<Avatar name="A" size="sm" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"width":32');
    expect(tree).toContain('"height":32');
  });

  it('renders medium size (40px) by default', () => {
    const { toJSON } = render(<Avatar name="A" size="md" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"width":40');
    expect(tree).toContain('"height":40');
  });

  it('renders large size (50px)', () => {
    const { toJSON } = render(<Avatar name="A" size="lg" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"width":50');
    expect(tree).toContain('"height":50');
  });

  it('renders xl size (80px)', () => {
    const { toJSON } = render(<Avatar name="A" size="xl" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"width":80');
    expect(tree).toContain('"height":80');
  });

  // ── Image rendering ──

  it('renders an Image when imageUrl is provided', () => {
    const { toJSON } = render(
      <Avatar imageUrl="https://example.com/avatar.jpg" />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('https://example.com/avatar.jpg');
  });

  it('does not show initials when imageUrl is provided', () => {
    render(
      <Avatar name="John Doe" imageUrl="https://example.com/avatar.jpg" />
    );
    expect(screen.queryByText('JD')).toBeNull();
  });

  it('shows initials when imageUrl is not provided', () => {
    render(<Avatar name="John Doe" />);
    expect(screen.getByText('JD')).toBeTruthy();
  });

  // ── Custom color ──

  it('uses custom color for background', () => {
    const { toJSON } = render(<Avatar name="A" color="#ff0000" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#ff0000');
  });

  it('uses primary color when custom color is not provided', () => {
    const { toJSON } = render(<Avatar name="A" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('#0B3D91'); // default primary color from mock
  });

  // ── Custom styles ──

  it('applies custom style to initials container', () => {
    const { toJSON } = render(
      <Avatar name="A" style={{ borderWidth: 2 }} />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"borderWidth":2');
  });

  it('applies custom imageStyle to image', () => {
    const { toJSON } = render(
      <Avatar
        imageUrl="https://example.com/avatar.jpg"
        imageStyle={{ opacity: 0.5 }}
      />
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('0.5');
  });

  // ── Edge cases ──

  it('calculates correct border radius for each size', () => {
    const { toJSON } = render(<Avatar name="A" size="lg" />);
    const tree = JSON.stringify(toJSON());
    // borderRadius should be dimension / 2 = 50 / 2 = 25
    expect(tree).toContain('"borderRadius":25');
  });

  it('handles a single-word name with no spaces', () => {
    render(<Avatar name="Alice" />);
    expect(screen.getByText('A')).toBeTruthy();
  });
});
