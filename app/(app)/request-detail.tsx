import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { Button, Badge, EmptyState } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import type { Client } from '@/lib/database.types';

interface RequestWithClient {
  id: string;
  user_id: string;
  client_id: string;
  title: string;
  description: string | null;
  budget: string | null;
  deadline: string | null;
  status: 'new' | 'reviewing' | 'converted' | 'declined';
  files: string[] | null;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string; email: string };
}

interface RequestMessage {
  id: string;
  request_id: string;
  sender_type: 'freelancer' | 'client';
  message: string;
  created_at: string;
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors, isDark } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const statusColors: Record<string, { bg: string; text: string }> = {
    new: { bg: colors.statusNew + '20', text: colors.statusNew },
    reviewing: { bg: colors.warningLight, text: colors.warning },
    converted: { bg: colors.successLight, text: colors.success },
    declined: { bg: colors.surfaceSecondary, text: colors.textTertiary },
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [request, setRequest] = useState<RequestWithClient | null>(null);
  const [messages, setMessages] = useState<RequestMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchRequest = useCallback(async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*, client:clients(id, name, email)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setRequest(data);
    } catch (error) {
      console.error('Error fetching request:', error);
      Alert.alert('Error', 'Failed to load request details');
    }
  }, [id]);

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
      console.error('Error fetching messages:', error);
    }
  }, [id]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchRequest(), fetchMessages()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchRequest, fetchMessages]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Real-time subscription for messages
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`request_messages:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'request_messages',
          filter: `request_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new as RequestMessage;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Scroll to bottom on new message
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !id || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from('request_messages').insert({
        request_id: id,
        sender_type: 'freelancer',
        message: newMessage.trim(),
      });

      if (error) throw error;

      setNewMessage('');
      // Fetch messages to ensure we have the latest
      fetchMessages();
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'reviewing' | 'converted' | 'declined') => {
    if (!request) return;

    const statusLabels: Record<string, string> = {
      reviewing: 'Review',
      converted: 'Accept',
      declined: 'Decline',
    };

    Alert.alert(
      `${statusLabels[newStatus]} Request`,
      `Are you sure you want to ${statusLabels[newStatus].toLowerCase()} this request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: statusLabels[newStatus],
          style: newStatus === 'declined' ? 'destructive' : 'default',
          onPress: async () => {
            setUpdatingStatus(true);
            try {
              const { error } = await supabase
                .from('requests')
                .update({ status: newStatus })
                .eq('id', request.id);

              if (error) throw error;

              setRequest({ ...request, status: newStatus });
              Alert.alert('Success', `Request ${newStatus === 'reviewing' ? 'moved to review' : newStatus}`);
            } catch (error: any) {
              console.error('Error updating request status:', error);
              Alert.alert('Error', error.message || 'Failed to update request');
            } finally {
              setUpdatingStatus(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Request Detail</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState
          icon="mail-outline"
          title="Request not found"
          description="This request may have been deleted."
        />
      </SafeAreaView>
    );
  }

  const reqColors = statusColors[request.status] || statusColors.new;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Request Detail</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Request Info Card */}
          <View style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.requestHeader}>
              <Text style={[styles.requestTitle, { color: colors.text }]}>{request.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: reqColors.bg }]}>
                <Text style={[styles.statusText, { color: reqColors.text }]}>
                  {request.status}
                </Text>
              </View>
            </View>

            {request.description && (
              <Text style={[styles.requestDescription, { color: colors.textSecondary }]}>{request.description}</Text>
            )}

            <View style={[styles.requestDetails, { borderTopColor: colors.borderLight }]}>
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Client</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {request.client?.name || 'Unknown'}
                </Text>
              </View>

              {request.client?.email && (
                <View style={styles.detailRow}>
                  <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Email</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{request.client.email}</Text>
                </View>
              )}

              {request.budget && (
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={16} color={colors.textTertiary} />
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Budget</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{request.budget}</Text>
                </View>
              )}

              {request.deadline && (
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Deadline</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(request.deadline)}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
                <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Created</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(request.created_at)}</Text>
              </View>
            </View>

            {/* Status Action Buttons */}
            {request.status !== 'converted' && request.status !== 'declined' && (
              <View style={[styles.statusActions, { borderTopColor: colors.borderLight }]}>
                {request.status === 'new' && (
                  <Button
                    title="Review"
                    onPress={() => handleUpdateStatus('reviewing')}
                    variant="secondary"
                    loading={updatingStatus}
                    style={styles.statusActionButton}
                  />
                )}
                {(request.status === 'new' || request.status === 'reviewing') && (
                  <>
                    <Button
                      title="Accept"
                      onPress={() => handleUpdateStatus('converted')}
                      loading={updatingStatus}
                      style={styles.statusActionButton}
                    />
                    <Button
                      title="Decline"
                      onPress={() => handleUpdateStatus('declined')}
                      variant="danger"
                      loading={updatingStatus}
                      style={styles.statusActionButton}
                    />
                  </>
                )}
              </View>
            )}
          </View>

          {/* Messages Section */}
          <View style={styles.messagesSection}>
            <Text style={[styles.messagesSectionTitle, { color: colors.text }]}>Messages</Text>

            {messages.length === 0 ? (
              <View style={[styles.noMessagesContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="chatbubbles-outline" size={32} color={colors.textTertiary} />
                <Text style={[styles.noMessagesText, { color: colors.textSecondary }]}>No messages yet</Text>
                <Text style={[styles.noMessagesSubtext, { color: colors.textTertiary }]}>
                  Send a message to start the conversation
                </Text>
              </View>
            ) : (
              messages.map((msg) => {
                const isFreelancer = msg.sender_type === 'freelancer';

                return (
                  <View
                    key={msg.id}
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
                          isFreelancer
                            ? styles.freelancerMessageText
                            : [styles.clientMessageText, { color: colors.text }],
                        ]}
                      >
                        {msg.message}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.messageTime,
                        { color: colors.textTertiary },
                        isFreelancer ? styles.messageTimeRight : styles.messageTimeLeft,
                      ]}
                    >
                      {isFreelancer ? 'You' : request.client?.name || 'Client'}{' '}
                      {'\u00B7'} {formatMessageTime(msg.created_at)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>

        {/* Message Input */}
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceSecondary }]}>
            <TextInput
              style={[styles.messageInput, { color: colors.text }]}
              placeholder="Type a message..."
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
                !newMessage.trim() && [styles.sendButtonDisabled, { backgroundColor: colors.border }],
              ]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={newMessage.trim() ? '#fff' : colors.textTertiary}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  requestCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  requestTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  requestDescription: {
    fontSize: FontSizes.md,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  requestDetails: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailLabel: {
    fontSize: FontSizes.sm,
    width: 60,
  },
  detailValue: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    flex: 1,
  },
  statusActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  statusActionButton: {
    flex: 1,
  },
  messagesSection: {
    marginBottom: Spacing.md,
  },
  messagesSectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  noMessagesContainer: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  noMessagesText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  noMessagesSubtext: {
    fontSize: FontSizes.sm,
    marginTop: Spacing.xs,
  },
  messageBubbleContainer: {
    marginBottom: Spacing.md,
    maxWidth: '80%',
  },
  messageBubbleRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageBubbleLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageBubble: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  freelancerBubble: {
    borderBottomRightRadius: Spacing.xs,
  },
  clientBubble: {
    borderBottomLeftRadius: Spacing.xs,
  },
  messageText: {
    fontSize: FontSizes.md,
    lineHeight: 22,
  },
  freelancerMessageText: {
    color: '#fff',
  },
  clientMessageText: {
    // color set via inline style
  },
  messageTime: {
    fontSize: FontSizes.xs,
    marginTop: Spacing.xs,
  },
  messageTimeRight: {
    textAlign: 'right',
  },
  messageTimeLeft: {
    textAlign: 'left',
  },
  inputContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: BorderRadius.xl,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  messageInput: {
    flex: 1,
    fontSize: FontSizes.md,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    // backgroundColor set via inline style
  },
});
