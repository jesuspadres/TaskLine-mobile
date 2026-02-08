---
name: apple-app-store-compliance
description: Apple App Store Review Guidelines compliance agent for TaskLine Mobile. Use this skill whenever writing code, designing features, or making decisions that could affect App Store approval. Ensures all code and features comply with Apple's guidelines for safety, performance, business, design, and legal requirements.
---

# Apple App Store Compliance Skill

This skill ensures TaskLine Mobile complies with Apple's App Store Review Guidelines. Reference this skill when building features, handling payments, managing user data, or preparing for App Store submission.

---

## Critical Requirements (Rejection Risk)

### 1. Privacy Policy (Guideline 5.1.1(i))
- **MUST** link privacy policy in App Store Connect metadata
- **MUST** make privacy policy accessible within the app (e.g., Settings > About)
- Privacy policy must disclose: what data is collected, how it's used, third parties receiving data (including Supabase), data retention/deletion policies, how users can revoke consent

### 2. Account Deletion (Guideline 5.1.1(v))
- Apps supporting account creation **MUST** offer account deletion within the app
- Must be easily discoverable (Settings > Account > Delete Account)
- Must actually delete user data from Supabase, not just deactivate
- Must show confirmation dialog warning about permanent data loss
- If user has active subscriptions, notify them billing continues via Apple until they cancel

### 3. App Completeness (Guideline 2.1)
- App must be the final version with all features functional
- No placeholder text, empty screens, or "Coming Soon" sections visible to reviewers
- **MUST** provide demo account credentials in App Review Notes (username + password)
- All backend services must be active during review
- In-app purchase items must be complete and visible

### 4. Subscription & In-App Purchase (Guideline 3.1.1, 3.1.2)
- **Digital goods/features** (subscription tiers unlocking app features) **MUST** use Apple IAP
- Physical goods/services consumed outside the app MAY use external payment (Stripe)
- **Exception 3.1.3(f)**: Free companion apps with NO purchase CTAs can skip IAP
  - This means NO upgrade buttons, NO plans screen, NO "unlock more" messaging
- **Exception 3.1.3(b)**: Multiplatform services can honor web purchases BUT must also offer IAP
- Subscription screens must prominently show: renewal price (largest text), duration, what's included, free trial terms
- Must include "Restore Purchases" button
- Must link to Terms of Use and Privacy Policy on subscription screen
- Must provide access to `showManageSubscriptions()` in-app

**TaskLine Decision Required**: Choose one approach:
- **Option A**: Implement StoreKit IAP for all tiers (Apple takes 15-30%)
- **Option B**: Free companion (remove ALL purchase CTAs from the app)
- **Option C**: Multiplatform with IAP parity (offer both Stripe and IAP)

### 5. Accurate Metadata (Guideline 2.3)
- Screenshots must show the app in use (not just splash/login screens)
- Must use fictional account data in screenshots (no real user data)
- App name max 30 characters, must be unique
- Category: "Business" or "Productivity"
- Age rating: Answer honestly (TaskLine is likely 4+)
- What's New text must describe actual changes

### 6. Privacy Nutrition Labels (App Store Connect)
For TaskLine, declare these data types:
- **Contact Info**: Name, email, phone (for user profiles, client records)
- **Identifiers**: User ID (Supabase auth)
- **Usage Data**: Product interaction (if analytics used)
- **Financial Info**: Invoice amounts (not payment cards)
- All linked to user identity: Yes
- Used for tracking: No (unless third-party analytics added)

---

## Authentication Requirements

### Sign in with Apple (Guideline 4.8)
- **Required ONLY IF** the app offers third-party/social login (Google, Facebook, etc.)
- If using only email/password auth (current TaskLine setup): **NOT required**
- If ANY social login is added in the future, Sign in with Apple becomes mandatory
- Must offer equivalent features: name, email, private relay email option

### Login Requirements (Guideline 5.1.1(v))
- Apps without significant account features should allow use without login
- TaskLine requires auth for core functionality (client management) — mandatory login is justified

---

## Design Requirements

### Tab Bar (Apple HIG)
- **Maximum 5 visible tabs** on iPhone (enforced by this restructure)
- Each tab needs a clear label and recognizable icon
- Tab bar must remain visible on all primary screens
- Use system-appropriate icons (SF Symbols style)

### Touch Targets (Apple HIG)
- Minimum touch target: **44x44 points**
- Preferred: 56x56 for primary actions
- 8pt minimum spacing between interactive elements

### Accessibility
- All interactive elements should have `accessibilityLabel`
- Support Dynamic Type (system font size preferences)
- Color contrast ratio: 4.5:1 for normal text, 3:1 for large text (WCAG 2.1 AA)
- Don't rely on color alone — use labels/icons alongside color coding
- Respect "Reduce Motion" accessibility setting
- Modals need `accessibilityViewIsModal` prop

### Standard UI (Guideline 2.5.9)
- Never alter standard switches (volume, ring/silent)
- Never block links to other apps
- Don't override expected native behaviors

---

## Performance Requirements

### Stability (Guideline 2.1)
- Apps that crash will be rejected — test on device, not just simulator
- Handle network failures gracefully (show error states, not crashes)
- Handle empty states for all list screens

### Resource Efficiency (Guideline 2.4.2)
- No rapid battery drain or excessive heat generation
- No unrelated background processes
- Background execution limited to: VoIP, audio, location, task completion, notifications

### Network (Guideline 2.5.5)
- **Must work on IPv6-only networks** — common rejection reason
- Supabase connections use domain names (not hardcoded IPs), so should be fine
- Test on IPv6-only network before submission

### Device Compatibility (Guideline 2.4.1)
- iPhone apps should run on iPad — test iPad layout
- React Native/Expo apps typically work but may need layout adjustments

---

## Push Notifications (Guideline 4.5.4)

- Push notifications are **NOT required** to use the app
- Cannot gate features behind enabling push notifications
- For marketing/promotional push: must have **explicit user opt-in** with consent language
- Must provide opt-out mechanism
- Must not send sensitive/confidential information via push
- Abuse of push = revocation of push certificate

### Best Practices
- Don't request push permission at app launch
- Show a pre-permission screen explaining notification value before iOS system prompt
- Respect user's choice — don't nag if declined

---

## Data & Security

### Data Collection (Guideline 5.1.1(ii))
- Explicit user consent for any data collection
- Paid features cannot require granting data access
- Purpose strings in iOS permission dialogs must clearly describe usage
- Practice data minimization — only request necessary permissions

### App Tracking Transparency (Guideline 5.1.2)
- Required ONLY if tracking user activity across apps/websites
- TaskLine currently doesn't track — no ATT prompt needed
- If analytics SDKs are added that do cross-app tracking, ATT becomes mandatory
- Cannot require users to enable tracking to use the app

### Data Security (Guideline 1.6)
- Use SecureStore for sensitive tokens (already implemented)
- Never log PII with console.log (use secureLog)
- Encrypt sensitive data in transit (Supabase uses HTTPS)

---

## Legal Requirements

### Terms of Service
- Link to Terms of Use in app and in App Store Connect metadata
- Required for subscription apps (Schedule 2 compliance)

### Intellectual Property (Guideline 5.2)
- Only use content you own or have licensed
- Cannot suggest Apple endorses the app
- Don't embed Apple emoji in the app binary

### EU Requirements (Effective Feb 17, 2026)
- Apps distributed in EU must have trader status verified in App Store Connect
- Apps without verified trader status will be removed from EU storefronts

### SDK Requirement (Effective April 28, 2026)
- Apps must be built with iOS 26 SDK or later
- Plan Expo SDK updates accordingly

---

## TaskLine-Specific Compliance Checklist

Use this checklist before App Store submission:

### Must Do Before Submission
- [ ] Privacy policy URL hosted publicly and linked in App Store Connect
- [ ] Privacy policy accessible in-app (Settings > About or similar)
- [ ] Account deletion feature in Settings > Account
- [ ] Demo account credentials in App Review Notes
- [ ] Terms of Use URL in App Store Connect
- [ ] Privacy Nutrition Labels completed in App Store Connect
- [ ] Age rating questionnaire completed
- [ ] Real app screenshots with fictional data
- [ ] Support URL in App Store Connect
- [ ] App category set (Business/Productivity)
- [ ] Subscription flow compliant (IAP or free companion model)

### Must Do If Adding Features
- [ ] Social login added → Implement Sign in with Apple
- [ ] Push notifications → Add opt-in consent + opt-out mechanism
- [ ] Analytics SDK → Complete ATT implementation if cross-app tracking
- [ ] Location services → Add proper purpose strings
- [ ] Camera/Photos → Add proper purpose strings, use pickers not full access

### Code Patterns to Follow
```typescript
// GOOD: Accessible button
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel="Delete client"
  accessibilityHint="Permanently removes this client and their data"
  style={{ minWidth: 44, minHeight: 44 }}
>

// GOOD: Secure logging
import { secureLog } from '@/lib/security';
secureLog('Fetched user data'); // Never log PII

// GOOD: Error handling
if (error) {
  showToast({ type: 'error', message: 'Failed to load data' });
  return; // Don't crash
}

// BAD: Feature gated behind permission
if (!notificationsEnabled) {
  return <Text>Enable notifications to use this feature</Text>; // REJECTED
}

// BAD: Direct Stripe checkout for digital subscription
Linking.openURL(stripeCheckoutUrl); // REJECTED for digital goods
```

---

## Key Guideline Numbers Reference

| # | Topic |
|---|-------|
| 1.5 | Developer contact info required |
| 1.6 | Data security measures |
| 2.1 | App completeness, demo accounts, no crashes |
| 2.3 | Accurate metadata, screenshots, age ratings |
| 2.4 | Hardware compatibility, power efficiency |
| 2.5.5 | IPv6 network support |
| 3.1.1 | In-app purchase required for digital goods |
| 3.1.2 | Subscription requirements and terms |
| 3.1.3(b) | Multiplatform services |
| 3.1.3(f) | Free standalone companion apps |
| 4.2 | Minimum functionality (not a web wrapper) |
| 4.5.4 | Push notification rules |
| 4.8 | Sign in with Apple / login services |
| 5.1.1(i) | Privacy policy requirements |
| 5.1.1(v) | Account deletion requirement |
| 5.1.2 | Data use, sharing, ATT |

## Sources
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- [Auto-renewable Subscriptions](https://developer.apple.com/app-store/subscriptions/)
- [Account Deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
