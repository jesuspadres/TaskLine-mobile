/**
 * Tests for lib/plans.ts
 * Covers PLANS array, getPlan(), getPlanPrice(), TIER_ORDER,
 * PLAN_FEATURE_KEYS, FEATURE_CATEGORIES, and per-tier feature flags
 */

import {
  PLANS,
  getPlan,
  getPlanPrice,
  TIER_ORDER,
  PLAN_FEATURE_KEYS,
  FEATURE_CATEGORIES,
  type TierSlug,
  type PlanData,
} from '@/lib/plans';

// ============================================================
// PLANS array structure
// ============================================================
describe('PLANS array', () => {
  it('contains exactly 4 plans', () => {
    expect(PLANS).toHaveLength(4);
  });

  it('plans are ordered: free, pro, plus, business', () => {
    expect(PLANS.map((p) => p.slug)).toEqual(['free', 'pro', 'plus', 'business']);
  });

  it('every plan has required fields', () => {
    for (const plan of PLANS) {
      expect(plan).toHaveProperty('nameKey');
      expect(plan).toHaveProperty('slug');
      expect(plan).toHaveProperty('price');
      expect(plan).toHaveProperty('descriptionKey');
      expect(plan).toHaveProperty('features');
      expect(plan.price).toHaveProperty('monthly');
      expect(plan.price).toHaveProperty('annual');
      expect(typeof plan.nameKey).toBe('string');
      expect(typeof plan.slug).toBe('string');
      expect(typeof plan.price.monthly).toBe('number');
      expect(typeof plan.price.annual).toBe('number');
    }
  });

  it('nameKeys use expected namespace', () => {
    expect(PLANS[0].nameKey).toBe('planNames.free');
    expect(PLANS[1].nameKey).toBe('planNames.pro');
    expect(PLANS[2].nameKey).toBe('planNames.plus');
    expect(PLANS[3].nameKey).toBe('planNames.business');
  });

  it('descriptionKeys use expected namespace', () => {
    expect(PLANS[0].descriptionKey).toBe('planDescriptions.free');
    expect(PLANS[1].descriptionKey).toBe('planDescriptions.pro');
    expect(PLANS[2].descriptionKey).toBe('planDescriptions.plus');
    expect(PLANS[3].descriptionKey).toBe('planDescriptions.business');
  });

  it('only "plus" plan is marked as popular', () => {
    const popular = PLANS.filter((p) => p.popular);
    expect(popular).toHaveLength(1);
    expect(popular[0].slug).toBe('plus');
  });

  it('only "business" plan is marked as comingSoon', () => {
    const comingSoon = PLANS.filter((p) => p.comingSoon);
    expect(comingSoon).toHaveLength(1);
    expect(comingSoon[0].slug).toBe('business');
  });

  it('annual price is always <= monthly price', () => {
    for (const plan of PLANS) {
      expect(plan.price.annual).toBeLessThanOrEqual(plan.price.monthly);
    }
  });
});

// ============================================================
// Plan pricing
// ============================================================
describe('Plan pricing', () => {
  it('free plan is $0 monthly and annually', () => {
    const free = PLANS.find((p) => p.slug === 'free')!;
    expect(free.price.monthly).toBe(0);
    expect(free.price.annual).toBe(0);
  });

  it('pro plan is $29/mo and $19/yr', () => {
    const pro = PLANS.find((p) => p.slug === 'pro')!;
    expect(pro.price.monthly).toBe(29);
    expect(pro.price.annual).toBe(19);
  });

  it('plus plan is $59/mo and $49/yr', () => {
    const plus = PLANS.find((p) => p.slug === 'plus')!;
    expect(plus.price.monthly).toBe(59);
    expect(plus.price.annual).toBe(49);
  });

  it('business plan is $119/mo and $99/yr', () => {
    const biz = PLANS.find((p) => p.slug === 'business')!;
    expect(biz.price.monthly).toBe(119);
    expect(biz.price.annual).toBe(99);
  });
});

// ============================================================
// Free tier features
// ============================================================
describe('Free tier features', () => {
  const free = PLANS.find((p) => p.slug === 'free')!;

  it('has limited clients, projects, tasks', () => {
    expect(free.features.clients).toBe('2');
    expect(free.features.projects).toBe('5');
    expect(free.features.tasks).toBe('20');
  });

  it('has 200MB storage', () => {
    expect(free.features.storage).toBe('200MB');
  });

  it('has core features enabled', () => {
    expect(free.features.clientPortal).toBe(true);
    expect(free.features.invoices).toBe(true);
    expect(free.features.projectTracking).toBe(true);
    expect(free.features.taskManagement).toBe(true);
    expect(free.features.fileSharing).toBe(true);
    expect(free.features.emailNotifications).toBe(true);
  });

  it('has advanced features disabled', () => {
    expect(free.features.payments).toBe(false);
    expect(free.features.scheduler).toBe(false);
    expect(free.features.productCatalog).toBe(false);
    expect(free.features.branding).toBe(false);
    expect(free.features.whiteLabel).toBe(false);
    expect(free.features.aiAssistant).toBe(false);
  });

  it('has no SMS and no team', () => {
    expect(free.features.sms).toBe('\u2014');
    expect(free.features.team).toBe('\u2014');
  });
});

// ============================================================
// Pro tier features
// ============================================================
describe('Pro tier features', () => {
  const pro = PLANS.find((p) => p.slug === 'pro')!;

  it('has unlimited clients, projects, tasks', () => {
    expect(pro.features.clients).toBe('featureValues.unlimited');
    expect(pro.features.projects).toBe('featureValues.unlimited');
    expect(pro.features.tasks).toBe('featureValues.unlimited');
  });

  it('has 5GB storage', () => {
    expect(pro.features.storage).toBe('5GB');
  });

  it('has scheduler enabled', () => {
    expect(pro.features.scheduler).toBe(true);
  });

  it('has limited product catalog', () => {
    expect(pro.features.productCatalog).toBe('featureValues.upTo6');
  });

  it('does not have payments, branding, whiteLabel, AI', () => {
    expect(pro.features.payments).toBe(false);
    expect(pro.features.branding).toBe(false);
    expect(pro.features.whiteLabel).toBe(false);
    expect(pro.features.aiAssistant).toBe(false);
  });
});

// ============================================================
// Plus tier features
// ============================================================
describe('Plus tier features', () => {
  const plus = PLANS.find((p) => p.slug === 'plus')!;

  it('has unlimited clients, projects, tasks, productCatalog', () => {
    expect(plus.features.clients).toBe('featureValues.unlimited');
    expect(plus.features.projects).toBe('featureValues.unlimited');
    expect(plus.features.tasks).toBe('featureValues.unlimited');
    expect(plus.features.productCatalog).toBe('featureValues.unlimited');
  });

  it('has 30GB storage', () => {
    expect(plus.features.storage).toBe('30GB');
  });

  it('has SMS enabled', () => {
    expect(plus.features.sms).toBe(true);
  });

  it('has payments and AI assistant', () => {
    expect(plus.features.payments).toBe(true);
    expect(plus.features.aiAssistant).toBe(true);
  });

  it('has branding marked as comingSoon', () => {
    expect(plus.features.branding).toBe('comingSoon');
  });

  it('does not have whiteLabel', () => {
    expect(plus.features.whiteLabel).toBe(false);
  });
});

// ============================================================
// Business tier features
// ============================================================
describe('Business tier features', () => {
  const biz = PLANS.find((p) => p.slug === 'business')!;

  it('has unlimited everything', () => {
    expect(biz.features.clients).toBe('featureValues.unlimited');
    expect(biz.features.projects).toBe('featureValues.unlimited');
    expect(biz.features.tasks).toBe('featureValues.unlimited');
    expect(biz.features.productCatalog).toBe('featureValues.unlimited');
  });

  it('has 100GB storage', () => {
    expect(biz.features.storage).toBe('100GB');
  });

  it('has all advanced features enabled', () => {
    expect(biz.features.sms).toBe(true);
    expect(biz.features.payments).toBe(true);
    expect(biz.features.scheduler).toBe(true);
    expect(biz.features.branding).toBe(true);
    expect(biz.features.whiteLabel).toBe(true);
    expect(biz.features.aiAssistant).toBe(true);
  });

  it('has team up to 5', () => {
    expect(biz.features.team).toBe('featureValues.upTo5');
  });

  it('has phone support', () => {
    expect(biz.features.support).toBe('supportLevels.phone');
  });
});

// ============================================================
// getPlan()
// ============================================================
describe('getPlan', () => {
  it('returns free plan for "free"', () => {
    const plan = getPlan('free');
    expect(plan.slug).toBe('free');
    expect(plan.price.monthly).toBe(0);
  });

  it('returns pro plan for "pro"', () => {
    const plan = getPlan('pro');
    expect(plan.slug).toBe('pro');
    expect(plan.price.monthly).toBe(29);
  });

  it('returns plus plan for "plus"', () => {
    const plan = getPlan('plus');
    expect(plan.slug).toBe('plus');
    expect(plan.popular).toBe(true);
  });

  it('returns business plan for "business"', () => {
    const plan = getPlan('business');
    expect(plan.slug).toBe('business');
    expect(plan.comingSoon).toBe(true);
  });

  it('returns free plan as fallback for unknown slug', () => {
    const plan = getPlan('enterprise' as TierSlug);
    expect(plan.slug).toBe('free');
  });

  it('returns the complete PlanData structure', () => {
    const plan = getPlan('pro');
    expect(plan).toHaveProperty('nameKey');
    expect(plan).toHaveProperty('slug');
    expect(plan).toHaveProperty('price');
    expect(plan).toHaveProperty('descriptionKey');
    expect(plan).toHaveProperty('features');
  });
});

// ============================================================
// getPlanPrice()
// ============================================================
describe('getPlanPrice', () => {
  it('returns 0 for free monthly', () => {
    expect(getPlanPrice('free', 'monthly')).toBe(0);
  });

  it('returns 0 for free annual', () => {
    expect(getPlanPrice('free', 'annual')).toBe(0);
  });

  it('returns 29 for pro monthly', () => {
    expect(getPlanPrice('pro', 'monthly')).toBe(29);
  });

  it('returns 19 for pro annual', () => {
    expect(getPlanPrice('pro', 'annual')).toBe(19);
  });

  it('returns 59 for plus monthly', () => {
    expect(getPlanPrice('plus', 'monthly')).toBe(59);
  });

  it('returns 49 for plus annual', () => {
    expect(getPlanPrice('plus', 'annual')).toBe(49);
  });

  it('returns 119 for business monthly', () => {
    expect(getPlanPrice('business', 'monthly')).toBe(119);
  });

  it('returns 99 for business annual', () => {
    expect(getPlanPrice('business', 'annual')).toBe(99);
  });

  it('falls back to free price for unknown tier', () => {
    expect(getPlanPrice('unknown' as TierSlug, 'monthly')).toBe(0);
  });
});

// ============================================================
// TIER_ORDER
// ============================================================
describe('TIER_ORDER', () => {
  it('has exactly 4 entries', () => {
    expect(TIER_ORDER).toHaveLength(4);
  });

  it('is ordered from lowest to highest tier', () => {
    expect(TIER_ORDER).toEqual(['free', 'pro', 'plus', 'business']);
  });

  it('free is at index 0', () => {
    expect(TIER_ORDER.indexOf('free')).toBe(0);
  });

  it('business is at index 3 (highest)', () => {
    expect(TIER_ORDER.indexOf('business')).toBe(3);
  });

  it('can be used for upgrade comparison (pro > free)', () => {
    expect(TIER_ORDER.indexOf('pro')).toBeGreaterThan(TIER_ORDER.indexOf('free'));
  });

  it('can be used for upgrade comparison (business > plus)', () => {
    expect(TIER_ORDER.indexOf('business')).toBeGreaterThan(TIER_ORDER.indexOf('plus'));
  });
});

// ============================================================
// PLAN_FEATURE_KEYS
// ============================================================
describe('PLAN_FEATURE_KEYS', () => {
  it('contains expected feature keys', () => {
    const keys = [...PLAN_FEATURE_KEYS];
    expect(keys).toContain('clients');
    expect(keys).toContain('projects');
    expect(keys).toContain('tasks');
    expect(keys).toContain('storage');
    expect(keys).toContain('sms');
    expect(keys).toContain('support');
    expect(keys).toContain('aiAssistant');
    expect(keys).toContain('scheduler');
    expect(keys).toContain('whiteLabel');
    expect(keys).toContain('team');
    expect(keys).toContain('payments');
    expect(keys).toContain('branding');
  });

  it('has 12 feature keys', () => {
    expect(PLAN_FEATURE_KEYS).toHaveLength(12);
  });

  it('all feature keys exist on every plan', () => {
    for (const key of PLAN_FEATURE_KEYS) {
      for (const plan of PLANS) {
        expect(plan.features).toHaveProperty(key);
      }
    }
  });
});

// ============================================================
// FEATURE_CATEGORIES
// ============================================================
describe('FEATURE_CATEGORIES', () => {
  it('has 4 categories', () => {
    expect(FEATURE_CATEGORIES).toHaveLength(4);
  });

  it('has expected category keys', () => {
    const categoryKeys = FEATURE_CATEGORIES.map((c) => c.categoryKey);
    expect(categoryKeys).toContain('featureCategories.limits');
    expect(categoryKeys).toContain('featureCategories.core');
    expect(categoryKeys).toContain('featureCategories.communication');
    expect(categoryKeys).toContain('featureCategories.advanced');
  });

  it('limits category has correct features', () => {
    const limits = FEATURE_CATEGORIES.find((c) => c.categoryKey === 'featureCategories.limits')!;
    expect([...limits.features]).toEqual(['clients', 'projects', 'tasks', 'storage', 'team']);
  });

  it('core category has correct features', () => {
    const core = FEATURE_CATEGORIES.find((c) => c.categoryKey === 'featureCategories.core')!;
    expect([...core.features]).toEqual([
      'clientPortal',
      'invoices',
      'projectTracking',
      'taskManagement',
      'fileSharing',
    ]);
  });

  it('communication category has correct features', () => {
    const comm = FEATURE_CATEGORIES.find(
      (c) => c.categoryKey === 'featureCategories.communication',
    )!;
    expect([...comm.features]).toEqual(['emailNotifications', 'sms', 'support']);
  });

  it('advanced category has correct features', () => {
    const adv = FEATURE_CATEGORIES.find((c) => c.categoryKey === 'featureCategories.advanced')!;
    expect([...adv.features]).toEqual([
      'aiAssistant',
      'scheduler',
      'productCatalog',
      'payments',
      'branding',
      'whiteLabel',
    ]);
  });

  it('all features across categories are valid PlanFeatures keys', () => {
    const allCategoryFeatures = FEATURE_CATEGORIES.flatMap((c) => [...c.features]);
    const samplePlan = PLANS[0];
    for (const feature of allCategoryFeatures) {
      expect(samplePlan.features).toHaveProperty(feature);
    }
  });

  it('every category has at least one feature', () => {
    for (const category of FEATURE_CATEGORIES) {
      expect(category.features.length).toBeGreaterThan(0);
    }
  });
});
