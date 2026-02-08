import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

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

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

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

      const { data } = await query;
      setNotifications((data as unknown as Notification[]) || []);
    } catch {} finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.rpc('get_unread_notification_count');
      setUnreadCount(data || 0);
    } catch {}
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await (supabase.rpc as any)('mark_notification_read', {
        p_notification_id: notificationId,
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await supabase.rpc('mark_all_notifications_read');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  }, []);

  const archiveNotification = useCallback(async (notificationId: string) => {
    try {
      await (supabase.rpc as any)('archive_notification', {
        p_notification_id: notificationId,
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch {}
  }, []);

  const archiveAll = useCallback(async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_archived: true } as any)
        .eq('is_archived', false);
      setNotifications([]);
      setUnreadCount(0);
    } catch {}
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchUnreadCount();

    const channel = supabase
      .channel('notifications_changes')
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
    archiveAll,
  };
}
