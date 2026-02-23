import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { showToast } from '@/components';
import { ENV } from '@/lib/env';
import * as Clipboard from 'expo-clipboard';

// ── Types ──────────────────────────────────────────────────────────────

interface SchedulingSettings {
  timezone: string;
  slot_duration: number;
  buffer_before: number;
  buffer_after: number;
  min_notice_hours: number;
  max_advance_days: number;
  enabled: boolean;
  require_approval: boolean;
  send_email_confirmation: boolean;
  send_sms_confirmation: boolean;
  allow_client_edits: boolean;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  reminder_email_enabled: boolean;
  reminder_sms_enabled: boolean;
  reminder_message: string;
  booking_location: string;
  show_booking_location: boolean;
}

interface AvailabilityRule {
  day_of_week: number; // 0=Sunday … 6=Saturday (matches website)
  is_active: boolean;
  start_time: string; // "HH:mm"
  end_time: string;   // "HH:mm"
}

interface TimeOffBlock {
  id?: string;
  user_id?: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  block_type?: string;
  created_at?: string;
}

interface ServiceItem {
  id?: string;
  user_id?: string;
  name: string;
  description: string;
  price: number;
  price_type: 'fixed' | 'starting_at' | 'range' | 'quote';
  duration: number;
  is_active: boolean;
  created_at?: string;
}

// ── Constants ──────────────────────────────────────────────────────────

// 0=Sunday … 6=Saturday (matches website DB convention)
const DAY_KEYS = ['bookingSettings.sunday', 'bookingSettings.monday', 'bookingSettings.tuesday', 'bookingSettings.wednesday', 'bookingSettings.thursday', 'bookingSettings.friday', 'bookingSettings.saturday'];

const TIMEZONES = [
  { key: 'America/New_York', label: 'Eastern (New York)' },
  { key: 'America/Chicago', label: 'Central (Chicago)' },
  { key: 'America/Denver', label: 'Mountain (Denver)' },
  { key: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { key: 'America/Phoenix', label: 'Arizona (Phoenix)' },
  { key: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { key: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
  { key: 'America/Mexico_City', label: 'Mexico City' },
  { key: 'UTC', label: 'UTC' },
];

const SLOT_DURATIONS = [15, 30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 60];
const MIN_NOTICE_OPTIONS = [
  { key: 1, i18nLabel: '1', i18nUnit: 'bookingSettings.hours' },
  { key: 2, i18nLabel: '2', i18nUnit: 'bookingSettings.hours' },
  { key: 4, i18nLabel: '4', i18nUnit: 'bookingSettings.hours' },
  { key: 12, i18nLabel: '12', i18nUnit: 'bookingSettings.hours' },
  { key: 24, i18nLabel: '24', i18nUnit: 'bookingSettings.hours' },
  { key: 48, i18nLabel: '48', i18nUnit: 'bookingSettings.hours' },
  { key: 72, i18nLabel: '72', i18nUnit: 'bookingSettings.hours' },
];
const MAX_ADVANCE_OPTIONS = [
  { key: 7, i18nLabel: '7', i18nUnit: 'bookingSettings.days' },
  { key: 14, i18nLabel: '14', i18nUnit: 'bookingSettings.days' },
  { key: 30, i18nLabel: '30', i18nUnit: 'bookingSettings.days' },
  { key: 60, i18nLabel: '60', i18nUnit: 'bookingSettings.days' },
  { key: 90, i18nLabel: '90', i18nUnit: 'bookingSettings.days' },
];

const PRICE_TYPES = [
  { key: 'fixed', i18nKey: 'bookingSettings.fixed' },
  { key: 'starting_at', i18nKey: 'bookingSettings.hourly' },
  { key: 'quote', i18nKey: 'bookingSettings.custom' },
];

const REMINDER_HOURS_OPTIONS = [
  { key: 2, i18nLabel: '2', i18nUnit: 'bookingSettings.hours' },
  { key: 4, i18nLabel: '4', i18nUnit: 'bookingSettings.hours' },
  { key: 6, i18nLabel: '6', i18nUnit: 'bookingSettings.hours' },
  { key: 12, i18nLabel: '12', i18nUnit: 'bookingSettings.hours' },
  { key: 24, i18nLabel: '24', i18nUnit: 'bookingSettings.hours' },
  { key: 48, i18nLabel: '48', i18nUnit: 'bookingSettings.hours' },
  { key: 72, i18nLabel: '72', i18nUnit: 'bookingSettings.hours' },
];

const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 22; h++) {
  TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
  if (h < 22) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
  }
}

function formatTime24to12(time: string): string {
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

const DEFAULT_SETTINGS: SchedulingSettings = {
  timezone: 'America/Mexico_City',
  slot_duration: 30,
  buffer_before: 15,
  buffer_after: 0,
  min_notice_hours: 24,
  max_advance_days: 30,
  enabled: false,
  require_approval: true,
  send_email_confirmation: true,
  send_sms_confirmation: false,
  allow_client_edits: false,
  reminder_enabled: false,
  reminder_hours_before: 24,
  reminder_email_enabled: true,
  reminder_sms_enabled: false,
  reminder_message: '',
  booking_location: '',
  show_booking_location: true,
};

function getDefaultAvailability(): AvailabilityRule[] {
  // 0=Sunday … 6=Saturday; Mon-Fri (1-5) are active
  return DAY_KEYS.map((_, i) => ({
    day_of_week: i,
    is_active: i >= 1 && i <= 5,
    start_time: '09:00',
    end_time: '17:00',
  }));
}

// ── Main Component ─────────────────────────────────────────────────────

export default function BookingSettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const { isPro, isPlus, isBusiness, loading: subLoading } = useSubscription();

  const canAccessBookings = isPro || isPlus || isBusiness;

  // ── State ──────────────────────────────────────────────────────────

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings
  const [settings, setSettings] = useState<SchedulingSettings>(DEFAULT_SETTINGS);

  // Availability
  const [availability, setAvailability] = useState<AvailabilityRule[]>(getDefaultAvailability());

  // Time-off
  const [timeOffBlocks, setTimeOffBlocks] = useState<TimeOffBlock[]>([]);

  // Services
  const [services, setServices] = useState<ServiceItem[]>([]);

  // Section expansion
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    options: false,
    reminders: false,
    availability: false,
    timeoff: false,
    services: false,
  });

  // Picker modal
  const [pickerModal, setPickerModal] = useState<{
    visible: boolean;
    title: string;
    options: { key: string | number; label: string }[];
    onSelect: (value: any) => void;
  }>({ visible: false, title: '', options: [], onSelect: () => {} });

  // Time picker modal
  const [timePickerModal, setTimePickerModal] = useState<{
    visible: boolean;
    title: string;
    onSelect: (value: string) => void;
  }>({ visible: false, title: '', onSelect: () => {} });

  // Time-off modal
  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({
    title: '',
    start_date: '',
    end_date: '',
  });

  // Service modal
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceItem>({
    name: '',
    description: '',
    price: 0,
    price_type: 'fixed',
    duration: 60,
    is_active: true,
  });

  // ── Data Loading ───────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      // Load scheduling settings
      const { data: settingsData } = await (supabase.from('scheduling_settings') as any)
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (settingsData) {
        setSettings({
          timezone: settingsData.timezone || DEFAULT_SETTINGS.timezone,
          slot_duration: settingsData.slot_duration ?? DEFAULT_SETTINGS.slot_duration,
          buffer_before: settingsData.buffer_before ?? DEFAULT_SETTINGS.buffer_before,
          buffer_after: settingsData.buffer_after ?? DEFAULT_SETTINGS.buffer_after,
          min_notice_hours: settingsData.min_notice_hours ?? DEFAULT_SETTINGS.min_notice_hours,
          max_advance_days: settingsData.max_advance_days ?? DEFAULT_SETTINGS.max_advance_days,
          enabled: settingsData.enabled ?? DEFAULT_SETTINGS.enabled,
          require_approval: settingsData.require_approval ?? DEFAULT_SETTINGS.require_approval,
          send_email_confirmation: settingsData.send_email_confirmation ?? DEFAULT_SETTINGS.send_email_confirmation,
          send_sms_confirmation: settingsData.send_sms_confirmation ?? DEFAULT_SETTINGS.send_sms_confirmation,
          allow_client_edits: settingsData.allow_client_edits ?? DEFAULT_SETTINGS.allow_client_edits,
          reminder_enabled: settingsData.reminder_enabled ?? DEFAULT_SETTINGS.reminder_enabled,
          reminder_hours_before: settingsData.reminder_hours_before ?? DEFAULT_SETTINGS.reminder_hours_before,
          reminder_email_enabled: settingsData.reminder_email_enabled ?? DEFAULT_SETTINGS.reminder_email_enabled,
          reminder_sms_enabled: settingsData.reminder_sms_enabled ?? DEFAULT_SETTINGS.reminder_sms_enabled,
          reminder_message: settingsData.reminder_message ?? DEFAULT_SETTINGS.reminder_message,
          booking_location: settingsData.booking_location ?? DEFAULT_SETTINGS.booking_location,
          show_booking_location: settingsData.show_booking_location ?? DEFAULT_SETTINGS.show_booking_location,
        });
      }

      // Load availability rules
      const { data: rulesData } = await (supabase.from('availability_rules') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('day_of_week');

      if (rulesData && rulesData.length > 0) {
        const rules = getDefaultAvailability();
        for (const rule of rulesData) {
          const idx = rules.findIndex((r) => r.day_of_week === rule.day_of_week);
          if (idx !== -1) {
            rules[idx] = {
              day_of_week: rule.day_of_week,
              is_active: rule.is_active ?? true,
              start_time: rule.start_time?.substring(0, 5) || '09:00',
              end_time: rule.end_time?.substring(0, 5) || '17:00',
            };
          }
        }
        setAvailability(rules);
      }

      // Load time-off blocks
      const { data: blocksData } = await (supabase.from('availability_blocks') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('start_date');

      if (blocksData) {
        setTimeOffBlocks(blocksData.map((b: any) => ({
          id: b.id,
          user_id: b.user_id,
          title: b.title || '',
          start_date: b.start_date || '',
          end_date: b.end_date || '',
          block_type: b.block_type,
          created_at: b.created_at,
        })));
      }

      // Load services (website uses service_types table)
      const { data: servicesData } = await (supabase.from('service_types') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (servicesData) {
        setServices(servicesData.map((s: any) => ({
          id: s.id,
          user_id: s.user_id,
          name: s.name || '',
          description: s.description || '',
          price: s.price || 0,
          price_type: s.price_type || 'fixed',
          duration: s.duration || 60,
          is_active: s.is_active ?? true,
          created_at: s.created_at,
        })));
      }
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (canAccessBookings) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [canAccessBookings, loadData]);

  // ── Save Settings + Availability ───────────────────────────────────

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      // Upsert scheduling settings
      const { error: settingsError } = await (supabase.from('scheduling_settings') as any).upsert(
        {
          user_id: user.id,
          timezone: settings.timezone,
          slot_duration: settings.slot_duration,
          buffer_before: settings.buffer_before,
          buffer_after: settings.buffer_after,
          min_notice_hours: settings.min_notice_hours,
          max_advance_days: settings.max_advance_days,
          enabled: settings.enabled,
          require_approval: settings.require_approval,
          send_email_confirmation: settings.send_email_confirmation,
          send_sms_confirmation: settings.send_sms_confirmation,
          allow_client_edits: settings.allow_client_edits,
          reminder_enabled: settings.reminder_enabled,
          reminder_hours_before: settings.reminder_hours_before,
          reminder_email_enabled: settings.reminder_email_enabled,
          reminder_sms_enabled: settings.reminder_sms_enabled,
          reminder_message: settings.reminder_message || null,
          booking_location: settings.booking_location || null,
          show_booking_location: settings.show_booking_location,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: 'user_id' }
      );

      if (settingsError) throw settingsError;

      // Delete existing availability rules then re-insert
      await (supabase.from('availability_rules') as any)
        .delete()
        .eq('user_id', user.id);

      const rulesToInsert = availability.map((rule) => ({
        user_id: user.id,
        day_of_week: rule.day_of_week,
        is_active: rule.is_active,
        start_time: rule.start_time,
        end_time: rule.end_time,
      }));

      const { error: rulesError } = await (supabase.from('availability_rules') as any)
        .insert(rulesToInsert);

      if (rulesError) throw rulesError;

      showToast('success', t('bookingSettings.saved'));
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  // ── Time-Off CRUD ──────────────────────────────────────────────────

  const openAddTimeOff = () => {
    setTimeOffForm({ title: '', start_date: '', end_date: '' });
    setShowTimeOffModal(true);
  };

  const handleSaveTimeOff = async () => {
    if (!user?.id) return;
    if (!timeOffForm.title.trim()) {
      showToast('error', t('bookingSettings.enterReason'));
      return;
    }
    if (!timeOffForm.start_date.trim() || !timeOffForm.end_date.trim()) {
      showToast('error', t('bookingSettings.enterDates'));
      return;
    }

    try {
      const { error } = await (supabase.from('availability_blocks') as any).insert({
        user_id: user.id,
        title: timeOffForm.title.trim(),
        start_date: timeOffForm.start_date.trim(),
        end_date: timeOffForm.end_date.trim(),
        block_type: 'unavailable',
      });

      if (error) throw error;

      setShowTimeOffModal(false);
      showToast('success', t('bookingSettings.timeOffAdded'));
      // Reload time-off blocks
      const { data } = await (supabase.from('availability_blocks') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('start_date');
      if (data) setTimeOffBlocks(data.map((b: any) => ({
        id: b.id, user_id: b.user_id, title: b.title || '',
        start_date: b.start_date || '', end_date: b.end_date || '',
        block_type: b.block_type, created_at: b.created_at,
      })));
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    }
  };

  const handleDeleteTimeOff = (block: TimeOffBlock) => {
    Alert.alert(
      t('bookingSettings.deleteTimeOff'),
      t('bookingSettings.removeConfirm', { name: block.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await (supabase.from('availability_blocks') as any)
                .delete()
                .eq('id', block.id);
              if (error) throw error;
              setTimeOffBlocks((prev) => prev.filter((b) => b.id !== block.id));
              showToast('success', t('bookingSettings.timeOffRemoved'));
            } catch (error: any) {
              showToast('error', error.message || t('common.error'));
            }
          },
        },
      ]
    );
  };

  // ── Service CRUD ───────────────────────────────────────────────────

  const openAddService = () => {
    setEditingService(null);
    setServiceForm({
      name: '',
      description: '',
      price: 0,
      price_type: 'fixed',
      duration: 60,
      is_active: true,
    });
    setShowServiceModal(true);
  };

  const openEditService = (service: ServiceItem) => {
    setEditingService(service);
    setServiceForm({
      name: service.name,
      description: service.description || '',
      price: service.price,
      price_type: service.price_type || 'fixed',
      duration: service.duration || 60,
      is_active: service.is_active ?? true,
    });
    setShowServiceModal(true);
  };

  const handleSaveService = async () => {
    if (!user?.id) return;
    if (!serviceForm.name.trim()) {
      showToast('error', t('bookingSettings.serviceNameRequired'));
      return;
    }

    try {
      if (editingService?.id) {
        // Update
        const { error } = await (supabase.from('service_types') as any)
          .update({
            name: serviceForm.name.trim(),
            description: serviceForm.description.trim() || null,
            price: serviceForm.price,
            price_type: serviceForm.price_type,
            duration: serviceForm.duration,
            is_active: serviceForm.is_active,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', editingService.id);
        if (error) throw error;
        showToast('success', t('bookingSettings.serviceUpdated'));
      } else {
        // Insert
        const { error } = await (supabase.from('service_types') as any).insert({
          user_id: user.id,
          name: serviceForm.name.trim(),
          description: serviceForm.description.trim() || null,
          price: serviceForm.price,
          price_type: serviceForm.price_type,
          duration: serviceForm.duration,
          is_active: serviceForm.is_active,
        });
        if (error) throw error;
        showToast('success', t('bookingSettings.serviceAdded'));
      }

      setShowServiceModal(false);
      // Reload services
      const { data } = await (supabase.from('service_types') as any)
        .select('*')
        .eq('user_id', user.id)
        .order('name');
      if (data) setServices(data.map((s: any) => ({
        id: s.id, user_id: s.user_id, name: s.name || '',
        description: s.description || '', price: s.price || 0,
        price_type: s.price_type || 'fixed', duration: s.duration || 60,
        is_active: s.is_active ?? true, created_at: s.created_at,
      })));
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    }
  };

  const handleDeleteService = (service: ServiceItem) => {
    Alert.alert(
      t('bookingSettings.deleteService'),
      t('bookingSettings.removeConfirm', { name: service.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await (supabase.from('service_types') as any)
                .delete()
                .eq('id', service.id);
              if (error) throw error;
              setServices((prev) => prev.filter((s) => s.id !== service.id));
              showToast('success', t('bookingSettings.serviceRemoved'));
            } catch (error: any) {
              showToast('error', error.message || t('common.error'));
            }
          },
        },
      ]
    );
  };

  const handleToggleServiceActive = async (service: ServiceItem) => {
    try {
      const newActive = !service.is_active;
      const { error } = await (supabase.from('service_types') as any)
        .update({ is_active: newActive } as any)
        .eq('id', service.id);
      if (error) throw error;
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, is_active: newActive } : s))
      );
    } catch (error: any) {
      showToast('error', error.message || t('common.error'));
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateSetting = <K extends keyof SchedulingSettings>(key: K, value: SchedulingSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateAvailability = (dayIndex: number, field: keyof AvailabilityRule, value: any) => {
    setAvailability((prev) =>
      prev.map((rule, i) => (i === dayIndex ? { ...rule, [field]: value } : rule))
    );
  };

  const openPicker = (
    title: string,
    options: { key: string | number; label: string }[],
    onSelect: (value: any) => void
  ) => {
    setPickerModal({ visible: true, title, options, onSelect });
  };

  const openTimePicker = (title: string, onSelect: (value: string) => void) => {
    setTimePickerModal({ visible: true, title, onSelect });
  };

  const handleCopyBookingLink = async () => {
    const link = `${ENV.APP_URL}/book/${user?.id || ''}`;
    try {
      await Clipboard.setStringAsync(link);
      showToast('success', t('bookingSettings.copiedLink'));
    } catch {
      // Fallback to share
      try {
        await Share.share({ message: link });
      } catch {
        showToast('error', t('common.error'));
      }
    }
  };

  const handleShareBookingLink = async () => {
    const link = `${ENV.APP_URL}/book/${user?.id || ''}`;
    try {
      await Share.share({
        message: `${t('bookingSettings.bookAppointment')}: ${link}`,
        url: link,
      });
    } catch {
      // dismissed
    }
  };

  // ── Tier Gate ──────────────────────────────────────────────────────

  if (subLoading || loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('bookingSettings.title')}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!canAccessBookings) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('bookingSettings.title')}</Text>
        </View>
        <View style={styles.upgradeContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.upgradeTitle, { color: colors.text }]}>{t('bookingSettings.title')}</Text>
          <Text style={[styles.upgradeDescription, { color: colors.textSecondary }]}>
            {t('bookingSettings.upgradePrompt')}
          </Text>
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(app)/plans' as any)}
          >
            <Text style={styles.upgradeButtonText}>{t('bookingSettings.viewPlans')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render Helpers ─────────────────────────────────────────────────

  const renderSectionHeader = (
    key: string,
    icon: string,
    title: string
  ) => {
    const expanded = expandedSections[key];
    return (
      <TouchableOpacity
        style={[styles.sectionHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => toggleSection(key)}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionIconContainer, { backgroundColor: colors.infoLight }]}>
          <Ionicons name={icon as any} size={20} color={colors.primary} />
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textTertiary}
        />
      </TouchableOpacity>
    );
  };

  const renderPickerRow = (
    label: string,
    value: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      style={[styles.pickerRow, { borderBottomColor: colors.borderLight }]}
      onPress={onPress}
    >
      <Text style={[styles.pickerLabel, { color: colors.text }]}>{label}</Text>
      <View style={styles.pickerValueContainer}>
        <Text style={[styles.pickerValue, { color: colors.primary }]}>{value}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );

  const renderSwitchRow = (
    label: string,
    value: boolean,
    onValueChange: (v: boolean) => void,
    isLast?: boolean
  ) => (
    <View style={[styles.switchRow, !isLast && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 }]}>
      <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primary + '60' }}
        thumbColor={value ? colors.primary : colors.surface}
      />
    </View>
  );

  // ── Main Render ────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>{t('bookingSettings.title')}</Text>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── Section: Master Toggle + Booking Link ─────────────── */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.masterToggleRow}>
              <View style={styles.masterToggleText}>
                <Text style={[styles.masterToggleLabel, { color: colors.text }]}>
                  {t('bookingSettings.enableBookings')}
                </Text>
                <Text style={[styles.masterToggleSubtitle, { color: colors.textSecondary }]}>
                  {t('bookingSettings.enableBookingsSubtitle')}
                </Text>
              </View>
              <Switch
                value={settings.enabled}
                onValueChange={(v) => updateSetting('enabled', v)}
                trackColor={{ false: colors.border, true: colors.primary + '60' }}
                thumbColor={settings.enabled ? colors.primary : colors.surface}
              />
            </View>

            {settings.enabled && (
              <View style={[styles.bookingLinkContainer, { borderTopColor: colors.borderLight }]}>
                <Text style={[styles.bookingLinkLabel, { color: colors.textSecondary }]}>
                  {t('bookingSettings.bookingLink')}
                </Text>
                <View style={[styles.bookingLinkBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                  <Text
                    style={[styles.bookingLinkText, { color: colors.text }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {`${ENV.APP_URL}/book/${user?.id || ''}`}
                  </Text>
                </View>
                <View style={styles.bookingLinkActions}>
                  <TouchableOpacity
                    style={[styles.linkActionButton, { backgroundColor: colors.primary }]}
                    onPress={handleCopyBookingLink}
                  >
                    <Ionicons name="copy-outline" size={16} color="#fff" />
                    <Text style={styles.linkActionText}>{t('bookingSettings.copy')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.linkActionButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderWidth: 1 }]}
                    onPress={handleShareBookingLink}
                  >
                    <Ionicons name="share-outline" size={16} color={colors.text} />
                    <Text style={[styles.linkActionText, { color: colors.text }]}>{t('bookingSettings.share')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ── Section: Basic Settings ───────────────────────────── */}
          {renderSectionHeader('basic', 'settings-outline', t('bookingSettings.basicSettings'))}
          {expandedSections.basic && (
            <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderPickerRow(
                t('bookingSettings.timezone'),
                TIMEZONES.find((tz) => tz.key === settings.timezone)?.label || settings.timezone,
                () =>
                  openPicker(t('bookingSettings.timezone'), TIMEZONES, (val) =>
                    updateSetting('timezone', val)
                  )
              )}
              {renderPickerRow(
                t('bookingSettings.slotDuration'),
                `${settings.slot_duration} ${t('bookingSettings.minutes')}`,
                () =>
                  openPicker(
                    t('bookingSettings.slotDuration'),
                    SLOT_DURATIONS.map((d) => ({ key: d, label: `${d} ${t('bookingSettings.minutes')}` })),
                    (val) => updateSetting('slot_duration', val)
                  )
              )}
              {renderPickerRow(
                t('bookingSettings.bufferBefore'),
                settings.buffer_before === 0 ? t('bookingSettings.none') : `${settings.buffer_before} ${t('bookingSettings.minutes')}`,
                () =>
                  openPicker(
                    t('bookingSettings.bufferBefore'),
                    BUFFER_OPTIONS.map((d) => ({ key: d, label: d === 0 ? t('bookingSettings.none') : `${d} ${t('bookingSettings.minutes')}` })),
                    (val) => updateSetting('buffer_before', val)
                  )
              )}
              {renderPickerRow(
                t('bookingSettings.bufferAfter'),
                settings.buffer_after === 0 ? t('bookingSettings.none') : `${settings.buffer_after} ${t('bookingSettings.minutes')}`,
                () =>
                  openPicker(
                    t('bookingSettings.bufferAfter'),
                    BUFFER_OPTIONS.map((d) => ({ key: d, label: d === 0 ? t('bookingSettings.none') : `${d} ${t('bookingSettings.minutes')}` })),
                    (val) => updateSetting('buffer_after', val)
                  )
              )}
              {renderPickerRow(
                t('bookingSettings.minimumNotice'),
                (() => { const o = MIN_NOTICE_OPTIONS.find((o) => o.key === settings.min_notice_hours); return o ? `${o.i18nLabel} ${t(o.i18nUnit)}` : `${settings.min_notice_hours}h`; })(),
                () =>
                  openPicker(
                    t('bookingSettings.minimumNotice'),
                    MIN_NOTICE_OPTIONS.map((o) => ({ key: o.key, label: `${o.i18nLabel} ${t(o.i18nUnit)}` })),
                    (val) => updateSetting('min_notice_hours', val)
                  )
              )}
              {renderPickerRow(
                t('bookingSettings.maxAdvance'),
                (() => { const o = MAX_ADVANCE_OPTIONS.find((o) => o.key === settings.max_advance_days); return o ? `${o.i18nLabel} ${t(o.i18nUnit)}` : `${settings.max_advance_days} ${t('bookingSettings.days')}`; })(),
                () =>
                  openPicker(
                    t('bookingSettings.maxAdvance'),
                    MAX_ADVANCE_OPTIONS.map((o) => ({ key: o.key, label: `${o.i18nLabel} ${t(o.i18nUnit)}` })),
                    (val) => updateSetting('max_advance_days', val)
                  )
              )}
            </View>
          )}

          {/* ── Section: Options ──────────────────────────────────── */}
          {renderSectionHeader('options', 'options-outline', t('bookingSettings.options'))}
          {expandedSections.options && (
            <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {renderSwitchRow(t('bookingSettings.requireApproval'), settings.require_approval, (v) =>
                updateSetting('require_approval', v)
              )}
              {renderSwitchRow(t('bookingSettings.emailConfirmation'), settings.send_email_confirmation, (v) =>
                updateSetting('send_email_confirmation', v)
              )}
              {renderSwitchRow(t('bookingSettings.smsConfirmation'), settings.send_sms_confirmation, (v) =>
                updateSetting('send_sms_confirmation', v)
              )}
              {renderSwitchRow(
                t('bookingSettings.allowClientEdits'),
                settings.allow_client_edits,
                (v) => updateSetting('allow_client_edits', v)
              )}

              {/* Show booking location toggle */}
              <View style={[styles.switchRow, !settings.show_booking_location && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>
                    {t('bookingSettings.showBookingLocation')}
                  </Text>
                  <Text style={{ fontSize: FontSizes.xs, color: colors.textSecondary, marginTop: 2 }}>
                    {t('bookingSettings.showBookingLocationDesc')}
                  </Text>
                </View>
                <Switch
                  value={settings.show_booking_location}
                  onValueChange={(v) => updateSetting('show_booking_location', v)}
                  trackColor={{ false: colors.border, true: colors.primary + '60' }}
                  thumbColor={settings.show_booking_location ? colors.primary : colors.surface}
                />
              </View>

              {settings.show_booking_location && (
                <View style={[styles.reminderMessageContainer, { borderTopColor: colors.borderLight }]}>
                  <Text style={[styles.inputLabel, { color: colors.text, marginBottom: Spacing.xs }]}>
                    {t('bookingSettings.bookingLocation')}
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.input, { color: colors.text }]}
                      value={settings.booking_location}
                      onChangeText={(v) => updateSetting('booking_location', v)}
                      placeholder={t('bookingSettings.bookingLocationPlaceholder')}
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <Text style={{ fontSize: FontSizes.xs, color: colors.textTertiary, marginTop: 4 }}>
                    {t('bookingSettings.bookingLocationFallback')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Section: Appointment Reminders ──────────────────── */}
          {renderSectionHeader('reminders', 'notifications-outline', t('bookingSettings.appointmentReminders'))}
          {expandedSections.reminders && (
            <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {/* Master reminder toggle */}
              <View style={[styles.switchRow, { borderBottomColor: colors.borderLight, borderBottomWidth: 1 }]}>
                <View style={{ flex: 1, marginRight: Spacing.sm }}>
                  <Text style={[styles.switchLabel, { color: colors.text }]}>
                    {t('bookingSettings.enableReminders')}
                  </Text>
                  <Text style={{ fontSize: FontSizes.xs, color: colors.textSecondary, marginTop: 2 }}>
                    {t('bookingSettings.enableRemindersDesc')}
                  </Text>
                </View>
                <Switch
                  value={settings.reminder_enabled}
                  onValueChange={(v) => updateSetting('reminder_enabled', v)}
                  trackColor={{ false: colors.border, true: colors.primary + '60' }}
                  thumbColor={settings.reminder_enabled ? colors.primary : colors.surface}
                />
              </View>

              {settings.reminder_enabled && (
                <>
                  {/* Reminder hours before */}
                  {renderPickerRow(
                    t('bookingSettings.reminderBefore'),
                    (() => {
                      const o = REMINDER_HOURS_OPTIONS.find((o) => o.key === settings.reminder_hours_before);
                      return o ? `${o.i18nLabel} ${t(o.i18nUnit)}` : `${settings.reminder_hours_before}h`;
                    })(),
                    () =>
                      openPicker(
                        t('bookingSettings.reminderBefore'),
                        REMINDER_HOURS_OPTIONS.map((o) => ({
                          key: o.key,
                          label: `${o.i18nLabel} ${t(o.i18nUnit)}`,
                        })),
                        (val) => updateSetting('reminder_hours_before', val)
                      )
                  )}

                  {/* Email reminder toggle */}
                  {renderSwitchRow(
                    t('bookingSettings.sendEmailReminder'),
                    settings.reminder_email_enabled,
                    (v) => updateSetting('reminder_email_enabled', v)
                  )}

                  {/* SMS reminder toggle */}
                  {renderSwitchRow(
                    t('bookingSettings.sendSmsReminder'),
                    settings.reminder_sms_enabled,
                    (v) => updateSetting('reminder_sms_enabled', v)
                  )}

                  {/* Custom reminder message */}
                  <View style={[styles.reminderMessageContainer, { borderTopColor: colors.borderLight }]}>
                    <Text style={[styles.inputLabel, { color: colors.text, marginBottom: Spacing.xs }]}>
                      {t('bookingSettings.customReminderMessage')}
                    </Text>
                    <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border, minHeight: 80 }]}>
                      <TextInput
                        style={[styles.input, { color: colors.text, textAlignVertical: 'top', minHeight: 72 }]}
                        value={settings.reminder_message}
                        onChangeText={(v) => updateSetting('reminder_message', v)}
                        placeholder={t('bookingSettings.reminderMessagePlaceholder')}
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                    <Text style={{ fontSize: FontSizes.xs, color: colors.textTertiary, marginTop: 4 }}>
                      {t('bookingSettings.reminderMessageHint')}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Section: Weekly Availability ──────────────────────── */}
          {renderSectionHeader('availability', 'time-outline', t('bookingSettings.weeklyAvailability'))}
          {expandedSections.availability && (
            <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {availability.map((rule, idx) => {
                const isLast = idx === availability.length - 1;
                return (
                  <View
                    key={rule.day_of_week}
                    style={[
                      styles.availabilityRow,
                      !isLast && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                    ]}
                  >
                    <View style={styles.availabilityDayRow}>
                      <Text style={[styles.dayName, { color: colors.text }]}>
                        {t(DAY_KEYS[idx])}
                      </Text>
                      <Switch
                        value={rule.is_active}
                        onValueChange={(v) => updateAvailability(idx, 'is_active', v)}
                        trackColor={{ false: colors.border, true: colors.primary + '60' }}
                        thumbColor={rule.is_active ? colors.primary : colors.surface}
                      />
                    </View>
                    {rule.is_active && (
                      <View style={styles.timeRangeRow}>
                        <TouchableOpacity
                          style={[styles.timeButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                          onPress={() =>
                            openTimePicker(`${t(DAY_KEYS[idx])} ${t('bookingSettings.start')}`, (val) =>
                              updateAvailability(idx, 'start_time', val)
                            )
                          }
                        >
                          <Text style={[styles.timeButtonText, { color: colors.primary }]}>
                            {formatTime24to12(rule.start_time)}
                          </Text>
                        </TouchableOpacity>
                        <Text style={[styles.timeDash, { color: colors.textTertiary }]}>-</Text>
                        <TouchableOpacity
                          style={[styles.timeButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                          onPress={() =>
                            openTimePicker(`${t(DAY_KEYS[idx])} ${t('bookingSettings.end')}`, (val) =>
                              updateAvailability(idx, 'end_time', val)
                            )
                          }
                        >
                          <Text style={[styles.timeButtonText, { color: colors.primary }]}>
                            {formatTime24to12(rule.end_time)}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Section: Time Off ─────────────────────────────────── */}
          {renderSectionHeader('timeoff', 'airplane-outline', t('bookingSettings.timeOff'))}
          {expandedSections.timeoff && (
            <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {timeOffBlocks.length === 0 && (
                <View style={styles.emptySection}>
                  <Text style={[styles.emptySectionText, { color: colors.textTertiary }]}>
                    {t('bookingSettings.noTimeOff')}
                  </Text>
                </View>
              )}
              {timeOffBlocks.map((block, idx) => {
                const isLast = idx === timeOffBlocks.length - 1;
                return (
                  <View
                    key={block.id || idx}
                    style={[
                      styles.timeOffRow,
                      !isLast && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                    ]}
                  >
                    <View style={styles.timeOffInfo}>
                      <Text style={[styles.timeOffReason, { color: colors.text }]}>
                        {block.title}
                      </Text>
                      <Text style={[styles.timeOffDates, { color: colors.textSecondary }]}>
                        {block.start_date?.substring(0, 10)} to {block.end_date?.substring(0, 10)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteTimeOff(block)}
                      style={styles.deleteIconButton}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
              <TouchableOpacity
                style={[styles.addRowButton, { borderTopColor: colors.borderLight }]}
                onPress={openAddTimeOff}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.addRowText, { color: colors.primary }]}>{t('bookingSettings.addTimeOff')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Section: Services ─────────────────────────────────── */}
          {renderSectionHeader('services', 'pricetag-outline', t('bookingSettings.services'))}
          {expandedSections.services && (
            <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {services.length === 0 && (
                <View style={styles.emptySection}>
                  <Text style={[styles.emptySectionText, { color: colors.textTertiary }]}>
                    {t('bookingSettings.noServices')}
                  </Text>
                </View>
              )}
              {services.map((service, idx) => {
                const isLast = idx === services.length - 1;
                return (
                  <View
                    key={service.id || idx}
                    style={[
                      styles.serviceRow,
                      !isLast && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 },
                    ]}
                  >
                    <View style={styles.serviceInfo}>
                      <Text style={[styles.serviceName, { color: colors.text }]}>
                        {service.name}
                      </Text>
                      <Text style={[styles.serviceDetails, { color: colors.textSecondary }]}>
                        ${service.price?.toFixed(2)} {service.price_type} / {service.duration} {t('bookingSettings.minutes')}
                      </Text>
                    </View>
                    <View style={styles.serviceActions}>
                      <Switch
                        value={service.is_active}
                        onValueChange={() => handleToggleServiceActive(service)}
                        trackColor={{ false: colors.border, true: colors.success + '60' }}
                        thumbColor={service.is_active ? colors.success : colors.surface}
                      />
                      <TouchableOpacity
                        onPress={() => openEditService(service)}
                        style={styles.serviceActionButton}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteService(service)}
                        style={styles.serviceActionButton}
                      >
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              <TouchableOpacity
                style={[styles.addRowButton, { borderTopColor: colors.borderLight }]}
                onPress={openAddService}
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.addRowText, { color: colors.primary }]}>{t('bookingSettings.addService')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Save Button ───────────────────────────────────────── */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              saving && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Picker Modal ──────────────────────────────────────────── */}
      <Modal
        visible={pickerModal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerModal((prev) => ({ ...prev, visible: false }))}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity
              onPress={() => setPickerModal((prev) => ({ ...prev, visible: false }))}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{pickerModal.title}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <FlatList
            data={pickerModal.options}
            keyExtractor={(item) => String(item.key)}
            contentContainerStyle={styles.pickerListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerOption, { borderBottomColor: colors.borderLight }]}
                onPress={() => {
                  pickerModal.onSelect(item.key);
                  setPickerModal((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Text style={[styles.pickerOptionText, { color: colors.text }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* ── Time Picker Modal ─────────────────────────────────────── */}
      <Modal
        visible={timePickerModal.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTimePickerModal((prev) => ({ ...prev, visible: false }))}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity
              onPress={() => setTimePickerModal((prev) => ({ ...prev, visible: false }))}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{timePickerModal.title}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <FlatList
            data={TIME_SLOTS}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.pickerListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerOption, { borderBottomColor: colors.borderLight }]}
                onPress={() => {
                  timePickerModal.onSelect(item);
                  setTimePickerModal((prev) => ({ ...prev, visible: false }));
                }}
              >
                <Text style={[styles.pickerOptionText, { color: colors.text }]}>
                  {formatTime24to12(item)}
                </Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* ── Time Off Modal ────────────────────────────────────────── */}
      <Modal
        visible={showTimeOffModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTimeOffModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <SafeAreaView style={styles.flex1} edges={['top']}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
              <TouchableOpacity
                onPress={() => setShowTimeOffModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('bookingSettings.addTimeOff')}</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>
            <ScrollView
              style={styles.flex1}
              contentContainerStyle={styles.modalFormContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.reason')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={timeOffForm.title}
                    onChangeText={(v) => setTimeOffForm((prev) => ({ ...prev, title: v }))}
                    placeholder={t('bookingSettings.reasonPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="sentences"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.startDate')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={timeOffForm.start_date}
                    onChangeText={(v) => setTimeOffForm((prev) => ({ ...prev, start_date: v }))}
                    placeholder={t('bookingSettings.datePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.endDate')}</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={timeOffForm.end_date}
                    onChangeText={(v) => setTimeOffForm((prev) => ({ ...prev, end_date: v }))}
                    placeholder={t('bookingSettings.datePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalCancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowTimeOffModal(false)}
                >
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveTimeOff}
                >
                  <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Service Modal ─────────────────────────────────────────── */}
      <Modal
        visible={showServiceModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowServiceModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          <SafeAreaView style={styles.flex1} edges={['top']}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
              <TouchableOpacity
                onPress={() => setShowServiceModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingService ? t('bookingSettings.editService') : t('bookingSettings.addService')}
              </Text>
              <View style={styles.modalHeaderSpacer} />
            </View>
            <ScrollView
              style={styles.flex1}
              contentContainerStyle={styles.modalFormContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.serviceName')} *</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={serviceForm.name}
                    onChangeText={(v) => setServiceForm((prev) => ({ ...prev, name: v }))}
                    placeholder={t('bookingSettings.serviceNamePlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.serviceDescription')}</Text>
                <View style={[styles.inputWrapperMultiline, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.inputMultiline, { color: colors.text }]}
                    value={serviceForm.description}
                    onChangeText={(v) => setServiceForm((prev) => ({ ...prev, description: v }))}
                    placeholder={t('bookingSettings.serviceDescriptionPlaceholder')}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.servicePrice')} ($)</Text>
                <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    value={serviceForm.price > 0 ? String(serviceForm.price) : ''}
                    onChangeText={(v) => {
                      const num = parseFloat(v) || 0;
                      setServiceForm((prev) => ({ ...prev, price: num }));
                    }}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Price Type Picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.priceType')}</Text>
                <View style={styles.chipRow}>
                  {PRICE_TYPES.map((pt) => {
                    const isActive = serviceForm.price_type === pt.key;
                    return (
                      <TouchableOpacity
                        key={pt.key}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isActive ? colors.primary : colors.surfaceSecondary,
                            borderColor: isActive ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() =>
                          setServiceForm((prev) => ({
                            ...prev,
                            price_type: pt.key as 'fixed' | 'starting_at' | 'quote',
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isActive ? '#fff' : colors.textSecondary },
                          ]}
                        >
                          {t(pt.i18nKey)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Duration Picker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.serviceDuration')}</Text>
                <View style={styles.chipRow}>
                  {SLOT_DURATIONS.map((d) => {
                    const isActive = serviceForm.duration === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isActive ? colors.primary : colors.surfaceSecondary,
                            borderColor: isActive ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() =>
                          setServiceForm((prev) => ({ ...prev, duration: d }))
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: isActive ? '#fff' : colors.textSecondary },
                          ]}
                        >
                          {d} {t('bookingSettings.minutes')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Active Toggle */}
              <View style={styles.serviceActiveToggle}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>{t('bookingSettings.active')}</Text>
                <Switch
                  value={serviceForm.is_active}
                  onValueChange={(v) => setServiceForm((prev) => ({ ...prev, is_active: v }))}
                  trackColor={{ false: colors.border, true: colors.success + '60' }}
                  thumbColor={serviceForm.is_active ? colors.success : colors.surface}
                />
              </View>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  style={[styles.modalCancelButton, { borderColor: colors.border }]}
                  onPress={() => setShowServiceModal(false)}
                >
                  <Text style={[styles.modalCancelText, { color: colors.text }]}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveButton, { backgroundColor: colors.primary }]}
                  onPress={handleSaveService}
                >
                  <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
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
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing['4xl'] + 40,
  },

  // ── Upgrade ──────────────────────────────────────────────────────
  upgradeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  upgradeTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  upgradeDescription: {
    fontSize: FontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing['2xl'],
  },
  upgradeButton: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: FontSizes.md,
    fontWeight: '600',
  },

  // ── Card / Master Toggle ─────────────────────────────────────────
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  masterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  masterToggleText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  masterToggleLabel: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  masterToggleSubtitle: {
    fontSize: FontSizes.sm,
  },
  bookingLinkContainer: {
    borderTopWidth: 1,
    padding: Spacing.lg,
  },
  bookingLinkLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.sm,
  },
  bookingLinkBox: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bookingLinkText: {
    fontSize: FontSizes.sm,
  },
  bookingLinkActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  linkActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  linkActionText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },

  // ── Section Header ───────────────────────────────────────────────
  sectionHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  sectionTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
  },

  // ── Section Content ──────────────────────────────────────────────
  sectionContent: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },

  // ── Picker Row ───────────────────────────────────────────────────
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  pickerLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  pickerValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pickerValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },

  // ── Switch Row ───────────────────────────────────────────────────
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  switchLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    flex: 1,
    marginRight: Spacing.md,
  },

  // ── Reminders ──────────────────────────────────────────────────
  reminderMessageContainer: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
  },

  // ── Availability ─────────────────────────────────────────────────
  availabilityRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  availabilityDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayName: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },
  timeRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  timeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  timeButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  timeDash: {
    fontSize: FontSizes.md,
    fontWeight: '500',
  },

  // ── Time Off ─────────────────────────────────────────────────────
  emptySection: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: FontSizes.sm,
  },
  timeOffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  timeOffInfo: {
    flex: 1,
  },
  timeOffReason: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    marginBottom: 2,
  },
  timeOffDates: {
    fontSize: FontSizes.sm,
  },
  deleteIconButton: {
    padding: Spacing.sm,
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  addRowText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },

  // ── Services ─────────────────────────────────────────────────────
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  serviceInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  serviceName: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    marginBottom: 2,
  },
  serviceDetails: {
    fontSize: FontSizes.sm,
  },
  serviceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  serviceActionButton: {
    padding: Spacing.xs,
  },

  // ── Save Button ──────────────────────────────────────────────────
  saveButton: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
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

  // ── Modals ───────────────────────────────────────────────────────
  modalContainer: {
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
  modalFormContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['4xl'],
  },
  pickerListContent: {
    paddingBottom: Spacing['4xl'],
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  pickerOptionText: {
    fontSize: FontSizes.md,
  },

  // ── Form Inputs ──────────────────────────────────────────────────
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
  inputWrapperMultiline: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: FontSizes.md,
    paddingVertical: Spacing.md,
  },
  inputMultiline: {
    fontSize: FontSizes.md,
    minHeight: 80,
  },

  // ── Chips ────────────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },

  // ── Service Modal Toggle ─────────────────────────────────────────
  serviceActiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },

  // ── Modal Buttons ────────────────────────────────────────────────
  modalButtonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalCancelButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: '#fff',
  },
});
