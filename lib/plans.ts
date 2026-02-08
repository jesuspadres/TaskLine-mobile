/**
 * Single source of truth for plan/tier information.
 * Mirrors the website's lib/plans.ts
 */

export type TierSlug = 'free' | 'pro' | 'plus' | 'business';
export type BillingPeriod = 'monthly' | 'annual';

export interface PlanFeatures {
  clients: string;
  projects: string;
  tasks: string;
  storage: string;
  sms: string;
  support: string;
  scheduler: boolean;
  payments: boolean | 'comingSoon';
  branding: boolean | 'comingSoon';
  whiteLabel: boolean;
  team: string;
}

export interface PlanData {
  name: string;
  slug: TierSlug;
  price: { monthly: number; annual: number };
  description: string;
  popular?: boolean;
  comingSoon?: boolean;
  features: PlanFeatures;
}

export const PLANS: PlanData[] = [
  {
    name: 'Free',
    slug: 'free',
    price: { monthly: 0, annual: 0 },
    description: 'Get started with the basics',
    features: {
      clients: '2',
      projects: '5',
      tasks: '20',
      storage: '500MB',
      sms: '-',
      support: 'Email',
      scheduler: false,
      payments: false,
      branding: false,
      whiteLabel: false,
      team: '-',
    },
  },
  {
    name: 'Pro',
    slug: 'pro',
    price: { monthly: 19, annual: 15 },
    description: 'For growing freelancers',
    features: {
      clients: '15',
      projects: '50',
      tasks: '200',
      storage: '10GB',
      sms: '50/month',
      support: 'Priority',
      scheduler: false,
      payments: false,
      branding: false,
      whiteLabel: false,
      team: '-',
    },
  },
  {
    name: 'Plus',
    slug: 'plus',
    price: { monthly: 39, annual: 30 },
    description: 'Full-featured business tools',
    popular: true,
    features: {
      clients: 'Unlimited',
      projects: 'Unlimited',
      tasks: 'Unlimited',
      storage: '30GB',
      sms: '200/month',
      support: 'Priority',
      scheduler: true,
      payments: 'comingSoon',
      branding: 'comingSoon',
      whiteLabel: false,
      team: '-',
    },
  },
  {
    name: 'Business',
    slug: 'business',
    price: { monthly: 79, annual: 60 },
    description: 'Enterprise-grade solution',
    comingSoon: true,
    features: {
      clients: 'Unlimited',
      projects: 'Unlimited',
      tasks: 'Unlimited',
      storage: '100GB',
      sms: '1,000/month',
      support: 'Phone',
      scheduler: true,
      payments: true,
      branding: true,
      whiteLabel: true,
      team: 'Unlimited',
    },
  },
];

export const TIER_ORDER: TierSlug[] = ['free', 'pro', 'plus', 'business'];

export function getPlan(slug: TierSlug): PlanData {
  return PLANS.find((p) => p.slug === slug) || PLANS[0];
}

export function getPlanPrice(slug: TierSlug, period: BillingPeriod): number {
  return getPlan(slug).price[period];
}
