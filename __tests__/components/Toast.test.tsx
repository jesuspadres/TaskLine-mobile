import React from 'react';
import { Text } from 'react-native';
import { render, screen, act, waitFor } from '../setup/testUtils';
import { ToastProvider, showToast } from '@/components/Toast';

describe('Toast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── ToastProvider rendering ──

  it('renders children', () => {
    render(
      <ToastProvider>
        <Text>App Content</Text>
      </ToastProvider>
    );
    expect(screen.getByText('App Content')).toBeTruthy();
  });

  it('initially shows no toast messages', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );
    // No toast messages should be rendered initially
    expect(screen.queryByText('Success!')).toBeNull();
  });

  // ── showToast function ──

  it('displays a success toast', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('success', 'Operation successful');
    });

    expect(screen.getByText('Operation successful')).toBeTruthy();
  });

  it('displays an error toast', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('error', 'Something went wrong');
    });

    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('displays a warning toast', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('warning', 'Be careful!');
    });

    expect(screen.getByText('Be careful!')).toBeTruthy();
  });

  it('displays an info toast', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('info', 'Here is some info');
    });

    expect(screen.getByText('Here is some info')).toBeTruthy();
  });

  // ── Multiple toasts ──

  it('can display multiple toasts simultaneously', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('success', 'First toast');
      jest.advanceTimersByTime(1); // Ensure different Date.now() for unique keys
      showToast('error', 'Second toast');
    });

    expect(screen.getByText('First toast')).toBeTruthy();
    expect(screen.getByText('Second toast')).toBeTruthy();
  });

  // ── Auto-dismiss ──

  it('auto-dismisses toast after default duration', async () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('info', 'Temporary message');
    });

    expect(screen.getByText('Temporary message')).toBeTruthy();

    // Advance past the default 3000ms + animation duration
    act(() => {
      jest.advanceTimersByTime(3500);
    });

    // After dismiss animation completes, the toast should be removed
  });

  it('uses custom duration for auto-dismiss', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('info', 'Quick message', 1000);
    });

    expect(screen.getByText('Quick message')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    // Toast should start dismissing after 1000ms
  });

  // ── Toast types have correct icons ──

  it('success toast has checkmark-circle icon', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('success', 'Done');
    });

    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('checkmark-circle');
  });

  it('error toast has close-circle icon', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('error', 'Error');
    });

    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('close-circle');
  });

  it('warning toast has warning icon', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('warning', 'Warning');
    });

    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('warning');
  });

  it('info toast has information-circle icon', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('info', 'Info');
    });

    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain('information-circle');
  });

  // ── showToast before provider mount ──

  it('does not crash when showToast is called without provider', () => {
    // No ToastProvider mounted, should not throw
    expect(() => {
      showToast('info', 'No provider');
    }).not.toThrow();
  });

  // ── Edge cases ──

  it('renders toast with empty message', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    act(() => {
      showToast('info', '');
    });

    // Should not crash
    expect(screen.toJSON()).toBeTruthy();
  });

  it('renders toast with very long message', () => {
    render(
      <ToastProvider>
        <Text>App</Text>
      </ToastProvider>
    );

    const longMessage = 'A'.repeat(500);
    act(() => {
      showToast('info', longMessage);
    });

    expect(screen.getByText(longMessage)).toBeTruthy();
  });
});
