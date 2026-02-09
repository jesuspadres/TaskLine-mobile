import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { ENV } from '@/lib/env';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { ListSkeleton, showToast } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';

interface RequestMessage {
  id: string;
  request_id: string;
  sender_type: 'freelancer' | 'client';
  message: string;
  created_at: string;
}

export default function RequestMessagesScreen() {
  const { id, clientName: clientNameParam, clientEmail: clientEmailParam } =
    useLocalSearchParams<{ id: string; clientName?: string; clientEmail?: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t, locale } = useTranslations();
  const haptics = useHaptics();
  const flatListRef = useRef<FlatList>(null);
  const dateLocale = locale === 'es' ? 'es-MX' : 'en-US';

  const clientName = clientNameParam ? decodeURIComponent(clientNameParam) : 'Client';
  const clientEmail = clientEmailParam ? decodeURIComponent(clientEmailParam) : null;

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // ================================================================
  // FETCH
  // ================================================================
  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('request_messages')
        .select('*')
        .eq('request_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data as RequestMessage[]) ?? []);
    } catch (error) {
      secureLog.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`request_messages:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'request_messages',
        filter: `request_id=eq.${id}`,
      }, (payload) => {
        const newMsg = payload.new as RequestMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ================================================================
  // ACTIONS
  // ================================================================
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id || !user) return;
    if (!clientEmail) {
      showToast('warning', t('requestDetail.noClientEmail'));
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showToast('error', t('requestDetail.sendError'));
        return;
      }

      const response = await fetch(
        `${ENV.APP_URL}/api/service-requests/${id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            requestType: 'custom',
            message: newMessage.trim(),
            clientEmail,
            clientName,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send message');
      }

      setNewMessage('');
      haptics.notification(Haptics.NotificationFeedbackType.Success);
      fetchMessages();
    } catch (error: any) {
      secureLog.error('Error sending message:', error);
      showToast('error', t('requestDetail.sendError'));
    } finally {
      setSending(false);
    }
  };

  // ================================================================
  // FORMATTING
  // ================================================================
  const formatMessageTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('requestDetail.justNow');
    if (diffMins < 60) return t('requestDetail.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('requestDetail.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('requestDetail.daysAgo', { count: diffDays });
    return date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }, [t, dateLocale]);

  // ================================================================
  // RENDER
  // ================================================================
  const renderMessage = useCallback(({ item }: { item: RequestMessage }) => {
    const isFreelancer = item.sender_type === 'freelancer';
    return (
      <View
        style={[
          styles.messageBubbleContainer,
          isFreelancer ? styles.messageBubbleRight : styles.messageBubbleLeft,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isFreelancer
              ? [styles.freelancerBubble, { backgroundColor: colors.primary }]
              : [styles.clientBubble, { backgroundColor: colors.surfaceSecondary }],
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isFreelancer ? { color: '#fff' } : { color: colors.text },
            ]}
          >
            {item.message}
          </Text>
        </View>
        <Text
          style={[
            styles.messageTime,
            { color: colors.textTertiary },
            isFreelancer ? styles.messageTimeRight : styles.messageTimeLeft,
          ]}
        >
          {isFreelancer ? t('requestDetail.you') : clientName}{' '}
          {'\u00B7'} {formatMessageTime(item.created_at)}
        </Text>
      </View>
    );
  }, [colors, clientName, t, formatMessageTime]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{clientName}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}><ListSkeleton /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{clientName}</Text>
          {messages.length > 0 && (
            <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
              {messages.length} {messages.length === 1 ? t('requestDetail.messagesSingular') : t('requestDetail.messages').toLowerCase()}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{t('requestDetail.noMessages')}</Text>
            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>{t('requestDetail.noMessagesDesc')}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => {
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
            }}
          />
        )}

        {/* Message Input */}
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary }]}>
            <TextInput
              style={[styles.messageInput, { color: colors.text }]}
              placeholder={t('requestDetail.messagePlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                !newMessage.trim() && { backgroundColor: colors.border },
              ]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sending}
            >
              <Ionicons
                name="send"
                size={18}
                color={newMessage.trim() ? '#fff' : colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40, height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '600' },
  headerSubtitle: { fontSize: FontSizes.xs },
  headerSpacer: { width: 40 },

  // Messages
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  messageBubbleContainer: { marginBottom: Spacing.md, maxWidth: '80%' },
  messageBubbleRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageBubbleLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  messageBubble: { borderRadius: BorderRadius.xl, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  freelancerBubble: { borderBottomRightRadius: Spacing.xs },
  clientBubble: { borderBottomLeftRadius: Spacing.xs },
  messageText: { fontSize: FontSizes.md, lineHeight: 22 },
  messageTime: { fontSize: FontSizes.xs, marginTop: Spacing.xs },
  messageTimeRight: { textAlign: 'right' },
  messageTimeLeft: { textAlign: 'left' },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
  },
  emptyTitle: { fontSize: FontSizes.md, fontWeight: '600', marginTop: Spacing.md },
  emptySubtext: { fontSize: FontSizes.sm, marginTop: Spacing.xs, textAlign: 'center' },

  // Input
  inputContainer: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'flex-end',
    borderRadius: BorderRadius.xl,
    paddingLeft: Spacing.lg, paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs, gap: Spacing.sm,
  },
  messageInput: { flex: 1, fontSize: FontSizes.md, maxHeight: 100, paddingVertical: Spacing.sm },
  sendButton: {
    width: 36, height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center', alignItems: 'center',
  },
});
