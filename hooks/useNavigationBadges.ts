import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { secureLog } from '@/lib/security';

interface BadgeCounts {
  requests: number;
  projects: number;
  tasks: number;
  notifications: number;
}

export function useNavigationBadges() {
  const user = useAuthStore((s) => s.user);
  const [counts, setCounts] = useState<BadgeCounts>({
    requests: 0,
    projects: 0,
    tasks: 0,
    notifications: 0,
  });
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    try {
      const [requestsResult, projectsResult, tasksResult, notificationsResult] = await Promise.all([
        supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'new'),
        supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending'),
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('priority', 'high')
          .neq('status', 'completed'),
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('is_archived', false),
      ]);

      setCounts({
        requests: requestsResult.count || 0,
        projects: projectsResult.count || 0,
        tasks: tasksResult.count || 0,
        notifications: notificationsResult.count || 0,
      });
    } catch (error) {
      secureLog.error('Error fetching badge counts:', error);
    }
  }, [user]);

  // Refresh counts when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && user) {
        fetchCounts();
      }
    });
    return () => subscription.remove();
  }, [fetchCounts, user]);

  useEffect(() => {
    if (!user) return;

    fetchCounts();

    // Clean up any existing channels before creating new ones
    channelsRef.current.forEach((ch) => ch.unsubscribe());
    channelsRef.current = [];

    const requestsChannel = supabase
      .channel(`requests_badge_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchCounts()
      )
      .subscribe();

    const projectsChannel = supabase
      .channel(`projects_badge_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchCounts()
      )
      .subscribe();

    const tasksChannel = supabase
      .channel(`tasks_badge_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => fetchCounts()
      )
      .subscribe();

    const notificationsChannel = supabase
      .channel(`notifications_badge_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchCounts()
      )
      .subscribe();

    channelsRef.current = [requestsChannel, projectsChannel, tasksChannel, notificationsChannel];

    return () => {
      channelsRef.current.forEach((ch) => ch.unsubscribe());
      channelsRef.current = [];
    };
  }, [user, fetchCounts]);

  return {
    counts,
    refresh: fetchCounts,
  };
}
