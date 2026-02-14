import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to the welcome screen by default
  // The root layout will handle redirecting to dashboard if authenticated
  return <Redirect href="/(auth)/welcome" />;
}
