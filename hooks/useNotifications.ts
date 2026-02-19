import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { secureLog } from '@/lib/security';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  triggered_by_name: string | null;
}

let channelCounter = 0;

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const channelIdRef = useRef(++channelCounter);

  const fetchNotifications = useCallback(async (filter: 'all' | 'unread' = 'all') => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) {
        secureLog.error('Failed to fetch notifications:', error.message);
      } else {
        setNotifications((data as unknown as Notification[]) || []);
      }
    } catch (err) {
      secureLog.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      // Use direct count query — more reliable than RPC
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .eq('is_archived', false);

      if (error) {
        secureLog.error('Failed to fetch unread count:', error.message);
        return;
      }
      setUnreadCount(count || 0);
    } catch (err) {
      secureLog.error('Unread count error:', err);
    }
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true } as any)
        .eq('id', notificationId);

      if (error) {
        secureLog.error('Failed to mark notification as read:', error.message);
        return;
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      secureLog.error('Mark as read error:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true } as any)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (error) {
        secureLog.error('Failed to mark all as read:', error.message);
        return;
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      secureLog.error('Mark all as read error:', err);
    }
  }, []);

  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true } as any)
        .eq('id', notificationId);

      if (error) {
        secureLog.error('Failed to archive notification:', error.message);
        return;
      }
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      secureLog.error('Archive notification error:', err);
    }
  }, []);

  const archiveAllRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true } as any)
        .eq('is_archived', false)
        .eq('is_read', true);

      if (error) {
        secureLog.error('Failed to archive read notifications:', error.message);
        return;
      }
      setNotifications((prev) => prev.filter((n) => !n.is_read));
    } catch (err) {
      secureLog.error('Archive all read error:', err);
    }
  }, []);

  const archiveAll = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_archived: true } as any)
        .eq('is_archived', false);

      if (error) {
        secureLog.error('Failed to archive all notifications:', error.message);
        return;
      }
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      secureLog.error('Archive all error:', err);
    }
  }, []);

  // Refresh when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && user) {
        fetchNotifications();
        fetchUnreadCount();
      }
    });
    return () => subscription.remove();
  }, [fetchNotifications, fetchUnreadCount, user]);

  // Set up real-time subscription with unique channel name per hook instance
  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchUnreadCount();

    const channelName = `notifications_${user.id}_${channelIdRef.current}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    archiveAllRead,
    archiveAll,
  };
}
