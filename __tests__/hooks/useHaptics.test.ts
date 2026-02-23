/**
 * Tests for useHaptics hook
 * Source: hooks/useHaptics.ts
 */
import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useHaptics } from '@/hooks/useHaptics';

describe('useHaptics', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: originalOS, writable: true });
  });

  // ── impact() tests ──

  it('should return impact, notification, and selection functions', () => {
    const { result } = renderHook(() => useHaptics());

    expect(typeof result.current.impact).toBe('function');
    expect(typeof result.current.notification).toBe('function');
    expect(typeof result.current.selection).toBe('function');
  });

  it('should call impactAsync with default Medium style on native', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.impact();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
  });

  it('should call impactAsync with specified style on native', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.impact(Haptics.ImpactFeedbackStyle.Heavy);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  it('should call impactAsync with Light style on native', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.impact(Haptics.ImpactFeedbackStyle.Light);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('should NOT call impactAsync on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.impact();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  // ── notification() tests ──

  it('should call notificationAsync with specified type on native', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.notification(Haptics.NotificationFeedbackType.Success);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
  });

  it('should call notificationAsync with Warning type on native', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.notification(Haptics.NotificationFeedbackType.Warning);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Warning);
  });

  it('should call notificationAsync with Error type on native', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.notification(Haptics.NotificationFeedbackType.Error);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
  });

  it('should NOT call notificationAsync on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.notification(Haptics.NotificationFeedbackType.Success);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  // ── selection() tests ──

  it('should call selectionAsync on native', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('should call selectionAsync on Android', () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('should NOT call selectionAsync on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.selection();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  // ── Multiple calls ──

  it('should allow multiple haptic calls in sequence', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.impact();
    result.current.notification(Haptics.NotificationFeedbackType.Success);
    result.current.selection();

    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('should suppress all haptics on web in a sequence', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', writable: true });
    const { result } = renderHook(() => useHaptics());

    result.current.impact();
    result.current.notification(Haptics.NotificationFeedbackType.Error);
    result.current.selection();

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });
});
