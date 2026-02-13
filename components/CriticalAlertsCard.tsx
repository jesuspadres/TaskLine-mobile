import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, FontSizes, BorderRadius, Shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

interface Alert {
  id: string;
  entityId: string;
  type: 'overdue_invoice' | 'missed_deadline' | 'high_priority_task';
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export function CriticalAlertsCard() {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (user) loadAlerts();
  }, [user]);

  async function loadAlerts() {
    const today = new Date().toISOString();
    const alertsList: Alert[] = [];

    // Overdue invoices
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('id, invoice_number, total, due_date')
      .eq('status', 'overdue')
      .limit(3);

    overdueInvoices?.forEach((inv) => {
      alertsList.push({
        id: `inv-${inv.id}`,
        entityId: inv.id,
        type: 'overdue_invoice',
        title: `Invoice ${inv.invoice_number} is overdue`,
        subtitle: `$${inv.total?.toFixed(2) || '0'} due`,
        icon: 'alert-circle',
        color: colors.error,
      });
    });

    // Overdue tasks (high priority, past due)
    const { data: overdueTasks } = await supabase
      .from('tasks')
      .select('id, title, due_date')
      .eq('priority', 'high')
      .neq('status', 'completed')
      .lt('due_date', today)
      .limit(3);

    overdueTasks?.forEach((task) => {
      alertsList.push({
        id: `task-${task.id}`,
        entityId: task.id,
        type: 'high_priority_task',
        title: task.title,
        subtitle: 'High priority - past due',
        icon: 'flame',
        color: colors.warning,
      });
    });

    // Projects past deadline (active projects whose stage isn't completed)
    const { data: missedProjects } = await supabase
      .from('projects')
      .select('id, name, deadline')
      .eq('status', 'active')
      .neq('project_stage', 'completed' as any)
      .lt('deadline', today)
      .limit(2);

    missedProjects?.forEach((proj) => {
      alertsList.push({
        id: `proj-${proj.id}`,
        entityId: proj.id,
        type: 'missed_deadline',
        title: proj.name,
        subtitle: 'Past deadline',
        icon: 'time',
        color: colors.error,
      });
    });

    setAlerts(alertsList);
  }

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));

  if (visibleAlerts.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.errorLight,
          borderColor: colors.error + '30',
        },
      ]}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={() => setCollapsed((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Ionicons name="warning" size={16} color={colors.error} />
        <Text style={[styles.headerText, { color: colors.error }]}>
          Needs Attention ({visibleAlerts.length})
        </Text>
        <View style={{ flex: 1 }} />
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={16}
          color={colors.error}
        />
      </TouchableOpacity>
      {!collapsed && visibleAlerts.map((alert) => (
        <TouchableOpacity
          key={alert.id}
          style={[styles.alertRow, { borderTopColor: colors.error + '15' }]}
          onPress={() => {
            if (alert.type === 'overdue_invoice') {
              router.push({ pathname: '/(app)/invoices', params: { id: alert.entityId } } as any);
            } else if (alert.type === 'high_priority_task') {
              router.push({ pathname: '/(app)/tasks', params: { id: alert.entityId } } as any);
            } else if (alert.type === 'missed_deadline') {
              router.push({ pathname: '/(app)/project-detail', params: { id: alert.entityId } } as any);
            }
          }}
        >
          <Ionicons name={alert.icon} size={16} color={alert.color} />
          <View style={styles.alertContent}>
            <Text style={[styles.alertTitle, { color: colors.text }]} numberOfLines={1}>
              {alert.title}
            </Text>
            <Text style={[styles.alertSubtitle, { color: colors.textSecondary }]}>
              {alert.subtitle}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setDismissed((prev) => new Set(prev).add(alert.id))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>

  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerText: {
    fontSize: FontSizes.sm,
    fontWeight: '700',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  alertSubtitle: {
    fontSize: FontSizes.xs,
  },
});
