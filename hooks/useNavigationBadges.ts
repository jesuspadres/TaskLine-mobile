import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface BadgeCounts {
  requests: number;
  projects: number;
  tasks: number;
  notifications: number;
}

export function useNavigationBadges() {
  const [counts, setCounts] = useState<BadgeCounts>({
    requests: 0,
    projects: 0,
    tasks: 0,
    notifications: 0,
  });

  const fetchCounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all counts in parallel
      const [requestsResult, projectsResult, tasksResult, notificationsResult] = await Promise.all([
        // Count new requests (status = 'new')
        supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'new'),

        // Count projects pending approval
        supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending'),

        // Count high priority incomplete tasks
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('priority', 'high')
          .neq('status', 'completed'),

        // Count unread notifications
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false),
      ]);

      setCounts({
        requests: requestsResult.count || 0,
        projects: projectsResult.count || 0,
        tasks: tasksResult.count || 0,
        notifications: notificationsResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching badge counts:', error);
    }
  }, []);

  useEffect(() => {
    fetchCounts();

    // Set up real-time subscriptions
    const setupSubscriptions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Subscribe to requests changes
      const requestsChannel = supabase
        .channel('requests_badge_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'requests',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchCounts();
          }
        )
        .subscribe();

      // Subscribe to projects changes
      const projectsChannel = supabase
        .channel('projects_badge_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchCounts();
          }
        )
        .subscribe();

      // Subscribe to tasks changes
      const tasksChannel = supabase
        .channel('tasks_badge_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'tasks',
          },
          () => {
            fetchCounts();
          }
        )
        .subscribe();

      // Subscribe to notifications changes
      const notificationsChannel = supabase
        .channel('notifications_badge_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchCounts();
          }
        )
        .subscribe();

      return () => {
        requestsChannel.unsubscribe();
        projectsChannel.unsubscribe();
        tasksChannel.unsubscribe();
        notificationsChannel.unsubscribe();
      };
    };

    setupSubscriptions();
  }, [fetchCounts]);

  return {
    counts,
    refresh: fetchCounts,
  };
}
