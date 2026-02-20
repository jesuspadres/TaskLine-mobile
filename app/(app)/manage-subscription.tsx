import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useSubscription } from '@/hooks/useSubscription';
import { getPlan } from '@/lib/plans';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { ConfirmDialog, showToast } from '@/components';
import {
  createPortalSession,
  createFoundingLockInSession,
  reactivateSubscription,
  cancelSubscription as cancelSubscriptionApi,
} from '@/lib/websiteApi';
import { secureLog } from '@/lib/security';
import { ENV } from '@/lib/env';

export default function ManageSubscriptionScreen() {
  const { colors } = useTheme();
  const { t } = useTranslations();
  const router = useRouter();
  const subscription = useSubscription();
  const plan = useMemo(() => getPlan(subscription.tier), [subscription.tier]);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [lockInLoading, setLockInLoading] = useState(false);

  const isIOS = Platform.OS === 'ios';
  const isFree = subscription.tier === 'free';
  const tierLabel = subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1);

  const statusLabel = useMemo(() => {
    if (subscription.cancelAtPeriodEnd) return t('manageSubscription.canceling');
    switch (subscription.status) {
      case 'active': return t('manageSubscription.active');
      case 'trialing': return t('manageSubscription.trialing');
      case 'past_due': return t('manageSubscription.pastDue');
      case 'canceled': return t('manageSubscription.canceled');
      default: return t('manageSubscription.active');
    }
  }, [subscription.status, subscription.cancelAtPeriodEnd, t]);

  const statusColor = useMemo(() => {
    if (subscription.cancelAtPeriodEnd) return colors.warning;
    switch (subscription.status) {
      case 'active': return colors.success;
      case 'trialing': return colors.info;
      case 'past_due': return colors.error;
      case 'canceled': return colors.error;
      default: return colors.success;
    }
  }, [subscription.status, subscription.cancelAtPeriodEnd, colors]);

  const handleCancelSubscription = async () => {
    setShowCancelConfirm(false);
    setCanceling(true);
    try {
      const result = await cancelSubscriptionApi();
      if (result.cancelAt) {
        subscription.updateOptimistic({
          cancelAtPeriodEnd: true,
          cancelAt: result.cancelAt,
        });
      } else {
        subscription.updateOptimistic({ cancelAtPeriodEnd: true });
      }
      showToast('success', t('manageSubscription.cancelSuccess'));
      await subscription.refresh();
    } catch (error: any) {
      secureLog.error('Cancel error:', error.message);
      showToast('error', error.message || t('plans.billingError'));
    } finally {
      setCanceling(false);
    }
  };

  const handleResumeSubscription = async () => {
    setCanceling(true);
    try {
      await reactivateSubscription();
      subscription.updateOptimistic({ cancelAtPeriodEnd: false, cancelAt: null });
      showToast('success', t('manageSubscription.resumed'));
      subscription.refresh();
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    } finally {
      setCanceling(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const url = await createPortalSession();
      await WebBrowser.openBrowserAsync(url);
      subscription.refresh();
    } catch (error: any) {
      secureLog.error('Portal error:', error.message);
      showToast('error', t('plans.billingError'));
    } finally {
      setPortalLoading(false);
    }
  };

  const handleLockIn = async () => {
    setLockInLoading(true);
    try {
      if (isIOS) {
        Linking.openURL(`${ENV.APP_URL}/pricing`);
      } else {
        const url = await createFoundingLockInSession();
        await WebBrowser.openBrowserAsync(url);
        subscription.refresh();
      }
    } catch (error: any) {
      secureLog.error('Lock-in error:', error.message);
      showToast('error', t('plans.checkoutError'));
    } finally {
      setLockInLoading(false);
    }
  };

  const formatDate = useCallback((dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const showFoundingBanner =
    subscription.isFoundingMember && subscription.isTrialing && !subscription.cardEntered;
  const showLockedIn = subscription.isFoundingMember && subscription.cardEntered;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('manageSubscription.title')}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Plan Card */}
        <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <View style={styles.planCardHeader}>
            <View style={styles.planCardTitleRow}>
              <Text style={[styles.planName, { color: colors.text }]}>{tierLabel}</Text>
              <View style={[styles.tierBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.tierBadgeText}>{tierLabel.toUpperCase()}</Text>
              </View>
              {subscription.isFoundingMember && (
                <View style={[styles.tierBadge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.tierBadgeText}>{t('settings.firstFifty')}</Text>
                </View>
              )}
            </View>
            {!isFree && (
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            )}
          </View>

          {!isFree && (
            <Text style={[styles.planPrice, { color: colors.textSecondary }]}>
              ${plan.price[subscription.billingPeriod === 'annual' ? 'annual' : 'monthly']}
              {t('plans.perMonth')}
              {subscription.billingPeriod && (
                <Text>
                  {' · '}
                  {subscription.billingPeriod === 'annual'
                    ? t('manageSubscription.annual')
                    : t('manageSubscription.monthly')}
                </Text>
              )}
            </Text>
          )}
        </View>

        {/* Subscription Details */}
        {!isFree && (
          <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('manageSubscription.subscriptionDetails')}
            </Text>

            {/* Billing period */}
            {subscription.billingPeriod && (
              <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('manageSubscription.billingPeriod')}
                  </Text>
                </View>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {subscription.billingPeriod === 'annual'
                    ? t('manageSubscription.annual')
                    : t('manageSubscription.monthly')}
                </Text>
              </View>
            )}

            {/* Status */}
            <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
              <View style={styles.detailLabelRow}>
                <Ionicons name="pulse-outline" size={18} color={colors.textSecondary} />
                <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                  {t('manageSubscription.status')}
                </Text>
              </View>
              <Text style={[styles.detailValue, { color: statusColor, fontWeight: '600' }]}>
                {statusLabel}
              </Text>
            </View>

            {/* Trial end */}
            {subscription.isTrialing && subscription.trialEnd && (
              <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.detailLabelRow}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {t('plans.trialEnds')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatDate(subscription.trialEnd)}
                  </Text>
                  <Text style={[styles.detailSubValue, { color: colors.info }]}>
                    {subscription.daysRemaining} {t('plans.daysRemaining')}
                  </Text>
                </View>
              </View>
            )}

            {/* Next billing / cancellation date */}
            {subscription.currentPeriodEnd && (
              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <View style={styles.detailLabelRow}>
                  <Ionicons
                    name={subscription.cancelAtPeriodEnd ? 'close-circle-outline' : 'refresh-outline'}
                    size={18}
                    color={subscription.cancelAtPeriodEnd ? colors.warning : colors.textSecondary}
                  />
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {subscription.cancelAtPeriodEnd
                      ? t('manageSubscription.cancelDate')
                      : t('manageSubscription.nextBillingDate')}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.detailValue,
                    { color: subscription.cancelAtPeriodEnd ? colors.warning : colors.text, fontWeight: '600' },
                  ]}
                >
                  {formatDate(subscription.cancelAt || subscription.currentPeriodEnd)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Founding member lock-in banner */}
        {showFoundingBanner && (
          <View style={[styles.foundingBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            <View style={styles.foundingBannerHeader}>
              <Ionicons name="star" size={20} color={colors.warning} />
              <Text style={[styles.foundingBannerTitle, { color: colors.text }]}>
                {t('settings.lockInOffer')}
              </Text>
            </View>
            <Text style={[styles.foundingBannerText, { color: colors.textSecondary }]}>
              {t('settings.lockInOfferSubtitle')}
            </Text>
            <TouchableOpacity
              style={[styles.lockInButton, { backgroundColor: colors.primary }]}
              onPress={handleLockIn}
              disabled={lockInLoading}
            >
              {lockInLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.lockInButtonText}>
                  {isIOS ? t('plans.visitWebsite') : t('plans.lockInDiscount')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Locked-in confirmation */}
        {showLockedIn && (
          <View style={[styles.lockedInBanner, { backgroundColor: colors.successLight, borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.lockedInText, { color: colors.success }]}>
              {t('plans.discountLockedIn')}
            </Text>
          </View>
        )}

        {/* Free Plan Upgrade Prompt */}
        {isFree && (
          <View style={[styles.freePrompt, { backgroundColor: `${colors.primary}14`, borderColor: colors.primary }]}>
            <Ionicons name="rocket-outline" size={24} color={colors.primary} />
            <Text style={[styles.freePromptText, { color: colors.text }]}>
              {t('manageSubscription.freePlanMessage')}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          {/* Cancel / Resume */}
          {!isFree && !isIOS && (
            subscription.cancelAtPeriodEnd ? (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={handleResumeSubscription}
                disabled={canceling}
              >
                {canceling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play-circle-outline" size={20} color="#fff" />
                    <Text style={styles.actionButtonTextLight}>
                      {t('manageSubscription.resumeSubscription')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setShowCancelConfirm(true)}
                disabled={canceling}
              >
                {canceling ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                    <Text style={[styles.actionButtonTextDark, { color: colors.error }]}>
                      {t('manageSubscription.cancelSubscription')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )
          )}

          {/* iOS: Direct to website for subscription changes */}
          {!isFree && isIOS && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => Linking.openURL(`${ENV.APP_URL}/pricing`)}
            >
              <Ionicons name="globe-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionButtonTextDark, { color: colors.primary }]}>
                {t('manageSubscription.manageOnWeb')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Manage Billing (Stripe Portal) */}
          {!isFree && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
              onPress={handleManageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="card-outline" size={20} color={colors.primary} />
                  <Text style={[styles.actionButtonTextDark, { color: colors.text }]}>
                    {t('manageSubscription.manageBilling')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {!isFree && (
            <Text style={[styles.manageBillingHint, { color: colors.textTertiary }]}>
              {t('manageSubscription.manageBillingHint')}
            </Text>
          )}

          {/* Compare Plans */}
          <TouchableOpacity
            style={[styles.comparePlansButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(app)/plans' as any)}
          >
            <Ionicons name="layers-outline" size={20} color="#fff" />
            <Text style={styles.comparePlansText}>
              {t('manageSubscription.comparePlans')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showCancelConfirm}
        title={t('manageSubscription.cancelSubscription')}
        message={t('manageSubscription.cancelWarning')}
        confirmLabel={t('plans.confirmCancel')}
        cancelLabel={t('common.cancel')}
        variant="danger"
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
  headerTitle: {
    flex: 1,
    fontSize: FontSizes.lg,
    fontWeight: '700',
    textAlign: 'center',
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
  // Current plan card
  planCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  planCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  planName: {
    fontSize: FontSizes['2xl'],
    fontWeight: '800',
  },
  tierBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  planPrice: {
    fontSize: FontSizes.md,
  },
  // Details card
  detailsCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailLabel: {
    fontSize: FontSizes.sm,
  },
  detailValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  detailSubValue: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  // Founding banner
  foundingBanner: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
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
  // Free plan prompt
  freePrompt: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  freePromptText: {
    flex: 1,
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  // Actions
  actionsSection: {
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    minHeight: 52,
  },
  actionButtonTextLight: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextDark: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  manageBillingHint: {
    fontSize: FontSizes.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  comparePlansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    minHeight: 52,
    marginTop: Spacing.sm,
  },
  comparePlansText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
});
