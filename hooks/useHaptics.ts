import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export function useHaptics() {
  const impact = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  };

  const notification = (type: Haptics.NotificationFeedbackType) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(type);
    }
  };

  const selection = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  };

  return { impact, notification, selection };
}
