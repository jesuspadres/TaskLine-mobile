/**
 * Single source of truth for all plan/tier information.
 * Mirrors the website's lib/plans.ts
 */

export type TierSlug = 'free' | 'pro' | 'plus' | 'business';
export type BillingPeriod = 'monthly' | 'annual';

export interface PlanFeatures {
  clients: string;
  projects: string;
  tasks: string;
  storage: string;
  sms: boolean | string;
  support: string;
  payments: boolean | 'comingSoon';
  scheduler: boolean;
  productCatalog: boolean | string;
  branding: boolean | 'comingSoon';
  whiteLabel: boolean;
  team: string;
  clientPortal: boolean;
  invoices: boolean;
  projectTracking: boolean;
  taskManagement: boolean;
  fileSharing: boolean;
  emailNotifications: boolean;
  aiAssistant: boolean;
}

export interface PlanData {
  nameKey: string;
  slug: TierSlug;
  price: { monthly: number; annual: number };
  descriptionKey: string;
  popular?: boolean;
  comingSoon?: boolean;
  features: PlanFeatures;
}

// ============================================================
// PLAN DEFINITIONS
// ============================================================

export const PLANS: PlanData[] = [
  {
    nameKey: 'planNames.free',
    slug: 'free',
    price: { monthly: 0, annual: 0 },
    descriptionKey: 'planDescriptions.free',
    features: {
      clients: '2',
      projects: '5',
      tasks: '20',
      storage: '200MB',
      sms: '\u2014',
      support: 'supportLevels.email',
      payments: false,
      scheduler: false,
      productCatalog: false,
      branding: false,
      whiteLabel: false,
      team: '\u2014',
      clientPortal: true,
      invoices: true,
      projectTracking: true,
      taskManagement: true,
      fileSharing: true,
      emailNotifications: true,
      aiAssistant: false,
    },
  },
  {
    nameKey: 'planNames.pro',
    slug: 'pro',
    price: { monthly: 29, annual: 19 },
    descriptionKey: 'planDescriptions.pro',
    features: {
      clients: 'featureValues.unlimited',
      projects: 'featureValues.unlimited',
      tasks: 'featureValues.unlimited',
      storage: '5GB',
      sms: '\u2014',
      support: 'supportLevels.priority',
      payments: false,
      scheduler: true,
      productCatalog: 'featureValues.upTo6',
      branding: false,
      whiteLabel: false,
      team: '\u2014',
      clientPortal: true,
      invoices: true,
      projectTracking: true,
      taskManagement: true,
      fileSharing: true,
      emailNotifications: true,
      aiAssistant: false,
    },
  },
  {
    nameKey: 'planNames.plus',
    slug: 'plus',
    price: { monthly: 59, annual: 49 },
    descriptionKey: 'planDescriptions.plus',
    popular: true,
    features: {
      clients: 'featureValues.unlimited',
      projects: 'featureValues.unlimited',
      tasks: 'featureValues.unlimited',
      storage: '30GB',
      sms: true,
      support: 'supportLevels.priority',
      payments: true,
      scheduler: true,
      productCatalog: 'featureValues.unlimited',
      branding: true,
      whiteLabel: false,
      team: '\u2014',
      clientPortal: true,
      invoices: true,
      projectTracking: true,
      taskManagement: true,
      fileSharing: true,
      emailNotifications: true,
      aiAssistant: true,
    },
  },
  {
    nameKey: 'planNames.business',
    slug: 'business',
    price: { monthly: 119, annual: 99 },
    descriptionKey: 'planDescriptions.business',
    comingSoon: true,
    features: {
      clients: 'featureValues.unlimited',
      projects: 'featureValues.unlimited',
      tasks: 'featureValues.unlimited',
      storage: '100GB',
      sms: true,
      support: 'supportLevels.phone',
      payments: true,
      scheduler: true,
      productCatalog: 'featureValues.unlimited',
      branding: true,
      whiteLabel: true,
      team: 'featureValues.upTo5',
      clientPortal: true,
      invoices: true,
      projectTracking: true,
      taskManagement: true,
      fileSharing: true,
      emailNotifications: true,
      aiAssistant: true,
    },
  },
];

// ============================================================
// HELPERS
// ============================================================

/** Get a plan by its slug */
export function getPlan(slug: TierSlug): PlanData {
  return PLANS.find((p) => p.slug === slug) || PLANS[0];
}

/** Get the price for a tier and billing period */
export function getPlanPrice(slug: TierSlug, period: BillingPeriod): number {
  return getPlan(slug).price[period];
}

/** Tier ordering for upgrade/downgrade comparison */
export const TIER_ORDER: TierSlug[] = ['free', 'pro', 'plus', 'business'];

/** Simple feature keys for the plans comparison table */
export const PLAN_FEATURE_KEYS = [
  'clients',
  'projects',
  'tasks',
  'storage',
  'sms',
  'support',
  'aiAssistant',
  'scheduler',
  'whiteLabel',
  'team',
  'payments',
  'branding',
] as const;

/** Feature categories for comparison tables */
export const FEATURE_CATEGORIES = [
  {
    categoryKey: 'featureCategories.limits',
    features: ['clients', 'projects', 'tasks', 'storage', 'team'],
  },
  {
    categoryKey: 'featureCategories.core',
    features: ['clientPortal', 'invoices', 'projectTracking', 'taskManagement', 'fileSharing'],
  },
  {
    categoryKey: 'featureCategories.communication',
    features: ['emailNotifications', 'sms', 'support'],
  },
  {
    categoryKey: 'featureCategories.advanced',
    features: ['aiAssistant', 'scheduler', 'productCatalog', 'payments', 'branding', 'whiteLabel'],
  },
] as const;
