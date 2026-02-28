import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useSubscription } from '@/hooks/useSubscription';
import { ENV } from '@/lib/env';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { showToast } from '@/components';
import { secureLog } from '@/lib/security';
import { createConnectDashboardSession, websiteApiFetch } from '@/lib/websiteApi';

type ConnectStatus = 'loading' | 'not_connected' | 'incomplete' | 'connected';

export default function StripePaymentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const { user } = useAuthStore();
  const { isPlus, isBusiness, tier } = useSubscription();

  const [status, setStatus] = useState<ConnectStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const canUseStripe = isPlus || isBusiness;

  const fetchStripeStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await (supabase.from('user_settings') as any)
        .select('stripe_account_id, stripe_connect_onboarded')
        .eq('user_id', user.id)
        .single();

      if (!data || !data.stripe_account_id) {
        setStatus('not_connected');
      } else if (!data.stripe_connect_onboarded) {
        setStatus('incomplete');
      } else {
        setStatus('connected');
      }
    } catch {
      setStatus('not_connected');
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStripeStatus();
  }, [fetchStripeStatus]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStripeStatus();
    setRefreshing(false);
  };

  const handleSetup = async () => {
    // Try to start Connect onboarding via the website API
    setActionLoading(true);
    try {
      const res = await websiteApiFetch('/api/stripe/connect/onboard', {
        method: 'POST',
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Onboarding failed (${res.status})`);
      }
      const data = await res.json();
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
        // Refresh status after returning from onboarding
        fetchStripeStatus();
        return;
      }
    } catch (error: any) {
      secureLog.error('Connect onboarding error:', error.message);
    } finally {
      setActionLoading(false);
    }
    // Fallback: open the website
    showToast('info', t('stripePayments.loginToSetup'));
    WebBrowser.openBrowserAsync(`${ENV.APP_URL}/en/settings`);
  };

  const handleViewDashboard = async () => {
    setActionLoading(true);
    try {
      // Try getting a dashboard login link via the website API
      const url = await createConnectDashboardSession();
      await WebBrowser.openBrowserAsync(url);
      return;
    } catch (error: any) {
      secureLog.error('Dashboard link error:', error.message);
    } finally {
      setActionLoading(false);
    }

    // Fallback: try opening the Stripe Express app
    try {
      const stripeExpressUrl = 'stripe-express://';
      const canOpen = await Linking.canOpenURL(stripeExpressUrl);
      if (canOpen) {
        await Linking.openURL(stripeExpressUrl);
        return;
      }
    } catch {}

    // Final fallback: open Stripe Express Dashboard in browser
    WebBrowser.openBrowserAsync('https://connect.stripe.com/express_login');
  };

  const handleUpgrade = () => {
    router.push('/(app)/plans' as any);
  };

  const statusConfig = {
    connected: {
      icon: 'checkmark-circle' as const,
      color: colors.success,
      bgColor: colors.successLight,
      titleKey: 'stripePayments.statusConnected',
      subtitleKey: 'stripePayments.statusConnectedSubtitle',
    },
    incomplete: {
      icon: 'alert-circle' as const,
      color: colors.warning,
      bgColor: colors.warningLight,
      titleKey: 'stripePayments.statusIncomplete',
      subtitleKey: 'stripePayments.statusIncompleteSubtitle',
    },
    not_connected: {
      icon: 'close-circle' as const,
      color: colors.textTertiary,
      bgColor: colors.surfaceSecondary,
      titleKey: 'stripePayments.statusNotConnected',
      subtitleKey: 'stripePayments.statusNotConnectedSubtitle',
    },
  };

  const features = [
    { icon: 'card-outline', key: 'stripePayments.featureCards' },
    { icon: 'arrow-forward-circle-outline', key: 'stripePayments.featureDirectDeposit' },
    { icon: 'shield-checkmark-outline', key: 'stripePayments.featureSecurity' },
    { icon: 'cash-outline', key: 'stripePayments.featurePayouts' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('stripePayments.title')}</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Tier Gate */}
        {!canUseStripe && (
          <View style={[styles.tierGate, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            <View style={styles.tierGateHeader}>
              <Ionicons name="diamond-outline" size={24} color={colors.warning} />
              <Text style={[styles.tierGateTitle, { color: colors.warning }]}>
                {t('stripePayments.plusRequired')}
              </Text>
            </View>
            <Text style={[styles.tierGateText, { color: colors.textSecondary }]}>
              {t('stripePayments.plusRequiredSubtitle')}
            </Text>
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: colors.warning }]}
              onPress={handleUpgrade}
            >
              <Text style={styles.upgradeButtonText}>{t('stripePayments.upgradePlan')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Status Card */}
        {canUseStripe && status !== 'loading' && (
          <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statusIconContainer, { backgroundColor: statusConfig[status].bgColor }]}>
              <Ionicons
                name={statusConfig[status].icon as any}
                size={32}
                color={statusConfig[status].color}
              />
            </View>
            <Text style={[styles.statusTitle, { color: colors.text }]}>
              {t(statusConfig[status].titleKey)}
            </Text>
            <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
              {t(statusConfig[status].subtitleKey)}
            </Text>

            {/* Action Buttons */}
            {status === 'connected' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleViewDashboard}
              >
                <Ionicons name="open-outline" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>{t('stripePayments.viewDashboard')}</Text>
              </TouchableOpacity>
            )}

            {status === 'incomplete' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.warning }]}
                onPress={handleSetup}
              >
                <Ionicons name="construct-outline" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>{t('stripePayments.completeSetup')}</Text>
              </TouchableOpacity>
            )}

            {status === 'not_connected' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleSetup}
              >
                <Ionicons name="flash-outline" size={18} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>{t('stripePayments.connectStripe')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {canUseStripe && status === 'loading' && (
          <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.statusSubtitle, { color: colors.textSecondary, marginTop: Spacing.md }]}>
              {t('stripePayments.checkingStatus')}
            </Text>
          </View>
        )}

        {/* How It Works */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>
            {t('stripePayments.howItWorks')}
          </Text>

          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: colors.infoLight }]}>
                <Ionicons name={feature.icon as any} size={20} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                {t(feature.key)}
              </Text>
            </View>
          ))}
        </View>

        {/* Fee Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.feeHeader}>
            <Ionicons name="information-circle-outline" size={20} color={colors.info} />
            <Text style={[styles.infoTitle, { color: colors.text, marginBottom: 0, marginLeft: Spacing.sm }]}>
              {t('stripePayments.fees')}
            </Text>
          </View>
          <Text style={[styles.feeText, { color: colors.textSecondary }]}>
            {t('stripePayments.feesDescription')}
          </Text>
        </View>

        {/* Manage on Web hint */}
        {canUseStripe && status !== 'loading' && (
          <View style={[styles.hintCard, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="globe-outline" size={18} color={colors.textTertiary} />
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
              {t('stripePayments.manageOnWeb')}
            </Text>
          </View>
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  // Tier gate
  tierGate: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  tierGateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tierGateTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  tierGateText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  // Status card
  statusCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  statusIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontSize: FontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
  // Info card
  infoCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  // Fee info
  feeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  feeText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  // Hint
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  hintText: {
    flex: 1,
    fontSize: FontSizes.xs,
    lineHeight: 18,
  },
});
