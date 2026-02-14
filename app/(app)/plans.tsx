import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useSubscription } from '@/hooks/useSubscription';
import { PLANS, TIER_ORDER, type TierSlug, type BillingPeriod, type PlanData } from '@/lib/plans';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';
import { ConfirmDialog, showToast } from '@/components';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import {
  createCheckoutSession,
  createPortalSession,
  createFoundingLockInSession,
} from '@/lib/websiteApi';
import { secureLog } from '@/lib/security';

export default function PlansScreen() {
  const { colors, isDark } = useTheme();
  const { t } = useTranslations();
  const router = useRouter();
  const subscription = useSubscription();
  const { user } = useAuthStore();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [expandedPlan, setExpandedPlan] = useState<TierSlug | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const currentTierIndex = TIER_ORDER.indexOf(subscription.tier);

  const featureLabels = useMemo(() => ({
    clients: { label: t('plans.clients'), icon: 'people-outline' },
    projects: { label: t('plans.projects'), icon: 'folder-outline' },
    tasks: { label: t('plans.tasks'), icon: 'checkbox-outline' },
    storage: { label: t('plans.storage'), icon: 'cloud-outline' },
    sms: { label: t('plans.sms'), icon: 'chatbubble-outline' },
    support: { label: t('plans.support'), icon: 'headset-outline' },
    scheduler: { label: t('plans.scheduler'), icon: 'calendar-outline' },
    payments: { label: t('plans.payments'), icon: 'card-outline' },
    branding: { label: t('plans.branding'), icon: 'color-palette-outline' },
    whiteLabel: { label: t('plans.whiteLabel'), icon: 'shield-outline' },
    team: { label: t('plans.team'), icon: 'people-circle-outline' },
    clientPortal: { label: t('plans.clientPortal'), icon: 'globe-outline' },
    invoices: { label: t('plans.invoiceCreation'), icon: 'document-text-outline' },
    projectTracking: { label: t('plans.projectTracking'), icon: 'analytics-outline' },
    taskManagement: { label: t('plans.taskManagement'), icon: 'list-outline' },
    fileSharing: { label: t('plans.fileSharing'), icon: 'share-outline' },
    emailNotifications: { label: t('plans.emailNotifications'), icon: 'mail-outline' },
    productCatalog: { label: t('plans.productCatalog'), icon: 'pricetag-outline' },
  }), [t]) as Record<string, { label: string; icon: string }>;

  /** Resolve feature string values that may be i18n keys */
  const resolveFeatureValue = useCallback((value: boolean | string) => {
    if (typeof value !== 'string') return value;
    if (value.includes('.')) {
      return t(`plans.${value}`);
    }
    return value;
  }, [t]);

  const handleSelectPlan = async (plan: PlanData) => {
    const planName = t(`plans.${plan.nameKey}`);
    if (plan.comingSoon) {
      Alert.alert(t('plans.comingSoon'), `${planName}`);
      return;
    }

    if (plan.slug === subscription.tier) return;

    if (plan.slug === 'free') {
      Alert.alert(
        t('plans.downgrade'),
        t('plans.cancelWarning'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('plans.confirmCancel'),
            style: 'destructive',
            onPress: () => setShowCancelConfirm(true),
          },
        ]
      );
      return;
    }

    // Open Stripe Checkout via the website API
    setCheckoutLoading(true);
    try {
      const interval = billingPeriod === 'annual' ? 'year' : 'month';
      const { url } = await createCheckoutSession(plan.slug, interval);
      await Linking.openURL(url);
    } catch (error: any) {
      secureLog.error('Checkout error:', error.message);
      showToast('error', t('plans.checkoutError'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleLockInDiscount = async () => {
    setCheckoutLoading(true);
    try {
      const url = await createFoundingLockInSession();
      await Linking.openURL(url);
    } catch (error: any) {
      secureLog.error('Lock-in error:', error.message);
      showToast('error', t('plans.checkoutError'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setCheckoutLoading(true);
    try {
      const url = await createPortalSession();
      await Linking.openURL(url);
    } catch (error: any) {
      secureLog.error('Portal error:', error.message);
      showToast('error', t('plans.billingError'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setShowCancelConfirm(false);
    setCanceling(true);
    try {
      const { error } = await (supabase.from('subscriptions') as any)
        .update({ cancel_at_period_end: true } as any)
        .eq('user_id', user?.id)
        .in('status', ['active', 'trialing']);

      if (error) throw error;
      showToast('success', t('plans.cancelConfirmed'));
      subscription.refresh();
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    } finally {
      setCanceling(false);
    }
  };

  const handleResumeSubscription = async () => {
    setCanceling(true);
    try {
      const { error } = await (supabase.from('subscriptions') as any)
        .update({ cancel_at_period_end: false } as any)
        .eq('user_id', user?.id)
        .in('status', ['active', 'trialing']);

      if (error) throw error;
      showToast('success', t('plans.resumed'));
      subscription.refresh();
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    } finally {
      setCanceling(false);
    }
  };

  const renderFeatureValue = (value: boolean | string | 'comingSoon') => {
    if (value === true) {
      return <Ionicons name="checkmark-circle" size={18} color={colors.success} />;
    }
    if (value === false || value === '-' || value === '\u2014') {
      return <Ionicons name="close-circle" size={18} color={colors.textTertiary} />;
    }
    if (value === 'comingSoon') {
      return (
        <View style={[styles.comingSoonBadge, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.comingSoonText, { color: colors.warning }]}>
            {t('plans.comingSoon')}
          </Text>
        </View>
      );
    }
    const resolved = resolveFeatureValue(value);
    return <Text style={[styles.featureValueText, { color: colors.text }]}>{resolved}</Text>;
  };

  const annualSavings = useMemo(() => {
    return PLANS.reduce((acc, plan) => {
      if (plan.price.monthly === 0) return acc;
      const monthlyCost = plan.price.monthly * 12;
      const annualCost = plan.price.annual * 12;
      const savings = Math.round(((monthlyCost - annualCost) / monthlyCost) * 100);
      return { ...acc, [plan.slug]: savings };
    }, {} as Record<string, number>);
  }, []);

  // Show founding member banner if trialing + founding member + card not entered
  const showFoundingBanner = subscription.isFoundingMember && subscription.isTrialing && !subscription.cardEntered;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('plans.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {t('plans.subtitle')}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Founding Member Welcome Banner */}
        {showFoundingBanner && (
          <View style={[styles.foundingBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            <View style={styles.foundingBannerHeader}>
              <Ionicons name="star" size={20} color={colors.warning} />
              <Text style={[styles.foundingBannerTitle, { color: colors.text }]}>
                {t('plans.welcomeFoundingMember')}
              </Text>
            </View>
            <Text style={[styles.foundingBannerText, { color: colors.textSecondary }]}>
              {t('plans.trialEndsIn', { days: String(subscription.daysRemaining ?? 0) })}
            </Text>
            <Text style={[styles.foundingBannerText, { color: colors.textSecondary }]}>
              {t('plans.enterCardPrompt')}
            </Text>

            {/* Progress bar */}
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.primary,
                    width: `${Math.min(100, Math.max(0, ((90 - (subscription.daysRemaining ?? 0)) / 90) * 100))}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.foundingDaysText, { color: colors.textTertiary }]}>
              {subscription.daysRemaining ?? 0} {t('plans.daysRemaining')}
            </Text>

            <TouchableOpacity
              style={[styles.lockInButton, { backgroundColor: colors.primary }]}
              onPress={handleLockInDiscount}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="lock-closed" size={16} color="#fff" style={{ marginRight: Spacing.xs }} />
                  <Text style={styles.lockInButtonText}>{t('plans.lockInDiscount')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Locked-in confirmation for founding members who entered card */}
        {subscription.isFoundingMember && subscription.cardEntered && (
          <View style={[styles.lockedInBanner, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.lockedInText, { color: colors.success }]}>
              {t('plans.discountLockedIn')}
            </Text>
          </View>
        )}

        {/* Billing Toggle */}
        <View style={[styles.billingToggle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingPeriod === 'monthly' && { backgroundColor: colors.surface },
              billingPeriod === 'monthly' && Shadows.sm,
            ]}
            onPress={() => setBillingPeriod('monthly')}
          >
            <Text
              style={[
                styles.billingOptionText,
                { color: billingPeriod === 'monthly' ? colors.text : colors.textSecondary },
              ]}
            >
              {t('plans.monthly')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingPeriod === 'annual' && { backgroundColor: colors.surface },
              billingPeriod === 'annual' && Shadows.sm,
            ]}
            onPress={() => setBillingPeriod('annual')}
          >
            <Text
              style={[
                styles.billingOptionText,
                { color: billingPeriod === 'annual' ? colors.text : colors.textSecondary },
              ]}
            >
              {t('plans.annual')}
            </Text>
            <View style={[styles.saveBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.saveBadgeText}>{t('plans.savePercent', { percent: '20' })}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Plan Cards */}
        {PLANS.map((plan) => {
          const isCurrent = plan.slug === subscription.tier;
          const isPopular = plan.popular;
          const isExpanded = expandedPlan === plan.slug;
          const tierIndex = TIER_ORDER.indexOf(plan.slug);
          const isUpgrade = tierIndex > currentTierIndex;
          const price = plan.price[billingPeriod];
          const savings = annualSavings[plan.slug] || 0;

          return (
            <View
              key={plan.slug}
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isCurrent ? colors.primary : isPopular ? colors.accent : colors.border,
                  borderWidth: isCurrent || isPopular ? 2 : 1,
                },
              ]}
            >
              {/* Popular badge */}
              {isPopular && !isCurrent && (
                <View style={[styles.popularBadge, { backgroundColor: colors.accent }]}>
                  <Ionicons name="star" size={12} color="#fff" />
                  <Text style={styles.popularBadgeText}>{t('plans.popular')}</Text>
                </View>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#fff" />
                  <Text style={styles.popularBadgeText}>{t('plans.currentPlan')}</Text>
                </View>
              )}

              {/* Plan header */}
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, { color: colors.text }]}>
                    {t(`plans.${plan.nameKey}`)}
                  </Text>
                  <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                    {t(`plans.${plan.descriptionKey}`)}
                  </Text>
                </View>
              </View>

              {/* Price */}
              <View style={styles.priceRow}>
                <Text style={[styles.priceAmount, { color: colors.text }]}>
                  ${price}
                </Text>
                {price > 0 && (
                  <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>
                    {t('plans.perMonth')}
                  </Text>
                )}
                {price === 0 && (
                  <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>
                    {t('plans.forever')}
                  </Text>
                )}
              </View>

              {billingPeriod === 'annual' && savings > 0 && (
                <Text style={[styles.savingsText, { color: colors.success }]}>
                  {t('plans.saveVsMonthly', { percent: String(savings) })}
                </Text>
              )}

              {/* Key features summary */}
              <View style={[styles.featureSummary, { borderTopColor: colors.borderLight }]}>
                <View style={styles.summaryRow}>
                  <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                    {resolveFeatureValue(plan.features.clients)} {t('plans.clients').toLowerCase()}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="folder-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                    {resolveFeatureValue(plan.features.projects)} {t('plans.projects').toLowerCase()}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="cloud-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                    {plan.features.storage} {t('plans.storage').toLowerCase()}
                  </Text>
                </View>
              </View>

              {/* Expand/collapse features */}
              <TouchableOpacity
                style={[styles.expandButton, { borderTopColor: colors.borderLight }]}
                onPress={() => setExpandedPlan(isExpanded ? null : plan.slug)}
              >
                <Text style={[styles.expandButtonText, { color: colors.primary }]}>
                  {isExpanded ? t('plans.hideFeatures') : t('plans.allFeatures')}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.primary}
                />
              </TouchableOpacity>

              {/* Expanded features list */}
              {isExpanded && (
                <View style={[styles.featuresList, { borderTopColor: colors.borderLight }]}>
                  {Object.entries(plan.features).map(([key, value]) => {
                    const meta = featureLabels[key];
                    if (!meta) return null;
                    return (
                      <View key={key} style={styles.featureRow}>
                        <View style={styles.featureLabelRow}>
                          <Ionicons name={meta.icon as any} size={16} color={colors.textSecondary} />
                          <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>
                            {meta.label}
                          </Text>
                        </View>
                        {renderFeatureValue(value)}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Action button */}
              {plan.comingSoon ? (
                <View style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.actionButtonText, { color: colors.textTertiary }]}>
                    {t('plans.comingSoon')}
                  </Text>
                </View>
              ) : isCurrent ? (
                subscription.tier === 'free' ? (
                  <View style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.actionButtonText, { color: colors.textTertiary }]}>
                      {t('plans.currentPlan')}
                    </Text>
                  </View>
                ) : subscription.cancelAtPeriodEnd ? (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.primary }]}
                    onPress={handleResumeSubscription}
                    disabled={canceling}
                  >
                    <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                      {t('plans.resumeSubscription')}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => setShowCancelConfirm(true)}
                    disabled={canceling}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                      {t('plans.cancelSubscription')}
                    </Text>
                  </TouchableOpacity>
                )
              ) : (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: isUpgrade ? colors.primary : colors.surfaceSecondary,
                    },
                  ]}
                  onPress={() => handleSelectPlan(plan)}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? (
                    <ActivityIndicator size="small" color={isUpgrade ? '#fff' : colors.text} />
                  ) : (
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: isUpgrade ? '#fff' : colors.text },
                      ]}
                    >
                      {isUpgrade ? t('plans.upgrade') : t('plans.downgrade')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Subscription Info + Manage Billing */}
        {subscription.tier !== 'free' && (
          <View style={[styles.manageLink, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.manageLinkRow}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
              <View style={styles.manageLinkContent}>
                <Text style={[styles.manageLinkTitle, { color: colors.text }]}>
                  {t('plans.billingInfo')}
                </Text>
                {subscription.isTrialing && subscription.trialEnd && (
                  <Text style={[styles.manageLinkSubtitle, { color: colors.textSecondary }]}>
                    {t('plans.trialEnds')} {new Date(subscription.trialEnd).toLocaleDateString()}
                  </Text>
                )}
                {subscription.billingPeriod && (
                  <Text style={[styles.manageLinkSubtitle, { color: colors.textSecondary }]}>
                    {subscription.billingPeriod === 'annual' ? t('plans.annual') : t('plans.monthly')} {t('plans.billing').toLowerCase()}
                  </Text>
                )}
                {subscription.currentPeriodEnd && (
                  <Text style={[styles.manageLinkSubtitle, { color: colors.textSecondary }]}>
                    {subscription.cancelAtPeriodEnd
                      ? `${t('plans.cancelsOn')} ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                      : `${t('plans.renewsOn')} ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.manageBillingButton, { backgroundColor: colors.primary }]}
              onPress={handleManageBilling}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="open-outline" size={16} color="#fff" />
                  <Text style={styles.manageBillingText}>{t('plans.manageBilling')}</Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={[styles.manageBillingHint, { color: colors.textTertiary }]}>
              {t('plans.manageBillingHint')}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Loading overlay */}
      {checkoutLoading && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {t('plans.preparingCheckout')}
            </Text>
          </View>
        </View>
      )}

      <ConfirmDialog
        visible={showCancelConfirm}
        title={t('plans.cancelSubscription')}
        message={t('plans.cancelWarning')}
        confirmLabel={t('plans.confirmCancel')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleCancelSubscription}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: FontSizes.sm,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  // Founding member banner
  foundingBanner: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  foundingBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  foundingBannerTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  foundingBannerText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  foundingDaysText: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  lockInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    minHeight: 48,
  },
  lockInButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#fff',
  },
  lockedInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  lockedInText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  // Billing toggle
  billingToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    padding: 4,
    marginBottom: Spacing.xl,
    borderWidth: 1,
  },
  billingOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  billingOptionText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  saveBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  saveBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  // Plan cards
  planCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
    marginBottom: Spacing.sm,
  },
  popularBadgeText: {
    color: '#fff',
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  planHeader: {
    marginBottom: Spacing.md,
  },
  planName: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: 2,
  },
  planDescription: {
    fontSize: FontSizes.sm,
  },
  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.xs,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: '800',
  },
  pricePeriod: {
    fontSize: FontSizes.md,
    marginLeft: 4,
  },
  savingsText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  // Features summary
  featureSummary: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryText: {
    fontSize: FontSizes.sm,
  },
  // Expand
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    gap: 4,
  },
  expandButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  // Features list
  featuresList: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  featureLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureLabel: {
    fontSize: FontSizes.sm,
  },
  featureValueText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  comingSoonBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  comingSoonText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  // Action button
  actionButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    minHeight: 48,
  },
  actionButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // Manage link
  manageLink: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  manageLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  manageLinkContent: {
    flex: 1,
  },
  manageLinkTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  manageLinkSubtitle: {
    fontSize: FontSizes.sm,
  },
  manageBillingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    minHeight: 48,
  },
  manageBillingText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  manageBillingHint: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 16,
  },
  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSizes.sm,
  },
});
