// Environment configuration
// Secrets are loaded from .env via app.config.ts > extra
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const ENV = {
  // Supabase Configuration (anon key is public-by-design)
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',

  // App Configuration
  APP_URL: 'https://taskline.solvrlabs.com',

  // Google Maps API Key (loaded from .env via app.config.ts extra)
  // Create .env file with: GOOGLE_MAPS_API_KEY=your-key-here
  GOOGLE_MAPS_API_KEY: (extra.googleMapsApiKey as string) || '',

  // Sentry DSN (public-by-design)
  SENTRY_DSN: 'your-sentry-dsn',
};

// Validate environment
export function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(
    (key) => !ENV[key as keyof typeof ENV] || ENV[key as keyof typeof ENV].includes('your-')
  );

  if (missing.length > 0) {
    console.warn(
      `⚠️ Missing or invalid environment variables: ${missing.join(', ')}\n` +
        'Copy env.example.ts to env.ts and fill in your values.'
    );
    return false;
  }

  if (!ENV.GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ GOOGLE_MAPS_API_KEY not set. Add it to .env file.');
  }

  return true;
}
