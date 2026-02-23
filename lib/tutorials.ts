import type { TierSlug } from '@/lib/plans';

export interface TutorialStep {
  /** i18n key prefix: t(`${keyPrefix}.title`), t(`${keyPrefix}.description`) */
  keyPrefix: string;
  /** Ionicons icon name */
  icon: string;
}

export interface TutorialDefinition {
  id: string;
  /** i18n key for the tutorial name shown in Help screen */
  nameKey: string;
  /** Category for grouping in Help & Tutorials screen */
  category: 'getting_started' | 'management' | 'financial' | 'scheduling' | 'settings' | 'tier_upgrade';
  /** Screen route this tutorial is tied to (for auto-trigger) */
  screenId?: string;
  /** Minimum tier required to see this tutorial */
  minTier?: TierSlug;
  /** Tier that triggers this upgrade tutorial */
  triggerOnTierUpgrade?: TierSlug;
  steps: TutorialStep[];
}

export const TUTORIAL_CATEGORIES = [
  { key: 'getting_started', nameKey: 'tutorials.categories.gettingStarted', icon: 'rocket-outline' },
  { key: 'management', nameKey: 'tutorials.categories.management', icon: 'briefcase-outline' },
  { key: 'financial', nameKey: 'tutorials.categories.financial', icon: 'cash-outline' },
  { key: 'scheduling', nameKey: 'tutorials.categories.scheduling', icon: 'calendar-outline' },
  { key: 'settings', nameKey: 'tutorials.categories.settings', icon: 'settings-outline' },
  { key: 'tier_upgrade', nameKey: 'tutorials.categories.tierUpgrade', icon: 'diamond-outline' },
] as const;

const TIER_RANK: Record<TierSlug, number> = { free: 0, pro: 1, plus: 2, business: 3 };

export function isTierAtLeast(currentTier: TierSlug, requiredTier: TierSlug): boolean {
  return TIER_RANK[currentTier] >= TIER_RANK[requiredTier];
}

export const TUTORIALS: TutorialDefinition[] = [
  // ── Getting Started ──
  {
    id: 'dashboard',
    nameKey: 'tutorials.dashboard.name',
    category: 'getting_started',
    screenId: 'dashboard',
    steps: [
      { keyPrefix: 'tutorials.dashboard.step1', icon: 'grid-outline' },
      { keyPrefix: 'tutorials.dashboard.step2', icon: 'stats-chart-outline' },
      { keyPrefix: 'tutorials.dashboard.step3', icon: 'alert-circle-outline' },
      { keyPrefix: 'tutorials.dashboard.step4', icon: 'flash-outline' },
    ],
  },

  // ── Management ──
  {
    id: 'clients',
    nameKey: 'tutorials.clients.name',
    category: 'management',
    screenId: 'clients',
    steps: [
      { keyPrefix: 'tutorials.clients.step1', icon: 'people-outline' },
      { keyPrefix: 'tutorials.clients.step2', icon: 'search-outline' },
      { keyPrefix: 'tutorials.clients.step3', icon: 'person-add-outline' },
      { keyPrefix: 'tutorials.clients.step4', icon: 'open-outline' },
    ],
  },
  {
    id: 'projects',
    nameKey: 'tutorials.projects.name',
    category: 'management',
    screenId: 'projects',
    steps: [
      { keyPrefix: 'tutorials.projects.step1', icon: 'folder-outline' },
      { keyPrefix: 'tutorials.projects.step2', icon: 'funnel-outline' },
      { keyPrefix: 'tutorials.projects.step3', icon: 'add-circle-outline' },
      { keyPrefix: 'tutorials.projects.step4', icon: 'checkmark-done-outline' },
    ],
  },
  {
    id: 'tasks',
    nameKey: 'tutorials.tasks.name',
    category: 'management',
    screenId: 'tasks',
    steps: [
      { keyPrefix: 'tutorials.tasks.step1', icon: 'checkbox-outline' },
      { keyPrefix: 'tutorials.tasks.step2', icon: 'flag-outline' },
      { keyPrefix: 'tutorials.tasks.step3', icon: 'swap-vertical-outline' },
      { keyPrefix: 'tutorials.tasks.step4', icon: 'add-outline' },
    ],
  },
  {
    id: 'requests',
    nameKey: 'tutorials.requests.name',
    category: 'management',
    screenId: 'jobs',
    steps: [
      { keyPrefix: 'tutorials.requests.step1', icon: 'mail-unread-outline' },
      { keyPrefix: 'tutorials.requests.step2', icon: 'eye-outline' },
      { keyPrefix: 'tutorials.requests.step3', icon: 'chatbubbles-outline' },
      { keyPrefix: 'tutorials.requests.step4', icon: 'git-compare-outline' },
    ],
  },
  {
    id: 'properties',
    nameKey: 'tutorials.properties.name',
    category: 'management',
    screenId: 'properties',
    steps: [
      { keyPrefix: 'tutorials.properties.step1', icon: 'home-outline' },
      { keyPrefix: 'tutorials.properties.step2', icon: 'location-outline' },
      { keyPrefix: 'tutorials.properties.step3', icon: 'link-outline' },
    ],
  },

  // ── Financial ──
  {
    id: 'invoices',
    nameKey: 'tutorials.invoices.name',
    category: 'financial',
    screenId: 'invoices',
    steps: [
      { keyPrefix: 'tutorials.invoices.step1', icon: 'document-text-outline' },
      { keyPrefix: 'tutorials.invoices.step2', icon: 'add-circle-outline' },
      { keyPrefix: 'tutorials.invoices.step3', icon: 'send-outline' },
      { keyPrefix: 'tutorials.invoices.step4', icon: 'cash-outline' },
    ],
  },

  // ── Scheduling ──
  {
    id: 'bookings',
    nameKey: 'tutorials.bookings.name',
    category: 'scheduling',
    screenId: 'jobs',
    steps: [
      { keyPrefix: 'tutorials.bookings.step1', icon: 'calendar-outline' },
      { keyPrefix: 'tutorials.bookings.step2', icon: 'time-outline' },
      { keyPrefix: 'tutorials.bookings.step3', icon: 'notifications-outline' },
    ],
  },
  {
    id: 'calendar',
    nameKey: 'tutorials.calendar.name',
    category: 'scheduling',
    screenId: 'calendar',
    steps: [
      { keyPrefix: 'tutorials.calendar.step1', icon: 'calendar-outline' },
      { keyPrefix: 'tutorials.calendar.step2', icon: 'eye-outline' },
      { keyPrefix: 'tutorials.calendar.step3', icon: 'time-outline' },
    ],
  },

  // ── Settings ──
  {
    id: 'notifications',
    nameKey: 'tutorials.notifications.name',
    category: 'settings',
    screenId: 'notifications',
    steps: [
      { keyPrefix: 'tutorials.notifications.step1', icon: 'notifications-outline' },
      { keyPrefix: 'tutorials.notifications.step2', icon: 'checkmark-circle-outline' },
      { keyPrefix: 'tutorials.notifications.step3', icon: 'options-outline' },
    ],
  },
  {
    id: 'settings',
    nameKey: 'tutorials.settingsGuide.name',
    category: 'settings',
    screenId: 'settings',
    steps: [
      { keyPrefix: 'tutorials.settingsGuide.step1', icon: 'person-circle-outline' },
      { keyPrefix: 'tutorials.settingsGuide.step2', icon: 'color-palette-outline' },
      { keyPrefix: 'tutorials.settingsGuide.step3', icon: 'briefcase-outline' },
      { keyPrefix: 'tutorials.settingsGuide.step4', icon: 'diamond-outline' },
    ],
  },

  // ── Tier Upgrade Tutorials ──
  {
    id: 'upgrade_pro',
    nameKey: 'tutorials.upgradePro.name',
    category: 'tier_upgrade',
    minTier: 'pro',
    triggerOnTierUpgrade: 'pro',
    steps: [
      { keyPrefix: 'tutorials.upgradePro.step1', icon: 'infinite-outline' },
      { keyPrefix: 'tutorials.upgradePro.step2', icon: 'calendar-outline' },
      { keyPrefix: 'tutorials.upgradePro.step3', icon: 'cloud-upload-outline' },
      { keyPrefix: 'tutorials.upgradePro.step4', icon: 'headset-outline' },
    ],
  },
  {
    id: 'upgrade_plus',
    nameKey: 'tutorials.upgradePlus.name',
    category: 'tier_upgrade',
    minTier: 'plus',
    triggerOnTierUpgrade: 'plus',
    steps: [
      { keyPrefix: 'tutorials.upgradePlus.step1', icon: 'chatbubble-outline' },
      { keyPrefix: 'tutorials.upgradePlus.step2', icon: 'card-outline' },
      { keyPrefix: 'tutorials.upgradePlus.step3', icon: 'pricetag-outline' },
      { keyPrefix: 'tutorials.upgradePlus.step4', icon: 'sparkles-outline' },
    ],
  },
  {
    id: 'upgrade_business',
    nameKey: 'tutorials.upgradeBusiness.name',
    category: 'tier_upgrade',
    minTier: 'business',
    triggerOnTierUpgrade: 'business',
    steps: [
      { keyPrefix: 'tutorials.upgradeBusiness.step1', icon: 'people-outline' },
      { keyPrefix: 'tutorials.upgradeBusiness.step2', icon: 'call-outline' },
      { keyPrefix: 'tutorials.upgradeBusiness.step3', icon: 'brush-outline' },
      { keyPrefix: 'tutorials.upgradeBusiness.step4', icon: 'cloud-outline' },
    ],
  },
];

export function getTutorial(id: string): TutorialDefinition | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

export function getTutorialsForScreen(screenId: string): TutorialDefinition[] {
  return TUTORIALS.filter((t) => t.screenId === screenId);
}

export function getTierUpgradeTutorials(tier: TierSlug): TutorialDefinition[] {
  return TUTORIALS.filter((t) => t.triggerOnTierUpgrade === tier);
}

export function getVisibleTutorials(currentTier: TierSlug): TutorialDefinition[] {
  return TUTORIALS.filter((t) => !t.minTier || isTierAtLeast(currentTier, t.minTier));
}
