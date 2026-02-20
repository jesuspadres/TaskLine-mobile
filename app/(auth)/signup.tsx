import { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signUp, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { PLANS, type PlanData, type BillingPeriod } from '@/lib/plans';
import { createCheckoutSession, syncSubscription } from '@/lib/websiteApi';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { showToast, DatePicker } from '@/components';
import { useHaptics } from '@/hooks/useHaptics';
import { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
import { secureLog } from '@/lib/security';
import type { User, Session } from '@supabase/supabase-js';

const TOTAL_STEPS = 7; // 0-6

// Password validation
function validatePassword(password: string) {
  const checks = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  return { checks, score, isValid: score === 4 };
}

export default function SignupScreen() {
  const [step, setStep] = useState(0);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Email error state (set by step 4 signup failure)
  const [emailError, setEmailError] = useState('');

  // Session data (stored locally, not in auth store yet)
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [pendingSession, setPendingSession] = useState<Session | null>(null);

  // Plans state
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [stripeSessionId, setStripeSessionId] = useState<string | null>(null);

  const { colors } = useTheme();
  const { t } = useTranslations();
  const router = useRouter();
  const { impact, notification } = useHaptics();
  const scrollRef = useRef<ScrollView>(null);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  const businessTypeOptions = useMemo(() => [
    { value: 'freelancer', label: t('auth.businessTypeFreelancer') },
    { value: 'sole_proprietor', label: t('auth.businessTypeSoleProprietor') },
    { value: 'llc', label: t('auth.businessTypeLLC') },
    { value: 'corporation', label: t('auth.businessTypeCorporation') },
    { value: 'partnership', label: t('auth.businessTypePartnership') },
    { value: 'nonprofit', label: t('auth.businessTypeNonprofit') },
    { value: 'other', label: t('auth.businessTypeOther') },
  ], [t]);

  const strengthColor = useMemo(() => {
    const colorMap = ['#ef4444', '#ef4444', '#f59e0b', '#22c55e', '#16a34a'];
    return colorMap[passwordValidation.score];
  }, [passwordValidation.score]);

  const strengthLabel = useMemo(() => {
    if (password.length === 0) return '';
    const labels = [t('auth.strengthWeak'), t('auth.strengthWeak'), t('auth.strengthFair'), t('auth.strengthGood'), t('auth.strengthStrong')];
    return labels[passwordValidation.score];
  }, [password, passwordValidation.score, t]);

  // Navigation
  const goNext = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [impact]);

  const goBack = useCallback(() => {
    if (step === 0) {
      // Re-enable auth listener when leaving signup
      useAuthStore.getState().setSuppressAuthChange(false);
      router.back();
    } else {
      setStep((s) => s - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [step, router]);

  // Handle email continue
  const handleEmailContinue = () => {
    if (!email.trim()) return;
    setEmailError('');
    goNext();
  };

  // Create account
  const handleCreateAccount = async () => {
    if (!agreedToTerms) {
      showToast('error', t('auth.mustAgreeToTerms'));
      return;
    }

    setLoading(true);
    impact(ImpactFeedbackStyle.Light);

    // Suppress auth listener so root layout doesn't redirect before plans step
    useAuthStore.getState().setSuppressAuthChange(true);

    const { data, error } = await signUp(email, password, name);

    if (error) {
      setLoading(false);
      // Re-enable auth listener on failure
      useAuthStore.getState().setSuppressAuthChange(false);
      // If email already registered, go back to email step
      if (error.message?.toLowerCase().includes('already registered') || error.message?.toLowerCase().includes('already been registered')) {
        setStep(1);
        setEmailError(t('auth.emailAlreadyUsed'));
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
      showToast('error', error.message);
      return;
    }

    // Save profile info (name + optional business info)
    try {
      const userId = data.user?.id;
      if (userId) {
        await (supabase.from('profiles') as any).upsert({
          id: userId,
          full_name: name.trim() || null,
          email: email.trim(),
          date_of_birth: dateOfBirth ? dateOfBirth.toISOString().split('T')[0] : null,
          business_name: businessName.trim() || null,
          business_type: businessType || null,
          phone_number: phoneNumber.trim() || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      }
    } catch (err) {
      secureLog.error('Failed to save profile info', err);
    }

    // Store session data locally (don't update auth store yet)
    setPendingUser(data.user ?? null);
    setPendingSession(data.session ?? null);
    setLoading(false);
    notification(NotificationFeedbackType.Success);
    goNext();
  };

  // Finish onboarding — set auth store to trigger redirect
  const finishOnboarding = useCallback(async () => {
    // If the user completed a Stripe checkout, sync the subscription first.
    // This ensures the subscription record exists in the DB even if the
    // Stripe webhook hasn't processed yet.
    if (checkoutComplete && stripeSessionId) {
      try {
        await syncSubscription(stripeSessionId);
      } catch (err) {
        secureLog.error('Subscription sync failed (will retry on dashboard)', err);
      }
    }

    // Re-enable auth listener
    useAuthStore.getState().setSuppressAuthChange(false);

    if (pendingUser && pendingSession) {
      useAuthStore.setState({
        user: pendingUser,
        session: pendingSession,
        loading: false,
      });
      // Root layout auth guard will redirect to dashboard
    } else {
      // Email verification required — go to login
      router.replace('/(auth)/login');
    }
  }, [pendingUser, pendingSession, router, checkoutComplete, stripeSessionId]);

  // Handle plan selection
  const handleSelectPlan = async (plan: PlanData) => {
    if (plan.slug === 'free') {
      finishOnboarding();
      return;
    }

    if (plan.comingSoon) {
      showToast('info', t('plans.comingSoon'));
      return;
    }

    if (!pendingSession) {
      showToast('info', t('auth.checkEmailThenSignIn'));
      return;
    }

    setCheckoutLoading(true);
    try {
      const interval = billingPeriod === 'annual' ? 'year' : 'month';
      const { url, sessionId } = await createCheckoutSession(plan.slug, interval);
      setStripeSessionId(sessionId);
      await WebBrowser.openBrowserAsync(url);
      // Don't redirect — user stays on plans screen until they explicitly continue
      setCheckoutComplete(true);
    } catch (err: any) {
      showToast('error', err.message || t('auth.checkoutFailed'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  // ──────────────────────────────────────────────
  // STEP RENDERERS
  // ──────────────────────────────────────────────

  const renderStepHeader = (title: string, showSkip?: boolean) => (
    <View style={styles.stepHeader}>
      <TouchableOpacity onPress={goBack} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <View style={{ width: 40 }} />
      {showSkip ? (
        <TouchableOpacity onPress={goNext} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.skipText, { color: colors.primary }]}>{t('auth.skip')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );

  // Step 0: Name (centered)
  const renderNameStep = () => (
    <View style={styles.stepContent}>
      {renderStepHeader(t('auth.whatsYourName'))}

      <View style={[styles.stepBody, styles.centeredBody]}>
        <Image source={require('@/assets/icon.png')} style={styles.stepLogo} />

        <Text style={[styles.stepTitle, styles.centeredTitle, { color: colors.text }]}>{t('auth.whatsYourName')}</Text>
        <TextInput
          style={[styles.input, styles.centeredInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlign: 'center' }]}
          placeholder={t('auth.fullNamePlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => name.trim() && goNext()}
        />
      </View>
      <TouchableOpacity
        style={[styles.continueBtn, { backgroundColor: colors.primary }, !name.trim() && styles.btnDisabled]}
        onPress={goNext}
        disabled={!name.trim()}
      >
        <Text style={styles.continueBtnText}>{t('auth.continue')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Age check — must be at least 13
  const isUnder13 = useMemo(() => {
    if (!dateOfBirth) return false;
    const today = new Date();
    const age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    const dayDiff = today.getDate() - dateOfBirth.getDate();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
    return actualAge < 13;
  }, [dateOfBirth]);

  // Step 1: Date of Birth (centered)
  const renderDobStep = () => (
    <View style={styles.stepContent}>
      {renderStepHeader(t('auth.dateOfBirth'))}

      <View style={[styles.stepBody, styles.centeredBody]}>
        <Text style={[styles.stepTitle, styles.centeredTitle, { color: colors.text }]}>{t('auth.dateOfBirth')}</Text>
        <View style={{ width: '100%', maxWidth: 340 }}>
          <DatePicker
            value={dateOfBirth}
            onChange={setDateOfBirth}
            placeholder={t('auth.dateOfBirthPlaceholder')}
            maxDate={new Date()}
          />
        </View>
        {isUnder13 && (
          <Text style={[styles.ageRestrictionText, { color: colors.error }]}>
            {t('auth.ageRestriction')}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.continueBtn, { backgroundColor: colors.primary }, (!dateOfBirth || isUnder13) && styles.btnDisabled]}
        onPress={goNext}
        disabled={!dateOfBirth || isUnder13}
      >
        <Text style={styles.continueBtnText}>{t('auth.continue')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 2: Email (centered, with availability check)
  const renderEmailStep = () => (
    <View style={styles.stepContent}>
      {renderStepHeader(t('auth.whatsYourEmail'))}

      <View style={[styles.stepBody, styles.centeredBody]}>
        <Text style={[styles.stepTitle, styles.centeredTitle, { color: colors.text }]}>{t('auth.whatsYourEmail')}</Text>
        <TextInput
          style={[
            styles.input,
            styles.centeredInput,
            {
              backgroundColor: colors.surface,
              borderColor: emailError ? '#ef4444' : colors.border,
              color: colors.text,
              textAlign: 'center',
            },
          ]}
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (emailError) setEmailError('');
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => email.trim() && handleEmailContinue()}
        />
        {emailError ? (
          <Text style={[styles.emailErrorText, { color: '#ef4444' }]}>{emailError}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.continueBtn, { backgroundColor: colors.primary }, !email.trim() && styles.btnDisabled]}
        onPress={handleEmailContinue}
        disabled={!email.trim()}
      >
        <Text style={styles.continueBtnText}>{t('auth.continue')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 2: Password
  const canContinuePassword = passwordValidation.isValid && password === confirmPassword && confirmPassword.length > 0;

  const renderPasswordStep = () => (
    <View style={styles.stepContent}>
      {renderStepHeader(t('auth.createPassword'))}

      <View style={styles.stepBody}>
        <Text style={[styles.stepTitle, styles.centeredTitle, { color: colors.text }]}>{t('auth.createPassword')}</Text>

        {/* Password */}
        <Text style={[styles.label, { color: colors.text }]}>{t('auth.password')}</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.input, styles.passwordInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder={t('auth.passwordMinChars')}
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Strength indicator */}
        {password.length > 0 && (
          <View style={styles.strengthSection}>
            <View style={styles.strengthBarRow}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[styles.strengthSeg, { backgroundColor: i < passwordValidation.score ? strengthColor : colors.border }]}
                />
              ))}
            </View>
            <Text style={[styles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
            <View style={styles.reqList}>
              {([
                ['minLength', t('auth.reqMinLength')],
                ['uppercase', t('auth.reqUppercase')],
                ['lowercase', t('auth.reqLowercase')],
                ['number', t('auth.reqNumber')],
              ] as const).map(([key, label]) => (
                <View key={key} style={styles.reqRow}>
                  <Ionicons
                    name={passwordValidation.checks[key] ? 'checkmark-circle' : 'close-circle'}
                    size={14}
                    color={passwordValidation.checks[key] ? '#22c55e' : colors.textTertiary}
                  />
                  <Text style={[styles.reqText, { color: passwordValidation.checks[key] ? '#22c55e' : colors.textTertiary }]}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Confirm Password */}
        <Text style={[styles.label, { color: colors.text, marginTop: Spacing.lg }]}>{t('auth.confirmPassword')}</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[
              styles.input, styles.passwordInput,
              { backgroundColor: colors.surface, borderColor: !passwordsMatch ? '#ef4444' : colors.border, color: colors.text },
            ]}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoComplete="new-password"
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        {!passwordsMatch && (
          <Text style={[styles.errorText, { color: '#ef4444' }]}>{t('auth.passwordsNoMatch')}</Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.continueBtn, { backgroundColor: colors.primary }, !canContinuePassword && styles.btnDisabled]}
        onPress={goNext}
        disabled={!canContinuePassword}
      >
        <Text style={styles.continueBtnText}>{t('auth.continue')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 3: Business Info (optional)
  const renderBusinessStep = () => (
    <View style={styles.stepContent}>
      {renderStepHeader(t('auth.tellUsAboutBusiness'), true)}

      <View style={styles.stepBody}>
        <Text style={[styles.stepTitle, styles.centeredTitle, { color: colors.text }]}>{t('auth.tellUsAboutBusiness')}</Text>
        <Text style={[styles.stepSubtitle, styles.centeredTitle, { color: colors.textTertiary }]}>{t('auth.businessInfoOptional')}</Text>

        <Text style={[styles.label, { color: colors.text }]}>{t('auth.businessName')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder={t('auth.businessNamePlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={businessName}
          onChangeText={setBusinessName}
          autoCapitalize="words"
        />

        <Text style={[styles.label, { color: colors.text, marginTop: Spacing.lg }]}>{t('auth.businessType')}</Text>
        <View style={styles.chipGrid}>
          {businessTypeOptions.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.chip,
                { borderColor: businessType === opt.value ? colors.primary : colors.border },
                businessType === opt.value && { backgroundColor: colors.primary + '15' },
              ]}
              onPress={() => setBusinessType(businessType === opt.value ? '' : opt.value)}
            >
              <Text style={[styles.chipText, { color: businessType === opt.value ? colors.primary : colors.textSecondary }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.text, marginTop: Spacing.lg }]}>{t('auth.phoneNumber')}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder={t('auth.phoneNumberPlaceholder')}
          placeholderTextColor={colors.textTertiary}
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          autoComplete="tel"
        />
      </View>
      <TouchableOpacity
        style={[styles.continueBtn, { backgroundColor: colors.primary }]}
        onPress={goNext}
      >
        <Text style={styles.continueBtnText}>{t('auth.continue')}</Text>
      </TouchableOpacity>
    </View>
  );

  // Step 4: Terms + Create Account (centered)
  const renderTermsStep = () => (
    <View style={styles.stepContent}>
      {renderStepHeader(t('auth.almostDone'))}

      <View style={[styles.stepBody, styles.centeredBody]}>
        <Text style={[styles.stepTitle, styles.centeredTitle, { color: colors.text }]}>{t('auth.almostDone')}</Text>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.summaryText, { color: colors.text }]}>{name}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.summaryText, { color: colors.text }]}>{email}</Text>
          </View>
          {dateOfBirth && (
            <View style={styles.summaryRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {dateOfBirth.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          )}
          {businessName ? (
            <View style={styles.summaryRow}>
              <Ionicons name="briefcase-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.summaryText, { color: colors.text }]}>{businessName}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAgreedToTerms(!agreedToTerms)}
          activeOpacity={0.7}
        >
          <View style={[
            styles.checkbox,
            { borderColor: agreedToTerms ? colors.primary : colors.border },
            agreedToTerms && { backgroundColor: colors.primary },
          ]}>
            {agreedToTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
          <Text style={[styles.termsText, { color: colors.textSecondary }]}>
            {t('auth.agreePrefix')}{' '}
            <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => router.push('/(auth)/terms-of-service' as any)}>
              {t('legal.termsOfService')}
            </Text>
            {' '}{t('auth.and')}{' '}
            <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => router.push('/(auth)/privacy-policy' as any)}>
              {t('legal.privacyPolicy')}
            </Text>
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.continueBtn, { backgroundColor: colors.primary }, (!agreedToTerms || loading) && styles.btnDisabled]}
        onPress={handleCreateAccount}
        disabled={!agreedToTerms || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.continueBtnText}>{t('auth.createAccount')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // Step 5: Plans
  const resolveFeatureValue = useCallback((value: boolean | string) => {
    if (typeof value !== 'string') return value;
    if (value.includes('.')) return t(`plans.${value}`);
    return value;
  }, [t]);

  const topFeatureKeys = ['clients', 'projects', 'tasks', 'storage', 'scheduler'] as const;
  const allFeatureKeys = ['clients', 'projects', 'tasks', 'storage', 'sms', 'support', 'scheduler', 'payments', 'productCatalog', 'branding', 'clientPortal', 'invoices'] as const;

  const featureLabels = useMemo(() => ({
    clients: t('plans.clients'),
    projects: t('plans.projects'),
    tasks: t('plans.tasks'),
    storage: t('plans.storage'),
    sms: t('plans.sms'),
    support: t('plans.support'),
    scheduler: t('plans.scheduler'),
    payments: t('plans.payments'),
    productCatalog: t('plans.productCatalog'),
    branding: t('plans.branding'),
    clientPortal: t('plans.clientPortal'),
    invoices: t('plans.invoiceCreation'),
  }), [t]) as Record<string, string>;

  const renderFeatureRow = (key: string, value: boolean | string) => {
    const resolved = resolveFeatureValue(value);
    const label = featureLabels[key] || key;
    return (
      <View key={key} style={styles.featureRow}>
        <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>{label}</Text>
        {typeof resolved === 'boolean' ? (
          <Ionicons name={resolved ? 'checkmark-circle' : 'close-circle'} size={16} color={resolved ? '#22c55e' : colors.textTertiary} />
        ) : (
          <Text style={[styles.featureValue, { color: colors.text }]}>{resolved}</Text>
        )}
      </View>
    );
  };

  const annualSavePercent = 20;

  const renderPlansStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.stepHeader}>
        <View style={{ width: 40 }} />
        <View style={{ width: 40 }} />
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.stepBody}>
        <Text style={[styles.stepTitle, styles.centeredTitle, { color: colors.text }]}>{t('auth.choosePlan')}</Text>

        {!pendingSession && (
          <View style={[styles.emailBanner, { backgroundColor: colors.infoLight }]}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
            <Text style={[styles.emailBannerText, { color: colors.primary }]}>{t('auth.checkEmailThenSignIn')}</Text>
          </View>
        )}

        {/* Billing toggle */}
        <View style={[styles.billingToggle, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.billingBtn, billingPeriod === 'monthly' && { backgroundColor: colors.primary }]}
            onPress={() => setBillingPeriod('monthly')}
          >
            <Text style={[styles.billingBtnText, { color: billingPeriod === 'monthly' ? '#fff' : colors.textSecondary }]}>
              {t('auth.monthly')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.billingBtn, billingPeriod === 'annual' && { backgroundColor: colors.primary }]}
            onPress={() => setBillingPeriod('annual')}
          >
            <Text style={[styles.billingBtnText, { color: billingPeriod === 'annual' ? '#fff' : colors.textSecondary }]}>
              {t('auth.annual')}
            </Text>
            {billingPeriod === 'annual' && (
              <View style={styles.saveBadge}>
                <Text style={styles.saveBadgeText}>{t('auth.save', { percent: annualSavePercent })}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Checkout complete banner */}
        {checkoutComplete && (
          <View style={[styles.checkoutBanner, { backgroundColor: '#059669' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.checkoutBannerText}>{t('auth.paymentComplete')}</Text>
            <TouchableOpacity
              style={styles.checkoutBannerBtn}
              onPress={finishOnboarding}
            >
              <Text style={styles.checkoutBannerBtnText}>{t('auth.continueToDashboard')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Plan cards */}
        {PLANS.map((plan) => {
          const price = billingPeriod === 'annual' ? plan.price.annual : plan.price.monthly;
          const isExpanded = expandedPlan === plan.slug;
          const isFree = plan.slug === 'free';
          const isPlus = plan.slug === 'plus';

          // Button label per plan
          const buttonLabel = plan.comingSoon
            ? t('plans.comingSoon')
            : isFree
              ? t('auth.getStartedFree')
              : isPlus
                ? t('auth.joinFirstFifty')
                : t('auth.startFreeTrial');

          // Button colors: free = outlined, plus = emerald, others = primary filled
          const btnBg = isFree
            ? 'transparent'
            : isPlus
              ? '#059669'
              : colors.primary;
          const btnBorder = isFree
            ? colors.primary
            : isPlus
              ? '#059669'
              : colors.primary;
          const btnTextColor = isFree ? colors.primary : '#fff';

          return (
            <View
              key={plan.slug}
              style={[
                styles.planCard,
                { backgroundColor: colors.surface, borderColor: plan.popular ? colors.primary : colors.border },
                plan.popular && { borderWidth: 2 },
              ]}
            >
              {/* Top badges */}
              {isFree && (
                <View style={[styles.topBadge, { backgroundColor: '#059669' }]}>
                  <Text style={styles.topBadgeText}>{t('auth.freeForever')}</Text>
                </View>
              )}
              {isPlus && (
                <View style={[styles.topBadge, { backgroundColor: '#059669' }]}>
                  <Text style={styles.topBadgeText}>{t('auth.threeMonthsFree')}</Text>
                </View>
              )}
              {plan.comingSoon && (
                <View style={[styles.topBadge, { backgroundColor: '#6b7280' }]}>
                  <Text style={styles.topBadgeText}>{t('plans.comingSoon')}</Text>
                </View>
              )}

              {/* Plan name + description */}
              <View style={styles.planHeader}>
                <Text style={[styles.planName, { color: colors.text }]}>{t(`plans.${plan.nameKey}`)}</Text>
                <Text style={[styles.planDescription, { color: colors.textSecondary }]}>
                  {t(`plans.${plan.descriptionKey}`)}
                </Text>
              </View>

              {/* Pricing section */}
              <View style={styles.pricingSection}>
                {isFree ? (
                  <>
                    <Text style={[styles.priceAmount, { color: colors.text }]}>{t('plans.free')}</Text>
                    <Text style={[styles.noCreditCard, { color: colors.textTertiary }]}>{t('auth.noCreditCard')}</Text>
                  </>
                ) : isPlus ? (
                  <>
                    <View style={styles.priceRow}>
                      <Text style={[styles.priceStrikethrough, { color: colors.textTertiary }]}>
                        ${plan.price.monthly}
                      </Text>
                      <Text style={[styles.pricePeriod, { color: colors.textTertiary }]}>/mo</Text>
                    </View>
                    <View style={styles.promoBanner}>
                      <Text style={styles.promoBannerTitle}>{t('auth.promoFreeBanner')}</Text>
                      <Text style={styles.promoBannerSubtitle}>{t('auth.promoThenPrice')}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.priceRow}>
                      <Text style={[styles.priceAmount, { color: colors.text }]}>${price}</Text>
                      <Text style={[styles.pricePeriod, { color: colors.textTertiary }]}>{t('auth.perMonth')}</Text>
                    </View>
                    {billingPeriod === 'annual' && (
                      <Text style={[styles.billedAnnually, { color: '#059669' }]}>
                        {t('auth.billedAnnually', { amount: plan.price.annual * 12 })}
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* Action button (above features, matching website) */}
              <TouchableOpacity
                style={[
                  styles.planActionBtn,
                  { backgroundColor: btnBg, borderColor: btnBorder, borderWidth: isFree ? 1.5 : 0 },
                  (checkoutLoading || plan.comingSoon) && styles.btnDisabled,
                ]}
                onPress={() => handleSelectPlan(plan)}
                disabled={checkoutLoading || plan.comingSoon}
              >
                {checkoutLoading ? (
                  <ActivityIndicator color={btnTextColor} size="small" />
                ) : (
                  <Text style={[styles.planActionText, { color: btnTextColor }]}>
                    {buttonLabel}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Top features always visible */}
              <View style={[styles.featuresList, { marginTop: Spacing.md }]}>
                {topFeatureKeys.map((key) =>
                  renderFeatureRow(key, plan.features[key as keyof typeof plan.features])
                )}
              </View>

              {/* Expanded features */}
              {isExpanded && (
                <View style={[styles.featuresList, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.sm, marginTop: Spacing.sm }]}>
                  {allFeatureKeys
                    .filter((k) => !topFeatureKeys.includes(k as any))
                    .map((key) => renderFeatureRow(key, plan.features[key as keyof typeof plan.features]))}
                </View>
              )}

              {/* Show more/less */}
              <TouchableOpacity
                style={styles.showMoreBtn}
                onPress={() => setExpandedPlan(isExpanded ? null : plan.slug)}
              >
                <Text style={[styles.showMoreText, { color: colors.primary }]}>
                  {isExpanded ? t('auth.showLess') : t('auth.showMore')}
                </Text>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  const steps = [renderNameStep, renderDobStep, renderEmailStep, renderPasswordStep, renderBusinessStep, renderTermsStep, renderPlansStep];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {steps[step]()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Spacing['2xl'] },

  // Step layout
  stepContent: { flex: 1 },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backBtn: { width: 40 },
  skipText: { fontSize: FontSizes.sm, fontWeight: '600' },
  stepBody: { flex: 1, marginBottom: Spacing.xl },
  centeredBody: { justifyContent: 'center', alignItems: 'center' },
  stepLogo: { width: 56, height: 56, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl },
  stepTitle: { fontSize: FontSizes['2xl'], fontWeight: 'bold', marginBottom: Spacing.sm },
  centeredTitle: { textAlign: 'center' },
  stepSubtitle: { fontSize: FontSizes.sm, marginBottom: Spacing.xl },
  ageRestrictionText: { fontSize: FontSizes.sm, fontWeight: '500', textAlign: 'center', marginTop: Spacing.md },

  // Inputs
  label: { fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.sm, alignSelf: 'stretch' },
  input: { borderWidth: 1, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSizes.md, alignSelf: 'stretch' },
  centeredInput: { maxWidth: 340, width: '100%' },
  passwordContainer: { position: 'relative', alignSelf: 'stretch' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: 'absolute', right: Spacing.md, top: 0, bottom: 0, justifyContent: 'center' },
  errorText: { fontSize: FontSizes.xs, marginTop: Spacing.xs },
  emailErrorText: { fontSize: FontSizes.xs, marginTop: Spacing.sm, textAlign: 'center' },

  // Password strength
  strengthSection: { marginTop: Spacing.sm, alignSelf: 'stretch' },
  strengthBarRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  strengthSeg: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: FontSizes.xs, fontWeight: '600', marginBottom: Spacing.xs },
  reqList: { gap: 2 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reqText: { fontSize: FontSizes.xs },

  // Business info chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignSelf: 'stretch' },
  chip: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  chipText: { fontSize: FontSizes.xs, fontWeight: '500' },

  // Terms
  summaryCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.xl, gap: Spacing.sm, alignSelf: 'stretch', maxWidth: 380, width: '100%' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryText: { fontSize: FontSizes.sm },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.lg, maxWidth: 380, width: '100%' },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  termsText: { flex: 1, fontSize: FontSizes.xs, lineHeight: 18 },
  termsLink: { fontWeight: '600', textDecorationLine: 'underline' },

  // Continue button
  continueBtn: { paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  continueBtnText: { color: '#fff', fontSize: FontSizes.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  // Plans step
  emailBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  emailBannerText: { flex: 1, fontSize: FontSizes.sm, fontWeight: '500' },
  billingToggle: { flexDirection: 'row', borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.xl },
  billingBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  billingBtnText: { fontSize: FontSizes.sm, fontWeight: '600' },
  saveBadge: { backgroundColor: '#22c55e', borderRadius: BorderRadius.full, paddingHorizontal: 6, paddingVertical: 1 },
  saveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  checkoutBanner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  checkoutBannerText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: '600', flex: 1 },
  checkoutBannerBtn: { backgroundColor: '#fff', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md },
  checkoutBannerBtnText: { color: '#059669', fontSize: FontSizes.xs, fontWeight: '700' },
  planCard: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, overflow: 'hidden' },
  topBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.full, marginBottom: Spacing.sm },
  topBadgeText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: '700' },
  planHeader: { marginBottom: Spacing.sm },
  planName: { fontSize: FontSizes.lg, fontWeight: 'bold' },
  planDescription: { fontSize: FontSizes.sm, marginTop: 2 },
  pricingSection: { marginBottom: Spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  priceAmount: { fontSize: FontSizes['2xl'], fontWeight: 'bold' },
  priceStrikethrough: { fontSize: FontSizes['2xl'], fontWeight: 'bold', textDecorationLine: 'line-through' },
  pricePeriod: { fontSize: FontSizes.sm },
  noCreditCard: { fontSize: FontSizes.xs, marginTop: 2 },
  billedAnnually: { fontSize: FontSizes.xs, fontWeight: '500', marginTop: 2 },
  promoBanner: { backgroundColor: '#059669', borderRadius: BorderRadius.lg, padding: Spacing.md, marginTop: Spacing.sm },
  promoBannerTitle: { color: '#fff', fontSize: FontSizes.lg, fontWeight: 'bold', textAlign: 'center' },
  promoBannerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: FontSizes.xs, textAlign: 'center', marginTop: 2 },
  featuresList: { gap: Spacing.xs },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  featureLabel: { fontSize: FontSizes.sm },
  featureValue: { fontSize: FontSizes.sm, fontWeight: '600' },
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm },
  showMoreText: { fontSize: FontSizes.xs, fontWeight: '600' },
  planActionBtn: { paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  planActionText: { fontSize: FontSizes.sm, fontWeight: '600' },

});
