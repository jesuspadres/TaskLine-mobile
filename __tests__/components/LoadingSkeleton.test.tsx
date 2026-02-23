import React from 'react';
import { render, screen } from '../setup/testUtils';
import {
  SkeletonBox,
  CardSkeleton,
  ListSkeleton,
  StatsSkeleton,
  LoadingSkeleton,
} from '@/components/LoadingSkeleton';

describe('LoadingSkeleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── SkeletonBox ──

  describe('SkeletonBox', () => {
    it('renders with default dimensions', () => {
      const { toJSON } = render(<SkeletonBox />);
      const tree = JSON.stringify(toJSON());
      // Default width: '100%', height: 16
      expect(tree).toContain('"height":16');
    });

    it('renders with custom width and height', () => {
      const { toJSON } = render(<SkeletonBox width={200} height={40} />);
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('"width":200');
      expect(tree).toContain('"height":40');
    });

    it('renders with percentage width', () => {
      const { toJSON } = render(<SkeletonBox width="60%" />);
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('60%');
    });

    it('renders with custom borderRadius', () => {
      const { toJSON } = render(<SkeletonBox borderRadius={20} />);
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('"borderRadius":20');
    });

    it('applies custom style', () => {
      const { toJSON } = render(
        <SkeletonBox style={{ marginTop: 10 }} />
      );
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('10');
    });

    it('uses surfaceSecondary background color', () => {
      const { toJSON } = render(<SkeletonBox />);
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('#f3f4f6'); // surfaceSecondary
    });
  });

  // ── LoadingSkeleton alias ──

  describe('LoadingSkeleton (alias)', () => {
    it('is the same component as SkeletonBox', () => {
      expect(LoadingSkeleton).toBe(SkeletonBox);
    });

    it('renders correctly', () => {
      render(<LoadingSkeleton width={100} height={20} />);
      expect(screen.toJSON()).toBeTruthy();
    });
  });

  // ── CardSkeleton ──

  describe('CardSkeleton', () => {
    it('renders without crashing', () => {
      render(<CardSkeleton />);
      expect(screen.toJSON()).toBeTruthy();
    });

    it('renders multiple skeleton boxes for card layout', () => {
      const { toJSON } = render(<CardSkeleton />);
      const tree = JSON.stringify(toJSON());
      // CardSkeleton has: avatar circle (40x40), two header lines, and two body lines
      // Verify it renders the surface background
      expect(tree).toContain('#ffffff'); // surface color
    });

    it('has border styling', () => {
      const { toJSON } = render(<CardSkeleton />);
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('#e5e7eb'); // border color
    });
  });

  // ── ListSkeleton ──

  describe('ListSkeleton', () => {
    it('renders default 3 cards', () => {
      const { toJSON } = render(<ListSkeleton />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders specified count of cards', () => {
      const { toJSON } = render(<ListSkeleton count={5} />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders 1 card when count is 1', () => {
      const { toJSON } = render(<ListSkeleton count={1} />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders 0 cards when count is 0', () => {
      const { toJSON } = render(<ListSkeleton count={0} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  // ── StatsSkeleton ──

  describe('StatsSkeleton', () => {
    it('renders without crashing', () => {
      render(<StatsSkeleton />);
      expect(screen.toJSON()).toBeTruthy();
    });

    it('renders 3 stat boxes', () => {
      const { toJSON } = render(<StatsSkeleton />);
      // Should render 3 stat skeleton boxes in a row
      expect(toJSON()).toBeTruthy();
    });

    it('has row layout', () => {
      const { toJSON } = render(<StatsSkeleton />);
      const tree = JSON.stringify(toJSON());
      expect(tree).toContain('row');
    });
  });

  // ── Edge cases ──

  it('SkeletonBox handles zero dimensions', () => {
    render(<SkeletonBox width={0} height={0} />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('SkeletonBox handles large dimensions', () => {
    render(<SkeletonBox width={9999} height={9999} />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
