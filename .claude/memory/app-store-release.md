# TaskLine Mobile — App Store Release Tracker

> Last updated: 2026-02-13
> Target: Apple App Store + Google Play Store v1.0.0

---

## Phase 1: Blockers (Must fix before submission)

- [ ] **1.1 EAS Project Init**
  - Run `eas init` to generate and set `projectId` in `app.json > extra.eas.projectId`
  - Requires an Expo account + EAS CLI (`npm install -g eas-cli`)

- [ ] **1.2 EAS Submit Credentials** (`eas.json > submit.production`)
  - iOS: fill in `appleId`, `ascAppId`, `appleTeamId`
  - Android: create Google Play service account JSON, set `serviceAccountKeyPath`
  - Prerequisite: Apple Developer account ($99/yr) + Google Play Console ($25 one-time)

- [ ] **1.3 App Icons — Resize & Optimize**
  - Current: 1992x2000px, 5.3MB each — non-standard
  - Required: **1024x1024px**, no alpha/transparency for iOS
  - Files to update: `assets/icon.png`, `assets/adaptive-icon.png`
  - `assets/splash-icon.png` (512x512) is fine
  - Optimize to <500KB each

- [ ] **1.4 Google Maps API Key**
  - `app.json > android.config.googleMaps.apiKey` is placeholder `"YOUR_GOOGLE_MAPS_API_KEY"`
  - Maps used in `app/(app)/property-detail.tsx` via `react-native-maps`
  - Options: (A) get real key from Google Cloud Console, or (B) remove maps dependency for v1.0
  - If keeping maps: also add `ios.config.googleMapsApiKey` for iOS builds

- [ ] **1.5 Add Build Numbers to app.json**
  - Add `"buildNumber": "1"` inside `ios` section
  - Add `"versionCode": 1` inside `android` section
  - EAS `autoIncrement: true` handles subsequent builds

- [ ] **1.6 Fix Copyright Year**
  - `app/(app)/settings.tsx:662` — change `© 2025` to `© 2026`

---

## Phase 2: Store Policy Requirements

- [x] **2.1 Account Deletion** — COMPLETE
  - Settings > Danger Zone > Delete Account
  - Password verification + backend API call via `lib/websiteApi.ts`

- [x] **2.2 Privacy Policy** — COMPLETE
  - `app/(auth)/privacy-policy.tsx` with comprehensive i18n content
  - Accessible from auth flow + settings screen

- [x] **2.3 Terms of Service** — COMPLETE
  - `app/(auth)/terms-of-service.tsx` with comprehensive i18n content

- [x] **2.4 iOS Privacy Manifests** — COMPLETE
  - Declared in `app.json > ios.privacyManifests` (UserDefaults, timestamps, boot time, disk space)

- [x] **2.5 Encryption Declaration** — COMPLETE
  - `ITSAppUsesNonExemptEncryption: false` set in `app.json`

- [ ] **2.6 Host Privacy Policy & Terms at Public URLs**
  - Apple & Google require public web URLs for privacy policy in store listings
  - Use TaskLine website (e.g. `taskline.solvrlabs.com/privacy`, `taskline.solvrlabs.com/terms`)
  - Verify these pages exist and are accessible

- [ ] **2.7 Age Rating Questionnaire**
  - Must complete in App Store Connect and Google Play Console
  - App has no violent/sexual/gambling content — should be rated 4+ / Everyone

---

## Phase 3: Store Listing & Metadata

- [ ] **3.1 App Store Connect Setup**
  - Create app record in App Store Connect
  - Set bundle ID: `com.solvrlabs.taskline`
  - Select category: Business or Productivity
  - Set price: Free (with in-app subscriptions)

- [ ] **3.2 Google Play Console Setup**
  - Create app in Google Play Console
  - Set package: `com.solvrlabs.taskline`
  - Select category: Business
  - Complete content rating questionnaire
  - Set up data safety form

- [ ] **3.3 App Store Screenshots**
  - iPhone 6.7" (1290x2796) — required (iPhone 15 Pro Max)
  - iPhone 6.5" (1284x2778) — required (iPhone 11 Pro Max)
  - iPad 12.9" (2048x2732) — required if `supportsTablet: true`
  - Minimum 3 screenshots per device class, recommended 6-8
  - Key screens: Dashboard, Clients, Projects, Tasks, Settings (dark + light)

- [ ] **3.4 Google Play Screenshots & Graphics**
  - Phone screenshots: min 2, max 8 (16:9 or 9:16)
  - Feature graphic: 1024x500px (required)
  - App icon: 512x512px (auto-generated from build)

- [ ] **3.5 App Description & Keywords**
  - Short description (80 chars): for Google Play
  - Full description (4000 chars): for both stores
  - Keywords (100 chars, comma-separated): for App Store
  - What's New text for v1.0.0
  - Support URL: `https://taskline.solvrlabs.com/help-center`
  - Marketing URL: `https://taskline.solvrlabs.com`

- [ ] **3.6 In-App Purchase / Subscription Setup**
  - Register subscription products in App Store Connect
  - Register subscription products in Google Play Console
  - Current flow uses Stripe via web — verify this complies with store rules
  - NOTE: Apple requires using their IAP for digital subscriptions sold in-app
  - May need to implement `expo-in-app-purchases` or route subscription management to web only

---

## Phase 4: Recommended Before Public Launch

- [ ] **4.1 Crash/Error Tracking (Sentry)**
  - Install: `npx expo install @sentry/react-native`
  - Create Sentry project, add DSN
  - Wrap app with Sentry error boundary
  - Critical for monitoring production issues

- [ ] **4.2 Push Notifications**
  - Install: `npx expo install expo-notifications`
  - Configure APNs (iOS) and FCM (Android) credentials
  - Add notification permission request flow
  - Connect to Supabase notifications for background alerts
  - Not a launch blocker but important for retention

- [ ] **4.3 Real Device Testing**
  - Build with `eas build --profile preview --platform ios`
  - Install via TestFlight on physical iPhone
  - Build with `eas build --profile preview --platform android`
  - Sideload APK on physical Android device
  - Test checklist:
    - [ ] Login / signup / forgot password
    - [ ] Create client, project, task, invoice
    - [ ] Dark mode toggle
    - [ ] Language switch (EN/ES)
    - [ ] Offline banner appears when disconnecting
    - [ ] Offline mutations sync when reconnecting
    - [ ] Delete account flow
    - [ ] Subscription card displays correctly
    - [ ] Deep link `taskline://` opens app
    - [ ] All tab navigation works
    - [ ] Keyboard avoidance on forms
    - [ ] Haptic feedback on actions (iOS)

- [ ] **4.4 Verify Spanish Translations for Legal Pages**
  - Check `i18n/es.json` has all keys from `privacyPolicy.*` and `termsOfService.*` namespaces
  - These were added recently — confirm completeness

---

## Phase 5: Nice-to-Have (Post-launch)

- [ ] **5.1 Universal Links / App Links**
  - Configure iOS Associated Domains for `taskline.solvrlabs.com`
  - Configure Android App Links with `assetlinks.json`
  - Enables HTTPS links to open directly in app

- [ ] **5.2 App Store Review Prompt**
  - Install: `npx expo install expo-store-review`
  - Trigger after positive actions (completing a project, sending an invoice)

- [ ] **5.3 Analytics**
  - PostHog, Mixpanel, or similar for understanding user behavior
  - Track key funnels: signup, first client, first invoice

- [ ] **5.4 Biometric Authentication**
  - Face ID / Touch ID for returning users
  - `expo-local-authentication`

- [ ] **5.5 App Tracking Transparency (iOS)**
  - Only needed if adding cross-app tracking analytics
  - Not required for basic analytics that stay within your app

---

## Submission Workflow (when all above is ready)

```
1. eas init                                           # Link project to EAS
2. eas build --platform all --profile production       # Build iOS + Android
3. Test builds via TestFlight + Google Internal Testing # Final QA
4. eas submit --platform ios --profile production      # Submit to App Store
5. eas submit --platform android --profile production  # Submit to Google Play
6. Monitor review status in App Store Connect + Play Console
7. Respond to any reviewer feedback promptly
```

**Typical review times:**
- Apple: 24-48 hours (can take up to 7 days for first submission)
- Google: 1-7 days (can take longer for first submission)

---

## Important Note: Subscription Compliance

Apple requires all digital subscriptions purchased within iOS apps to use Apple's In-App Purchase system (30% commission). The current implementation uses Stripe via `Linking.openURL` which opens the web browser. This is a gray area:

- **Option A (Safer):** Implement native IAP via `expo-in-app-purchases` or `react-native-iap` for iOS
- **Option B (Reader Rule):** If TaskLine qualifies as a "reader" app, you may link out — but this is unlikely for a SaaS tool
- **Option C (Web-only subscriptions):** Remove the subscribe button from the iOS app entirely, only allow subscription management on the website. Show current plan status but don't offer upgrade in-app.

This needs a decision before iOS submission. Google Play is more lenient but also prefers Google Play Billing for subscriptions.

---

## Files Reference

| What | Path |
|------|------|
| App config | `app.json` |
| EAS config | `eas.json` |
| Icons | `assets/icon.png`, `assets/adaptive-icon.png` |
| Splash | `assets/splash-icon.png` |
| Settings (delete acct, about) | `app/(app)/settings.tsx` |
| Privacy Policy | `app/(auth)/privacy-policy.tsx` |
| Terms of Service | `app/(auth)/terms-of-service.tsx` |
| Welcome screen | `app/(auth)/welcome.tsx` |
| Root layout | `app/_layout.tsx` |
| Env (secrets) | `lib/env.ts` (gitignored) |
| Plans/Subscriptions | `app/(app)/plans.tsx`, `lib/plans.ts` |
| Package deps | `package.json` |
