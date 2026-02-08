import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useNavigationBadges } from '@/hooks/useNavigationBadges';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';

interface MoreItem {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  badge?: number;
  onPress: () => void;
}

export default function MoreScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const { counts } = useNavigationBadges();

  const items: MoreItem[] = [
    {
      id: 'projects',
      icon: 'folder-outline',
      title: t('projects.title'),
      subtitle: t('more.projectsSubtitle'),
      badge: counts.projects,
      onPress: () => router.push('/(app)/projects' as any),
    },
    {
      id: 'tasks',
      icon: 'checkbox-outline',
      title: t('tasks.title'),
      subtitle: t('more.tasksSubtitle'),
      badge: counts.tasks,
      onPress: () => router.push('/(app)/tasks' as any),
    },
    {
      id: 'invoices',
      icon: 'document-text-outline',
      title: t('invoices.title'),
      subtitle: t('more.invoicesSubtitle'),
      onPress: () => router.push('/(app)/invoices' as any),
    },
    {
      id: 'properties',
      icon: 'home-outline',
      title: t('properties.title'),
      subtitle: t('more.propertiesSubtitle'),
      onPress: () => router.push('/(app)/properties' as any),
    },
    {
      id: 'settings',
      icon: 'settings-outline',
      title: t('settings.title'),
      subtitle: t('more.settingsSubtitle'),
      onPress: () => router.push('/(app)/settings' as any),
    },
  ];

  const renderItem = (item: MoreItem) => {
    const hasBadge = item.badge !== undefined && item.badge > 0;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.settingItem, { borderBottomColor: colors.borderLight }]}
        onPress={item.onPress}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.infoLight }]}>
          <Ionicons name={item.icon as any} size={20} color={colors.primary} />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text
            style={[styles.itemSubtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.subtitle}
          </Text>
        </View>
        {hasBadge ? (
          <View style={[styles.badgeContainer, { backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{item.badge}</Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('more.title')}</Text>
        </View>

        {/* Items */}
        <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {items.map(renderItem)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSizes['2xl'],
    fontWeight: 'bold',
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
  badgeContainer: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
});
