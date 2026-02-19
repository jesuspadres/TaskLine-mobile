// Environment configuration
// Fill in your Supabase credentials from your project settings

export const ENV = {
  // Supabase Configuration
  // Get these from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
  SUPABASE_URL: 'https://iwqifenyzmzxrmftyrjr.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3cWlmZW55em16eHJtZnR5cmpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODk3MzYsImV4cCI6MjA4MDg2NTczNn0.CnQ3QyOlq2v_dcFmkIoFba91W6f4GS_yndIg363WD1U',

  // App Configuration
  APP_URL: 'https://taskline.solvrlabs.com',

  // Google Maps API Key
  // Get this from: Google Cloud Console > APIs & Services > Credentials > API Keys
  // Restrict to iOS bundle ID (com.solvrlabs.taskline) and Android package + SHA-1
  GOOGLE_MAPS_API_KEY: 'AIzaSyAW0xDwTQ6sqpqbuBUMuKsJK1a7oEb8Rnw',

  // Sentry DSN
  // Get this from: Sentry > Settings > Projects > taskline-mobile > Client Keys (DSN)
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
  return true;
}
