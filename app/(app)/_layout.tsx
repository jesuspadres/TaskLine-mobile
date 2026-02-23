import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="projects" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="invoices" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="properties" />
      <Stack.Screen name="plans" />
      <Stack.Screen name="manage-subscription" />
      <Stack.Screen name="client-detail" />
      <Stack.Screen name="project-detail" />
      <Stack.Screen name="request-detail" />
      <Stack.Screen name="request-messages" />
      <Stack.Screen name="booking-detail" />
      <Stack.Screen name="property-detail" />
      <Stack.Screen name="business-profile" />
      <Stack.Screen name="invoice-settings" />
      <Stack.Screen name="notification-settings" />
      <Stack.Screen name="qr-settings" />
      <Stack.Screen name="booking-settings" />
      <Stack.Screen name="privacy-policy" />
      <Stack.Screen name="terms-of-service" />
      <Stack.Screen name="stripe-payments" />
      <Stack.Screen name="ai-settings" />
      <Stack.Screen name="storage-management" />
      <Stack.Screen name="help-tutorials" />
    </Stack>
  );
}
