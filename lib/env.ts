// Environment configuration
// Secrets are loaded from .env via app.config.ts > extra
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const ENV = {
  // Supabase Configuration (anon key is public-by-design, safe to commit)
  SUPABASE_URL: 'https://iwqifenyzmzxrmftyrjr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cWlmZW55em16eHJtZnR5cmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODk3MzYsImV4cCI6MjA4MDg2NTczNn0.CnQ3QyOlq2v_dcFmkIoFba91W6f4GS_yndIg363WD1U',

  // App Configuration
  APP_URL: 'https://taskline.solvrlabs.com',

  // Google Maps API Key (loaded from .env via app.config.ts extra)
  GOOGLE_MAPS_API_KEY: (extra.googleMapsApiKey as string) || '',

  // Sentry DSN (public-by-design, safe to commit)
  SENTRY_DSN: 'https://e0e4b57ca54d82eab0c5c39cbaf3e457@o4510913376550912.ingest.us.sentry.io/4510913378844672',
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
        'Update lib/env.ts with your Supabase credentials.'
    );
    return false;
  }

  if (!ENV.GOOGLE_MAPS_API_KEY) {
    console.warn('⚠️ GOOGLE_MAPS_API_KEY not set. Add it to .env file.');
  }

  return true;
}
