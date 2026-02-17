// Environment configuration
// Copy this file to env.ts and fill in your values

export const ENV = {
  // Supabase Configuration
  // Get these from your Supabase project settings
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',

  // App Configuration
  APP_URL: 'https://taskline.solvrlabs.com',

  // Google OAuth
  GOOGLE_WEB_CLIENT_ID: 'your-google-web-client-id',

  // Google Maps API Key
  // Restrict in Google Cloud Console to your iOS bundle ID and Android package + SHA-1
  GOOGLE_MAPS_API_KEY: 'your-google-maps-api-key',
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
  return true;
}
