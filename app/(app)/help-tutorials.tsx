import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useSubscription } from '@/hooks/useSubscription';
import { useTutorialStore } from '@/stores/tutorialStore';
import { showTutorial, showToast } from '@/components';
import {
  TUTORIALS,
  TUTORIAL_CATEGORIES,
  isTierAtLeast,
} from '@/lib/tutorials';
import type { TutorialDefinition } from '@/lib/tutorials';
import type { TierSlug } from '@/lib/plans';

const TIER_LABELS: Record<string, string> = {
  pro: 'PRO',
  plus: 'PLUS',
  business: 'BUSINESS',
};

export default function HelpTutorialsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslations();
  const router = useRouter();
  const { tier } = useSubscription();
  const currentTier = (tier || 'free') as TierSlug;

  const tutorialsEnabled = useTutorialStore((s) => s.tutorialsEnabled);
  const completedTutorials = useTutorialStore((s) => s.completedTutorials);
  const setEnabled = useTutorialStore((s) => s.setEnabled);
  const resetAll = useTutorialStore((s) => s.resetAll);
  const resetTutorial = useTutorialStore((s) => s.resetTutorial);

  const groupedTutorials = useMemo(() => {
    const groups: Record<string, TutorialDefinition[]> = {};
    for (const cat of TUTORIAL_CATEGORIES) {
      const tutorials = TUTORIALS.filter((t) => t.category === cat.key);
      if (tutorials.length > 0) {
        groups[cat.key] = tutorials;
      }
    }
    return groups;
  }, []);

  const handleResetAll = () => {
    Alert.alert(
      t('tutorials.helpScreen.resetAll'),
      t('tutorials.helpScreen.resetAllConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('tutorials.helpScreen.resetAll'),
          style: 'destructive',
          onPress: () => {
            resetAll();
            showToast('success', t('tutorials.helpScreen.resetSuccess'));
          },
        },
      ],
    );
  };

  const handleTutorialPress = (tutorial: TutorialDefinition) => {
    if (tutorial.minTier && !isTierAtLeast(currentTier, tutorial.minTier)) {
      showToast(
        'info',
        t('tutorials.helpScreen.upgradeRequired', {
          tier: TIER_LABELS[tutorial.minTier] || tutorial.minTier,
        }),
      );
      return;
    }
    resetTutorial(tutorial.id);
    showTutorial(tutorial.id);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('tutorials.helpScreen.title')}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {t('tutorials.helpScreen.subtitle')}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Toggle + Reset */}
        <View style={[styles.controlCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="school-outline" size={20} color={colors.primary} />
              <View style={styles.toggleTextContainer}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>
                  {t('tutorials.helpScreen.enableTutorials')}
                </Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  {t('tutorials.helpScreen.enableTutorialsSubtitle')}
                </Text>
              </View>
            </View>
            <Switch
              value={tutorialsEnabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.resetRow}
            onPress={handleResetAll}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={20} color={colors.warning} />
            <Text style={[styles.resetText, { color: colors.warning }]}>
              {t('tutorials.helpScreen.resetAll')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tutorial groups */}
        {TUTORIAL_CATEGORIES.map((category) => {
          const tutorials = groupedTutorials[category.key];
          if (!tutorials) return null;

          return (
            <View key={category.key} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons
                  name={category.icon as any}
                  size={18}
                  color={colors.textSecondary}
                />
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {t(category.nameKey)}
                </Text>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {tutorials.map((tutorial, index) => {
                  const isCompleted = !!completedTutorials[tutorial.id];
                  const isLocked =
                    !!tutorial.minTier &&
                    !isTierAtLeast(currentTier, tutorial.minTier);

                  return (
                    <View key={tutorial.id}>
                      {index > 0 && (
                        <View style={[styles.itemDivider, { backgroundColor: colors.border }]} />
                      )}
                      <TouchableOpacity
                        style={[styles.tutorialRow, isLocked && styles.lockedRow]}
                        onPress={() => handleTutorialPress(tutorial)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.tutorialIcon,
                            {
                              backgroundColor: isLocked
                                ? colors.border
                                : isCompleted
                                  ? colors.success
                                  : colors.primary,
                            },
                          ]}
                        >
                          <Ionicons
                            name={
                              isLocked
                                ? 'lock-closed-outline'
                                : (tutorial.steps[0]?.icon as any) || 'book-outline'
                            }
                            size={18}
                            color={
                              isLocked
                                ? colors.textSecondary
                                : '#FFFFFF'
                            }
                          />
                        </View>

                        <View style={styles.tutorialInfo}>
                          <Text
                            style={[
                              styles.tutorialName,
                              { color: isLocked ? colors.textSecondary : colors.text },
                            ]}
                          >
                            {t(tutorial.nameKey)}
                          </Text>
                          <Text style={[styles.tutorialStatus, { color: colors.textSecondary }]}>
                            {isLocked
                              ? t('tutorials.helpScreen.upgradeRequired', {
                                  tier: TIER_LABELS[tutorial.minTier!] || tutorial.minTier,
                                })
                              : isCompleted
                                ? t('tutorials.helpScreen.completed')
                                : t('tutorials.helpScreen.replay')}
                          </Text>
                        </View>

                        {tutorial.minTier && (
                          <View
                            style={[
                              styles.tierBadge,
                              {
                                backgroundColor: isLocked
                                  ? colors.border
                                  : colors.primary,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.tierBadgeText,
                                {
                                  color: isLocked
                                    ? colors.textSecondary
                                    : '#FFFFFF',
                                },
                              ]}
                            >
                              {TIER_LABELS[tutorial.minTier] || tutorial.minTier}
                            </Text>
                          </View>
                        )}

                        {isCompleted && !isLocked && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={colors.success}
                            style={styles.checkIcon}
                          />
                        )}

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl * 2,
  },
  controlCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleTextContainer: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  toggleLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resetText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tutorialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  lockedRow: {
    opacity: 0.6,
  },
  tutorialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialInfo: {
    flex: 1,
  },
  tutorialName: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  tutorialStatus: {
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  tierBadge: {
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  tierBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  checkIcon: {
    marginRight: 2,
  },
  itemDivider: {
    height: 1,
    marginLeft: Spacing.md + 36 + Spacing.sm,
  },
});
