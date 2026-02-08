# TaskLine Mobile

A React Native + Expo mobile application for the TaskLine freelancer client portal.

## Features

- 📱 Native iOS and Android apps from a single codebase
- 🔐 Secure authentication with Supabase
- 📊 Dashboard with real-time stats
- 📬 Client request management
- 👥 Client directory
- 📁 Project tracking with approval workflow
- ✅ Kanban-style task management
- 📄 Invoice management
- 🔔 Push notifications (coming soon)
- 🌙 Dark mode support (coming soon)

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for development)
- iOS Simulator (Mac only) or Android Emulator

## Getting Started

### 1. Clone and Install Dependencies

```bash
cd taskline-mobile
npm install
```

### 2. Configure Environment

Update `lib/env.ts` with your Supabase credentials:

```typescript
export const ENV = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key-here',
  APP_URL: 'https://taskline.solvrlabs.com',
};
```

You can find these values in your Supabase dashboard:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy the "Project URL" and "anon public" key

### 3. Install Additional Dependencies

```bash
# Install the URL polyfill for Supabase
npm install react-native-url-polyfill
```

### 4. Start Development Server

```bash
# Start Expo development server
npx expo start
```

Then:
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan QR code with Expo Go app on your phone

## Project Structure

```
taskline-mobile/
├── app/                    # Expo Router file-based routing
│   ├── (auth)/            # Authentication screens
│   │   ├── _layout.tsx    # Auth layout
│   │   ├── login.tsx      # Login screen
│   │   ├── signup.tsx     # Sign up screen
│   │   └── forgot-password.tsx
│   ├── (app)/             # Main app screens (protected)
│   │   ├── _layout.tsx    # Tab navigation
│   │   ├── dashboard.tsx  # Dashboard
│   │   ├── requests.tsx   # Request management
│   │   ├── clients.tsx    # Client list
│   │   ├── projects.tsx   # Project list
│   │   ├── tasks.tsx      # Task kanban
│   │   ├── invoices.tsx   # Invoice list
│   │   └── settings.tsx   # Settings
│   ├── _layout.tsx        # Root layout with auth
│   └── index.tsx          # Entry redirect
├── components/            # Shared UI components
├── constants/             # Theme, colors, spacing
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and config
│   ├── supabase.ts       # Supabase client
│   ├── database.types.ts # TypeScript types
│   └── env.ts            # Environment config
├── stores/               # Zustand state stores
│   └── authStore.ts      # Authentication state
└── assets/               # Images, fonts, icons
```

## Key Technologies

- **Expo SDK 52** - React Native framework
- **Expo Router** - File-based navigation
- **Supabase** - Backend, auth, and real-time
- **Zustand** - State management
- **TypeScript** - Type safety
- **Expo SecureStore** - Secure token storage

## Code Reuse from Web App

This mobile app shares significant code with the TaskLine web app:

| Component | Reusability |
|-----------|-------------|
| TypeScript types | 100% - Same `database.types.ts` |
| Supabase queries | ~90% - Same query patterns |
| Business logic | ~85% - Same hooks structure |
| Auth flow | ~80% - Same Supabase auth |
| UI components | Rewritten - React Native primitives |

## Building for Production

### iOS

```bash
# Build for iOS
npx expo build:ios

# Or use EAS Build (recommended)
npx eas build --platform ios
```

### Android

```bash
# Build for Android
npx expo build:android

# Or use EAS Build (recommended)
npx eas build --platform android
```

## Development Commands

```bash
# Start development server
npx expo start

# Start with cache cleared
npx expo start -c

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Type check
npm run type-check

# Lint
npm run lint
```

## Connecting to Your Supabase Backend

This mobile app connects to the same Supabase backend as the web app. Ensure:

1. Your Supabase project has the correct tables and RLS policies
2. The `anon` key has appropriate permissions
3. Real-time is enabled for the tables you want to subscribe to

## Authentication Flow

1. User opens app → Root layout checks auth state
2. No session → Redirect to login
3. User logs in → Credentials stored in SecureStore
4. Session exists → Redirect to dashboard
5. Auth state changes → Automatic navigation updates

## Styling

The app uses a custom theme system defined in `constants/theme.ts` that matches the web app's Tailwind colors:

```typescript
import { Colors, Spacing, FontSizes, BorderRadius } from '@/constants/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.background,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
});
```

## Troubleshooting

### "Supabase connection failed"
- Check your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `lib/env.ts`
- Ensure your Supabase project is running

### "SecureStore not available"
- SecureStore only works on physical devices or simulators
- For web testing, use a different storage adapter

### "Navigation not working"
- Clear the Metro bundler cache: `npx expo start -c`
- Restart the development server

## Next Steps

- [ ] Add push notifications with Expo Notifications
- [ ] Implement dark mode
- [ ] Add file upload with camera integration
- [ ] Offline support with local caching
- [ ] Add biometric authentication
- [ ] Create detail screens for each entity

## License

Private - TaskLine by SolvrLabs
