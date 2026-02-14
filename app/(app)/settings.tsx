import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useNavigationBadges } from '@/hooks/useNavigationBadges';
import { useSubscription } from '@/hooks/useSubscription';
import { ENV } from '@/lib/env';
import { getPlan } from '@/lib/plans';
import { showToast } from '@/components';
import { ConfirmDialog } from '@/components';
import { createFoundingLockInSession, deleteAccount } from '@/lib/websiteApi';
import { secureLog } from '@/lib/security';

interface SettingItem {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  type: 'link' | 'toggle' | 'action' | 'custom';
  value?: boolean;
  onPress?: () => void;
  dangerous?: boolean;
  render?: () => React.ReactNode;
}

type ThemeMode = 'light' | 'dark' | 'system';

const themeModeOptions: { key: ThemeMode; label: string; icon: string }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

type LocaleOption = { key: string; label: string; flag: string };

const localeOptions: LocaleOption[] = [
  { key: 'en', label: 'English', flag: 'EN' },
  { key: 'es', label: 'Español', flag: 'ES' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const { colors, isDark, mode, setMode } = useTheme();
  const { t, locale, setLocale } = useTranslations();
  const { counts } = useNavigationBadges();
  const subscription = useSubscription();
  const { tier } = subscription;
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);

  // Profile edit modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileName, setProfileName] = useState(
    user?.user_metadata?.name || ''
  );

  // Change email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  // Change password confirm dialog state
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showDeletePasswordModal, setShowDeletePasswordModal] = useState(false);

  // Storage usage state
  const [storageInfo, setStorageInfo] = useState<{
    used_bytes: number;
    total_bytes: number;
    file_count: number;
  } | null>(null);

  const plan = useMemo(() => getPlan(tier), [tier]);

  // Fetch storage info on mount
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data } = await (supabase.rpc as any)('get_storage_info', {
          p_user_id: user.id,
        });
        if (data) {
          setStorageInfo({
            used_bytes: data.used_bytes || 0,
            total_bytes: data.total_bytes || 0,
            file_count: data.file_count || 0,
          });
        }
      } catch {
        // RPC may not exist — ignore silently
      }
    })();
  }, [user?.id]);

  const [subCheckoutLoading, setSubCheckoutLoading] = useState(false);

  const handleEnterCard = async () => {
    setSubCheckoutLoading(true);
    try {
      const url = await createFoundingLockInSession();
      await Linking.openURL(url);
    } catch (error: any) {
      secureLog.error('Lock-in error:', error.message);
      showToast('error', t('plans.checkoutError'));
    } finally {
      setSubCheckoutLoading(false);
    }
  };

  const renderSubscriptionCard = () => {
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const showFoundingBanner = subscription.isFoundingMember && subscription.isTrialing && !subscription.cardEntered;
    const showLockedIn = subscription.isFoundingMember && subscription.cardEntered;

    return (
      <View style={[settingsStyles.subCard, { borderColor: colors.border }]}>
        {/* Plan name + badges */}
        <View style={settingsStyles.subCardHeader}>
          <Text style={[settingsStyles.subPlanName, { color: colors.text }]}>
            {tierLabel}
          </Text>
          <View style={[settingsStyles.subBadge, { backgroundColor: colors.primary }]}>
            <Text style={settingsStyles.subBadgeText}>{tierLabel.toUpperCase()}</Text>
          </View>
          {subscription.isFoundingMember && (
            <View style={[settingsStyles.subBadge, { backgroundColor: colors.accent }]}>
              <Text style={settingsStyles.subBadgeText}>{t('settings.firstFifty')}</Text>
            </View>
          )}
        </View>

        {/* Trial info */}
        {subscription.isTrialing && subscription.trialEnd && (
          <View style={settingsStyles.subTrialRow}>
            <Text style={[settingsStyles.subTrialText, { color: colors.textSecondary }]}>
              {subscription.daysRemaining} {t('plans.daysRemaining')}
            </Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[settingsStyles.subTrialLabel, { color: colors.textTertiary }]}>
                {t('plans.trialEnds')}
              </Text>
              <Text style={[settingsStyles.subTrialDate, { color: colors.text }]}>
                {new Date(subscription.trialEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          </View>
        )}

        {/* Locked-in confirmation */}
        {showLockedIn && (
          <View style={[settingsStyles.subLockedIn, { backgroundColor: colors.successLight }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[settingsStyles.subLockedInText, { color: colors.success }]}>
              {t('plans.discountLockedIn')}
            </Text>
          </View>
        )}

        {/* Founding member lock-in banner */}
        {showFoundingBanner && (
          <View style={[settingsStyles.subLockIn, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            <View style={settingsStyles.subLockInContent}>
              <Text style={[settingsStyles.subLockInTitle, { color: colors.text }]}>
                {t('settings.lockInOffer')}
              </Text>
              <Text style={[settingsStyles.subLockInSubtitle, { color: colors.textSecondary }]}>
                {t('settings.lockInOfferSubtitle')}
              </Text>
            </View>
            <TouchableOpacity
              style={[settingsStyles.subEnterCardBtn, { backgroundColor: colors.primary }]}
              onPress={handleEnterCard}
              disabled={subCheckoutLoading}
            >
              {subCheckoutLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={settingsStyles.subEnterCardText}>{t('settings.enterCard')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Compare Plans button */}
        <TouchableOpacity
          style={[settingsStyles.subCompareBtn, { borderColor: colors.border }]}
          onPress={() => router.push('/(app)/plans' as any)}
        >
          <Text style={[settingsStyles.subCompareBtnText, { color: colors.text }]}>
            {t('settings.comparePlans')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const openProfileModal = () => {
    setProfileName(user?.user_metadata?.name || '');
    setShowProfileModal(true);
  };

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: profileName.trim(),
        },
      });

      if (error) throw error;

      await refreshUser();
      setShowProfileModal(false);
      showToast('success', t('settings.profileUpdated'));
    } catch (error: any) {
      showToast('error', error.message || t('settings.profileUpdateError'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleShowRequestLink = async () => {
    const requestLink = `${ENV.APP_URL}/request/${user?.id || ''}`;
    try {
      await Share.share({
        message: `Submit a request: ${requestLink}`,
        url: requestLink,
      });
    } catch {
      // Fallback if share is dismissed or fails
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) {
      showToast('error', t('settings.enterNewEmail'));
      return;
    }
    setEmailSaving(true);
    try {
      // Verify current password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: emailPassword,
      });
      if (signInError) throw new Error(t('settings.invalidPassword'));

      // Request email change
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;

      setShowEmailModal(false);
      setNewEmail('');
      setEmailPassword('');
      showToast('success', t('settings.emailUpdateSent'));
    } catch (error: any) {
      showToast('error', error.message || t('settings.emailUpdateError'));
    } finally {
      setEmailSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setShowPasswordConfirm(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        user?.email || '',
        { redirectTo: `${ENV.APP_URL}/auth/reset-password` }
      );
      if (error) throw error;
      showToast('success', t('settings.passwordResetSent'));
    } catch (error: any) {
      showToast('error', error.message || t('settings.passwordResetError'));
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      showToast('error', t('settings.enterPassword'));
      return;
    }
    setDeleting(true);
    try {
      // Verify password first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: deletePassword,
      });
      if (signInError) throw new Error(t('settings.invalidPassword'));

      // Call website API to delete all data + auth user (uses service role key)
      await deleteAccount();

      // Sign out locally after server-side deletion
      await logout();
      showToast('success', t('settings.accountDeleted'));
      router.replace('/(auth)/welcome');
    } catch (error: any) {
      showToast('error', error.message || t('settings.deleteAccountError'));
    } finally {
      setDeleting(false);
      setShowDeletePasswordModal(false);
      setDeletePassword('');
    }
  };

  const renderThemeModeSelector = () => (
    <View style={[styles.settingItem, { borderBottomColor: colors.borderLight }]}>
      <View
        style={[styles.iconContainer, { backgroundColor: colors.infoLight }]}
      >
        <Ionicons
          name="color-palette-outline"
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>Appearance</Text>
        <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
          {mode === 'system' ? 'System default' : mode === 'dark' ? 'Dark mode' : 'Light mode'}
        </Text>
      </View>
    </View>
  );

  const renderThemeModeOptions = () => (
    <View style={[styles.themeModeContainer, { borderBottomColor: colors.borderLight }]}>
      {themeModeOptions.map((option) => {
        const isActive = mode === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.themeModeOption,
              {
                backgroundColor: isActive ? colors.primary : colors.surfaceSecondary,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setMode(option.key)}
          >
            <Ionicons
              name={option.icon as any}
              size={18}
              color={isActive ? '#fff' : colors.textSecondary}
            />
            <Text
              style={[
                styles.themeModeLabel,
                { color: isActive ? '#fff' : colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderLanguageSelector = () => (
    <View style={[styles.settingItem, { borderBottomColor: colors.borderLight }]}>
      <View
        style={[styles.iconContainer, { backgroundColor: colors.infoLight }]}
      >
        <Ionicons
          name="language-outline"
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.text }]}>Language</Text>
        <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>
          {locale === 'es' ? 'Español' : 'English'}
        </Text>
      </View>
    </View>
  );

  const renderLanguageOptions = () => (
    <View style={[styles.themeModeContainer, { borderBottomColor: colors.borderLight }]}>
      {localeOptions.map((option) => {
        const isActive = locale === option.key;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.themeModeOption,
              {
                backgroundColor: isActive ? colors.primary : colors.surfaceSecondary,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setLocale(option.key)}
          >
            <Text
              style={[
                styles.languageFlag,
                { color: isActive ? '#fff' : colors.textSecondary },
              ]}
            >
              {option.flag}
            </Text>
            <Text
              style={[
                styles.themeModeLabel,
                { color: isActive ? '#fff' : colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: t('settings.account'),
      items: [
        {
          id: 'profile',
          icon: 'person-outline',
          title: t('settings.editProfile'),
          subtitle: user?.email || '',
          type: 'link',
          onPress: openProfileModal,
        },
        {
          id: 'email',
          icon: 'mail-outline',
          title: t('settings.changeEmail'),
          subtitle: t('settings.changeEmailSubtitle'),
          type: 'link',
          onPress: () => {
            setNewEmail('');
            setEmailPassword('');
            setShowEmailModal(true);
          },
        },
        {
          id: 'password',
          icon: 'lock-closed-outline',
          title: t('settings.changePassword'),
          subtitle: t('settings.changePasswordSubtitle'),
          type: 'link',
          onPress: () => setShowPasswordConfirm(true),
        },
        {
          id: 'notifications',
          icon: 'notifications-outline',
          title: t('notifications.title'),
          subtitle: counts.notifications > 0 ? `${counts.notifications} unread` : t('more.noUnread'),
          type: 'link',
          onPress: () => router.push('/(app)/notifications' as any),
        },
        {
          id: 'notification_settings',
          icon: 'options-outline',
          title: t('settings.notificationPreferences'),
          subtitle: t('settings.notificationPreferencesSubtitle'),
          type: 'link',
          onPress: () => router.push('/(app)/notification-settings' as any),
        },
        {
          id: 'subscription',
          icon: 'diamond-outline',
          title: t('settings.subscription'),
          type: 'custom',
          render: () => renderSubscriptionCard(),
        },
      ],
    },
    {
      title: t('settings.preferences'),
      items: [
        {
          id: 'appearance',
          icon: 'color-palette-outline',
          title: t('settings.appearance'),
          type: 'custom',
          render: () => (
            <>
              {renderThemeModeSelector()}
              {renderThemeModeOptions()}
            </>
          ),
        },
        {
          id: 'language',
          icon: 'language-outline',
          title: t('settings.language'),
          type: 'custom',
          render: () => (
            <>
              {renderLanguageSelector()}
              {renderLanguageOptions()}
            </>
          ),
        },
      ],
    },
    {
      title: t('settings.business'),
      items: [
        {
          id: 'business_profile',
          icon: 'briefcase-outline',
          title: t('settings.businessProfile'),
          subtitle: t('settings.businessProfileSubtitle'),
          type: 'link',
          onPress: () => router.push('/(app)/business-profile' as any),
        },
        {
          id: 'branding',
          icon: 'color-palette-outline',
          title: t('settings.branding'),
          subtitle: t('settings.brandingSubtitle'),
          type: 'link',
          onPress: () => showToast('info', t('settings.brandingComingSoon')),
        },
        {
          id: 'qr_codes',
          icon: 'qr-code-outline',
          title: t('settings.qrCodes'),
          subtitle: t('settings.qrCodesSubtitle'),
          type: 'link',
          onPress: () => router.push('/(app)/qr-settings' as any),
        },
        {
          id: 'request_link',
          icon: 'link-outline',
          title: t('settings.requestLink'),
          subtitle: t('settings.requestLinkSubtitle'),
          type: 'link',
          onPress: handleShowRequestLink,
        },
        {
          id: 'invoices_settings',
          icon: 'document-text-outline',
          title: t('settings.invoicePaymentSettings'),
          subtitle: t('settings.invoicePaymentSettingsSubtitle'),
          type: 'link',
          onPress: () => router.push('/(app)/invoice-settings' as any),
        },
        {
          id: 'stripe_payments',
          icon: 'card-outline',
          title: t('settings.stripePayments'),
          subtitle: t('settings.stripePaymentsSubtitle'),
          type: 'link',
          onPress: () => router.push('/(app)/stripe-payments' as any),
        },
        {
          id: 'booking_settings',
          icon: 'calendar-outline',
          title: t('settings.bookingSettings'),
          subtitle: t('settings.bookingSettingsSubtitle'),
          type: 'link',
          onPress: () => router.push('/(app)/booking-settings' as any),
        },
      ],
    },
    {
      title: t('settings.support'),
      items: [
        {
          id: 'help',
          icon: 'help-circle-outline',
          title: t('settings.helpCenter'),
          subtitle: t('settings.helpCenterSubtitle'),
          type: 'link',
          onPress: () => Linking.openURL(`${ENV.APP_URL}/en/help-center`),
        },
        {
          id: 'feedback',
          icon: 'chatbubble-outline',
          title: t('settings.sendFeedback'),
          subtitle: t('settings.sendFeedbackSubtitle'),
          type: 'link',
          onPress: () => Linking.openURL(`${ENV.APP_URL}/en/contact`),
        },
        {
          id: 'privacy',
          icon: 'shield-checkmark-outline',
          title: t('settings.privacyPolicy'),
          subtitle: t('settings.privacyPolicySubtitle'),
          type: 'link',
          onPress: () => router.push('/(app)/privacy-policy' as any),
        },
        {
          id: 'terms',
          icon: 'document-text-outline',
          title: t('settings.termsOfService'),
          subtitle: t('settings.termsOfServiceSubtitle'),
          type: 'link',
          onPress: () => router.push('/(app)/terms-of-service' as any),
        },
        {
          id: 'about',
          icon: 'information-circle-outline',
          title: t('settings.about'),
          subtitle: 'Version 1.0.0',
          type: 'link',
          onPress: () => Alert.alert(
            'TaskLine Mobile',
            'Version 1.0.0\n\n\u00A9 2026 Solvr Labs. All rights reserved.',
            [{ text: 'OK' }]
          ),
        },
      ],
    },
    {
      title: t('settings.dangerZone'),
      items: [
        {
          id: 'logout',
          icon: 'log-out-outline',
          title: t('settings.signOut'),
          type: 'action',
          onPress: handleLogout,
          dangerous: true,
        },
        {
          id: 'delete_account',
          icon: 'trash-outline',
          title: t('settings.deleteAccount'),
          subtitle: t('settings.deleteAccountSubtitle'),
          type: 'action',
          onPress: () => setShowDeleteConfirm(true),
          dangerous: true,
        },
      ],
    },
  ];

  const renderItem = (item: SettingItem) => {
    if (item.type === 'custom' && item.render) {
      return <View key={item.id}>{item.render()}</View>;
    }

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.settingItem, { borderBottomColor: colors.borderLight }]}
        onPress={item.type === 'toggle' ? undefined : item.onPress}
        disabled={item.type === 'toggle'}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.infoLight },
            item.dangerous && { backgroundColor: colors.errorLight },
          ]}
        >
          <Ionicons
            name={item.icon as any}
            size={20}
            color={item.dangerous ? colors.error : colors.primary}
          />
        </View>
        <View style={styles.itemContent}>
          <Text
            style={[
              styles.itemTitle,
              { color: colors.text },
              item.dangerous && { color: colors.error },
            ]}
          >
            {item.title}
          </Text>
          {item.subtitle && (
            <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.subtitle}
            </Text>
          )}
        </View>
        {item.type === 'toggle' ? (
          <Switch
            value={item.value}
            onValueChange={item.onPress}
            trackColor={{
              false: colors.border,
              true: colors.primary + '60',
            }}
            thumbColor={item.value ? colors.primary : colors.surface}
          />
        ) : item.type === 'link' ? (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  // Remove push/email notification toggles from Preferences section
  // since we now have a dedicated notification settings screen

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardDismissMode="on-drag">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        </View>

        {/* Profile Card */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={openProfileModal}
        >
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{userName}</Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {/* Storage Usage Card */}
        <View style={[styles.storageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.storageHeader}>
            <View style={[styles.iconContainer, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="cloud-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.storageHeaderText}>
              <Text style={[styles.storageTitle, { color: colors.text }]}>{t('settings.storage')}</Text>
              <Text style={[styles.storageSubtitle, { color: colors.textSecondary }]}>
                {storageInfo
                  ? `${formatBytes(storageInfo.used_bytes)} ${t('settings.storageOf')} ${plan.features.storage}`
                  : `${plan.features.storage} ${t('settings.storageAvailable')}`}
              </Text>
            </View>
          </View>
          <View style={[styles.storageBarBg, { backgroundColor: colors.surfaceSecondary }]}>
            <View
              style={[
                styles.storageBarFill,
                {
                  backgroundColor: storageInfo
                    ? getStorageBarColor(storageInfo.used_bytes, storageInfo.total_bytes, colors)
                    : colors.primary,
                  width: storageInfo && storageInfo.total_bytes > 0
                    ? `${Math.min((storageInfo.used_bytes / storageInfo.total_bytes) * 100, 100)}%`
                    : '0%',
                },
              ]}
            />
          </View>
          {storageInfo && storageInfo.file_count > 0 && (
            <Text style={[styles.storageFiles, { color: colors.textTertiary }]}>
              {storageInfo.file_count} {t('settings.storageFiles')}
            </Text>
          )}
        </View>

        {/* Settings Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{section.title}</Text>
            <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {section.items.map(renderItem)}
            </View>
          </View>
        ))}

        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.overlay }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}
      </ScrollView>

      {/* Change Password Confirm Dialog */}
      <ConfirmDialog
        visible={showPasswordConfirm}
        title={t('settings.changePassword')}
        message={t('settings.changePasswordConfirm')}
        confirmLabel={t('settings.sendResetLink')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleChangePassword}
        onCancel={() => setShowPasswordConfirm(false)}
      />

      {/* Change Email Modal */}
      <Modal
        visible={showEmailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEmailModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
              <TouchableOpacity
                onPress={() => setShowEmailModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.changeEmail')}</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <Text style={[styles.emailModalHint, { color: colors.textSecondary }]}>
                {t('settings.changeEmailHint')}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.currentEmail')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                  <Text style={[styles.inputDisabledText, { color: colors.textTertiary }]}>
                    {user?.email || ''}
                  </Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.newEmailLabel')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder={t('settings.newEmailPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.currentPassword')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={emailPassword}
                    onChangeText={setEmailPassword}
                    placeholder={t('settings.passwordPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    returnKeyType="done"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.primary },
                  emailSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleChangeEmail}
                disabled={emailSaving}
              >
                {emailSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('settings.updateEmail')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Confirm Dialog */}
      <ConfirmDialog
        visible={showDeleteConfirm}
        title={t('settings.deleteAccount')}
        message={t('settings.deleteAccountWarning')}
        confirmLabel={t('settings.deleteAccountConfirmLabel')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          setDeletePassword('');
          setShowDeletePasswordModal(true);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Delete Account Password Modal */}
      <Modal
        visible={showDeletePasswordModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDeletePasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
              <TouchableOpacity
                onPress={() => { setShowDeletePasswordModal(false); setDeletePassword(''); }}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.error }]}>{t('settings.deleteAccount')}</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={[styles.deleteWarningBox, { backgroundColor: colors.errorLight }]}>
                <Ionicons name="warning" size={24} color={colors.error} />
                <Text style={[styles.deleteWarningText, { color: colors.error }]}>
                  {t('settings.deleteAccountPermanent')}
                </Text>
              </View>

              <Text style={[styles.emailModalHint, { color: colors.textSecondary }]}>
                {t('settings.deleteAccountPasswordHint')}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('settings.currentPassword')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={deletePassword}
                    onChangeText={setDeletePassword}
                    placeholder={t('settings.passwordPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    returnKeyType="done"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.error },
                  deleting && styles.saveButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>{t('settings.deleteAccountConfirmLabel')}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
              <TouchableOpacity
                onPress={() => setShowProfileModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>

            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {/* Avatar */}
              <View style={styles.modalAvatarContainer}>
                <View style={[styles.modalAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.modalAvatarText}>
                    {(profileName || userName).charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Full Name */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Full Name</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={colors.textTertiary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={profileName}
                    onChangeText={setProfileName}
                    placeholder="Enter your full name"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Email (read-only display) */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color={colors.textTertiary}
                    style={styles.inputIcon}
                  />
                  <Text style={[styles.inputDisabledText, { color: colors.textTertiary }]}>
                    {user?.email || ''}
                  </Text>
                </View>
                <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
                  Use "Change Email" in Account settings to update your email.
                </Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.primary },
                  profileSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getStorageBarColor(used: number, total: number, colors: any): string {
  if (total <= 0) return colors.primary;
  const percent = (used / total) * 100;
  if (percent > 90) return colors.error;
  if (percent > 70) return colors.warning;
  return colors.success;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['4xl'],
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: FontSizes.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  sectionContent: {
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: FontSizes.sm,
  },
  // Theme mode selector styles
  themeModeContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  themeModeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  themeModeLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  languageFlag: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Profile Edit Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  modalHeaderSpacer: {
    width: 40,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  modalAvatarContainer: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    marginTop: Spacing.md,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalAvatarText: {
    fontSize: FontSizes['3xl'],
    fontWeight: 'bold',
    color: '#fff',
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
  },
  inputDisabledText: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
  },
  inputHint: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  saveButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    minHeight: 52,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
  // Storage card styles
  storageCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  storageHeaderText: {
    flex: 1,
  },
  storageTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  storageSubtitle: {
    fontSize: FontSizes.sm,
  },
  storageBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  storageBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  storageFiles: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.sm,
  },
  // Delete account styles
  deleteWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  deleteWarningText: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  // Email modal styles
  emailModalHint: {
    fontSize: FontSizes.sm,
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
});

// Subscription card styles (separate to keep main styles cleaner)
const settingsStyles = StyleSheet.create({
  subCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  subPlanName: {
    fontSize: FontSizes.xl,
    fontWeight: '800',
  },
  subBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  subBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  subTrialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  subTrialText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  subTrialLabel: {
    fontSize: FontSizes.xs,
  },
  subTrialDate: {
    fontSize: FontSizes.md,
    fontWeight: '700',
  },
  subLockedIn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  subLockedInText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  subLockIn: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  subLockInContent: {
    flex: 1,
  },
  subLockInTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  subLockInSubtitle: {
    fontSize: FontSizes.xs,
    lineHeight: 16,
  },
  subEnterCardBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    minHeight: 36,
    justifyContent: 'center',
  },
  subEnterCardText: {
    color: '#fff',
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  subCompareBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  subCompareBtnText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
});
