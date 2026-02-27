import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useSubscription } from '@/hooks/useSubscription';
import { getFoundingSpots, claimFoundingSpot } from '@/lib/websiteApi';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { showToast } from '@/components/Toast';
import { secureLog } from '@/lib/security';
import { ENV } from '@/lib/env';

interface FoundingPromoBannerProps {
  /** Compact mode for dashboard (less detail) */
  compact?: boolean;
}

export function FoundingPromoBanner({ compact = false }: FoundingPromoBannerProps) {
  const { colors } = useTheme();
  const { t } = useTranslations();
  const subscription = useSubscription();

  const [spots, setSpots] = useState<{ claimed: number; total: number; remaining: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEligible =
    !subscription.isFoundingMember &&
    (subscription.isFree || subscription.isPro) &&
    !subscription.loading;

  useEffect(() => {
    if (!isEligible) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await getFoundingSpots();
        if (!cancelled) setSpots(data);
      } catch (err) {
        secureLog.debug('Failed to fetch founding spots:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isEligible]);

  const handleClaim = useCallback(async () => {
    if (Platform.OS === 'ios') {
      Linking.openURL(`${ENV.APP_URL}/pricing`);
      return;
    }

    setClaiming(true);
    setError(null);
    try {
      await claimFoundingSpot();
      showToast('success', t('first50.spotClaimed'));
      subscription.refresh();
    } catch (err: any) {
      const message = err?.message || '';
      if (message.includes('all_spots_claimed')) {
        setError(t('first50.errorAllClaimed'));
      } else {
        setError(t('first50.errorGeneric'));
      }
      secureLog.error('Founding claim error:', message);
    } finally {
      setClaiming(false);
    }
  }, [subscription, t]);

  // Don't render if not eligible or no spots available
  if (!isEligible || loading) return null;
  if (!spots || spots.remaining <= 0) return null;

  // Show at least 10 for social proof
  const displayClaimed = Math.max(spots.claimed, 10);
  const progressPercent = (displayClaimed / spots.total) * 100;
  const isUrgent = displayClaimed >= 40;
  const isModerate = displayClaimed >= 25;

  const progressColor = isUrgent
    ? colors.error
    : isModerate
      ? colors.warning
      : colors.success;

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: '#312e81', borderColor: '#4338ca' }]}
        onPress={handleClaim}
        activeOpacity={0.8}
        disabled={claiming}
      >
        <View style={styles.compactLeft}>
          <View style={styles.compactBadgeRow}>
            <Ionicons name="star" size={14} color="#fbbf24" />
            <Text style={styles.compactBadgeText}>{t('first50.badge')}</Text>
          </View>
          <Text style={styles.compactTitle}>{t('first50.compactTitle')}</Text>
          <Text style={styles.compactSubtitle}>
            {t('first50.spotsRemaining', { count: String(spots.remaining) })}
          </Text>
        </View>
        <View style={styles.compactRight}>
          {claiming ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : Platform.OS === 'ios' ? (
            <Ionicons name="open-outline" size={20} color="#fff" />
          ) : (
            <Ionicons name="arrow-forward-circle" size={24} color="#fbbf24" />
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#312e81', borderColor: '#4338ca' }]}>
      {/* Header badge */}
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons name="star" size={12} color="#fbbf24" />
          <Text style={styles.badgeText}>{t('first50.badge')}</Text>
        </View>
        <View style={styles.liveDot}>
          <View style={styles.liveDotInner} />
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>{t('plans.joinFirstFifty')}</Text>
      <Text style={styles.subtitle}>{t('first50.subtitle')}</Text>

      {/* Spots counter */}
      <View style={styles.counterSection}>
        <View style={styles.counterRow}>
          <Text style={styles.counterNumber}>{displayClaimed}</Text>
          <Text style={styles.counterSlash}>/</Text>
          <Text style={styles.counterTotal}>{spots.total}</Text>
          <Text style={styles.counterLabel}>{t('first50.spotsClaimed')}</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: progressColor, width: `${Math.min(100, progressPercent)}%` },
            ]}
          />
        </View>
        <Text style={[styles.remainingText, { color: isUrgent ? '#fca5a5' : '#c7d2fe' }]}>
          {t('first50.spotsRemaining', { count: String(spots.remaining) })}
        </Text>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsList}>
        <View style={styles.benefitRow}>
          <Ionicons name="checkmark-circle" size={16} color="#34d399" />
          <Text style={styles.benefitText}>{t('first50.benefit1')}</Text>
        </View>
        <View style={styles.benefitRow}>
          <Ionicons name="checkmark-circle" size={16} color="#34d399" />
          <Text style={styles.benefitText}>{t('first50.benefit2')}</Text>
        </View>
        <View style={styles.benefitRow}>
          <Ionicons name="checkmark-circle" size={16} color="#34d399" />
          <Text style={styles.benefitText}>{t('first50.benefit3')}</Text>
        </View>
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        style={[styles.claimButton, claiming && styles.claimButtonDisabled]}
        onPress={handleClaim}
        activeOpacity={0.8}
        disabled={claiming}
      >
        {claiming ? (
          <ActivityIndicator size="small" color="#312e81" />
        ) : (
          <>
            <Ionicons
              name={Platform.OS === 'ios' ? 'globe-outline' : 'flash'}
              size={18}
              color="#312e81"
              style={{ marginRight: Spacing.xs }}
            />
            <Text style={styles.claimButtonText}>
              {Platform.OS === 'ios' ? t('first50.claimOnWeb') : t('first50.claimNow')}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* No credit card required note */}
      <Text style={styles.noCCText}>{t('first50.noCardRequired')}</Text>

      {/* Error message */}
      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color="#fca5a5" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  badgeText: {
    color: '#fbbf24',
    fontSize: FontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  title: {
    color: '#fff',
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#c7d2fe',
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  counterSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
  },
  counterNumber: {
    color: '#fff',
    fontSize: FontSizes['2xl'],
    fontWeight: '800',
  },
  counterSlash: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: FontSizes.lg,
    marginHorizontal: 2,
  },
  counterTotal: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginRight: Spacing.sm,
  },
  counterLabel: {
    color: '#c7d2fe',
    fontSize: FontSizes.sm,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  remainingText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
  },
  benefitsList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  benefitText: {
    color: '#e0e7ff',
    fontSize: FontSizes.sm,
    flex: 1,
  },
  claimButton: {
    backgroundColor: '#fbbf24',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  claimButtonDisabled: {
    opacity: 0.7,
  },
  claimButtonText: {
    color: '#312e81',
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  noCCText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: FontSizes.xs,
    textAlign: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: FontSizes.xs,
    flex: 1,
  },

  // Compact mode
  compactContainer: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactLeft: {
    flex: 1,
  },
  compactBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  compactBadgeText: {
    color: '#fbbf24',
    fontSize: FontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  compactTitle: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  compactSubtitle: {
    color: '#c7d2fe',
    fontSize: FontSizes.xs,
  },
  compactRight: {
    marginLeft: Spacing.md,
  },
});
