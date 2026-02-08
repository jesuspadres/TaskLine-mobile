import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useSubscription } from '@/hooks/useSubscription';
import { PLANS, TIER_ORDER, type TierSlug, type BillingPeriod, type PlanData } from '@/lib/plans';
import { ENV } from '@/lib/env';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';

const FEATURE_LABELS: Record<string, { label: string; icon: string }> = {
  clients: { label: 'Clients', icon: 'people-outline' },
  projects: { label: 'Projects', icon: 'folder-outline' },
  tasks: { label: 'Tasks', icon: 'checkbox-outline' },
  storage: { label: 'Storage', icon: 'cloud-outline' },
  sms: { label: 'SMS Credits', icon: 'chatbubble-outline' },
  support: { label: 'Support', icon: 'headset-outline' },
  scheduler: { label: 'Scheduler', icon: 'calendar-outline' },
  payments: { label: 'Payments', icon: 'card-outline' },
  branding: { label: 'Custom Branding', icon: 'color-palette-outline' },
  whiteLabel: { label: 'White Label', icon: 'shield-outline' },
  team: { label: 'Team Members', icon: 'people-circle-outline' },
};

export default function PlansScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const subscription = useSubscription();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [expandedPlan, setExpandedPlan] = useState<TierSlug | null>(null);

  const currentTierIndex = TIER_ORDER.indexOf(subscription.tier);

  const handleSelectPlan = async (plan: PlanData) => {
    if (plan.comingSoon) {
      Alert.alert('Coming Soon', `The ${plan.name} plan will be available soon!`);
      return;
    }

    if (plan.slug === subscription.tier) return;

    const isUpgrade = TIER_ORDER.indexOf(plan.slug) > currentTierIndex;

    if (plan.slug === 'free') {
      Alert.alert(
        'Downgrade to Free',
        'Are you sure? You will lose access to premium features at the end of your billing period.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Downgrade',
            style: 'destructive',
            onPress: () => openStripePortal(),
          },
        ]
      );
      return;
    }

    // Open Stripe checkout for upgrade/downgrade
    const checkoutUrl = `${ENV.APP_URL}/api/stripe/checkout?plan=${plan.slug}&period=${billingPeriod}`;
    try {
      const canOpen = await Linking.canOpenURL(checkoutUrl);
      if (canOpen) {
        await Linking.openURL(checkoutUrl);
      } else {
        Alert.alert('Error', 'Unable to open checkout. Please try from the website.');
      }
    } catch {
      Alert.alert('Error', 'Failed to open checkout page.');
    }
  };

  const openStripePortal = async () => {
    const portalUrl = `${ENV.APP_URL}/api/stripe/portal`;
    try {
      await Linking.openURL(portalUrl);
    } catch {
      Alert.alert('Error', 'Failed to open billing portal.');
    }
  };

  const renderFeatureValue = (value: boolean | string | 'comingSoon') => {
    if (value === true) {
      return <Ionicons name="checkmark-circle" size={18} color={colors.success} />;
    }
    if (value === false || value === '-') {
      return <Ionicons name="close-circle" size={18} color={colors.textTertiary} />;
    }
    if (value === 'comingSoon') {
      return (
        <View style={[styles.comingSoonBadge, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.comingSoonText, { color: colors.warning }]}>Soon</Text>
        </View>
      );
    }
    return <Text style={[styles.featureValueText, { color: colors.text }]}>{value}</Text>;
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Choose Your Plan</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Unlock more features
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
              Monthly
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
              Annual
            </Text>
            <View style={[styles.saveBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.saveBadgeText}>Save 20%</Text>
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
          const isDowngrade = tierIndex < currentTierIndex;
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
                  <Text style={styles.popularBadgeText}>Most Popular</Text>
                </View>
              )}

              {/* Current plan badge */}
              {isCurrent && (
                <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#fff" />
                  <Text style={styles.popularBadgeText}>Current Plan</Text>
                </View>
              )}

              {/* Plan header */}
              <View style={styles.planHeader}>
                <View>
                  <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                  <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                    {plan.description}
                  </Text>
                </View>
              </View>

              {/* Price */}
              <View style={styles.priceRow}>
                <Text style={[styles.priceAmount, { color: colors.text }]}>
                  ${price}
                </Text>
                {price > 0 && (
                  <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>/mo</Text>
                )}
                {price === 0 && (
                  <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>forever</Text>
                )}
              </View>

              {billingPeriod === 'annual' && savings > 0 && (
                <Text style={[styles.savingsText, { color: colors.success }]}>
                  Save {savings}% vs monthly
                </Text>
              )}

              {/* Key features summary */}
              <View style={[styles.featureSummary, { borderTopColor: colors.borderLight }]}>
                <View style={styles.summaryRow}>
                  <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                    {plan.features.clients} clients
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="folder-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                    {plan.features.projects} projects
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="cloud-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                    {plan.features.storage} storage
                  </Text>
                </View>
              </View>

              {/* Expand/collapse features */}
              <TouchableOpacity
                style={[styles.expandButton, { borderTopColor: colors.borderLight }]}
                onPress={() => setExpandedPlan(isExpanded ? null : plan.slug)}
              >
                <Text style={[styles.expandButtonText, { color: colors.primary }]}>
                  {isExpanded ? 'Hide features' : 'All features'}
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
                    const meta = FEATURE_LABELS[key];
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
                    Coming Soon
                  </Text>
                </View>
              ) : isCurrent ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary }]}
                  onPress={openStripePortal}
                >
                  <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>
                    Manage Subscription
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: isUpgrade ? colors.primary : colors.surfaceSecondary,
                    },
                  ]}
                  onPress={() => handleSelectPlan(plan)}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      { color: isUpgrade ? '#fff' : colors.text },
                    ]}
                  >
                    {isUpgrade ? 'Upgrade' : 'Downgrade'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Manage billing link */}
        {subscription.tier !== 'free' && (
          <TouchableOpacity
            style={[styles.manageLink, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={openStripePortal}
          >
            <Ionicons name="card-outline" size={20} color={colors.primary} />
            <View style={styles.manageLinkContent}>
              <Text style={[styles.manageLinkTitle, { color: colors.text }]}>
                Manage Billing
              </Text>
              <Text style={[styles.manageLinkSubtitle, { color: colors.textSecondary }]}>
                Update payment method, view invoices, cancel
              </Text>
            </View>
            <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </ScrollView>
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
  },
  actionButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  // Manage link
  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    marginTop: Spacing.sm,
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
});
