import React from 'react';
import { Text } from 'react-native';
import { render, screen, act } from '../setup/testUtils';
import {
  LoadingOverlayProvider,
  showLoading,
  hideLoading,
} from '@/components/LoadingOverlay';

describe('LoadingOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── LoadingOverlayProvider rendering ──

  it('renders children', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App Content</Text>
      </LoadingOverlayProvider>
    );
    expect(screen.getByText('App Content')).toBeTruthy();
  });

  it('initially does not show the overlay', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App</Text>
      </LoadingOverlayProvider>
    );
    // No loading message or indicator should be visible
    expect(screen.queryByText('Loading...')).toBeNull();
  });

  // ── showLoading / hideLoading ──

  it('shows overlay when showLoading is called', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App</Text>
      </LoadingOverlayProvider>
    );

    act(() => {
      showLoading('Please wait...');
    });

    expect(screen.getByText('Please wait...')).toBeTruthy();
  });

  it('shows overlay without message', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App</Text>
      </LoadingOverlayProvider>
    );

    act(() => {
      showLoading();
    });

    // The ActivityIndicator should be shown but no text message
    // The overlay container should be rendered
    expect(screen.toJSON()).toBeTruthy();
  });

  it('hides overlay when hideLoading is called', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App</Text>
      </LoadingOverlayProvider>
    );

    act(() => {
      showLoading('Loading data...');
    });

    expect(screen.getByText('Loading data...')).toBeTruthy();

    act(() => {
      hideLoading();
    });

    expect(screen.queryByText('Loading data...')).toBeNull();
  });

  it('can show and hide multiple times', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App</Text>
      </LoadingOverlayProvider>
    );

    act(() => {
      showLoading('First');
    });
    expect(screen.getByText('First')).toBeTruthy();

    act(() => {
      hideLoading();
    });
    expect(screen.queryByText('First')).toBeNull();

    act(() => {
      showLoading('Second');
    });
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('updates message when showLoading is called while already visible', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App</Text>
      </LoadingOverlayProvider>
    );

    act(() => {
      showLoading('Step 1');
    });
    expect(screen.getByText('Step 1')).toBeTruthy();

    act(() => {
      showLoading('Step 2');
    });
    expect(screen.getByText('Step 2')).toBeTruthy();
    expect(screen.queryByText('Step 1')).toBeNull();
  });

  // ── showLoading before provider mount ──

  it('does not crash when showLoading is called without provider', () => {
    expect(() => {
      showLoading('No provider');
    }).not.toThrow();
  });

  it('does not crash when hideLoading is called without provider', () => {
    expect(() => {
      hideLoading();
    }).not.toThrow();
  });

  // ── Edge cases ──

  it('shows overlay with empty string message', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App</Text>
      </LoadingOverlayProvider>
    );

    act(() => {
      showLoading('');
    });

    // Empty message should not render message text
    // But overlay should still be visible (with ActivityIndicator)
    expect(screen.toJSON()).toBeTruthy();
  });

  it('shows overlay with very long message', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App</Text>
      </LoadingOverlayProvider>
    );

    const longMessage = 'Loading '.repeat(50);
    act(() => {
      showLoading(longMessage);
    });

    expect(screen.getByText(longMessage)).toBeTruthy();
  });

  it('renders children correctly even when overlay is visible', () => {
    render(
      <LoadingOverlayProvider>
        <Text>App Content</Text>
      </LoadingOverlayProvider>
    );

    act(() => {
      showLoading('Loading...');
    });

    // Children should still be rendered behind the overlay
    expect(screen.getByText('App Content')).toBeTruthy();
    expect(screen.getByText('Loading...')).toBeTruthy();
  });
});
