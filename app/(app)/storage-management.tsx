import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { secureLog } from '@/lib/security';
import { Spacing, FontSizes, BorderRadius } from '@/constants/theme';
import { ConfirmDialog, showToast } from '@/components';
import { useAuthStore } from '@/stores/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/hooks/useTranslations';
import { useHaptics } from '@/hooks/useHaptics';
import { useSubscription } from '@/hooks/useSubscription';
import { getPlan } from '@/lib/plans';

interface MediaFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  request_id: string | null;
  is_deleted: boolean;
  project_name: string | null;
  project_status: string | null;
  project_stage: string | null;
  client_name: string | null;
}

interface StorageInfo {
  used_bytes: number;
  total_bytes: number;
  file_count: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getStorageBarColor(used: number, total: number, colors: any): string {
  if (total <= 0) return colors.primary;
  const pct = (used / total) * 100;
  if (pct >= 90) return colors.error;
  if (pct >= 70) return colors.warning;
  return colors.success;
}

export default function StorageManagementScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const { t } = useTranslations();
  const haptics = useHaptics();
  const subscription = useSubscription();
  const plan = useMemo(() => getPlan(subscription.tier), [subscription.tier]);

  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<MediaFile | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const safeToDeleteFiles = useMemo(() =>
    files.filter(f =>
      f.project_status === 'archived' ||
      f.project_stage === 'completed' ||
      f.project_stage === 'invoiced'
    ),
    [files],
  );

  // Compute storage from files if RPC returned nothing useful
  const computeStorageFromFiles = useCallback((fileList: MediaFile[]) => {
    setStorageInfo(prev => {
      if (prev && prev.used_bytes > 0) return prev; // RPC data is good
      const totalUsed = fileList.reduce((sum, f) => sum + (f.file_size || 0), 0);
      return {
        used_bytes: totalUsed,
        total_bytes: prev?.total_bytes || 0,
        file_count: fileList.length,
      };
    });
  }, []);

  const fetchStorageInfo = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await (supabase.rpc as any)('get_storage_info', {
        p_user_id: user.id,
      });
      // RPC may return a single object or an array with one element
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setStorageInfo({
          used_bytes: row.used_bytes || 0,
          total_bytes: row.total_bytes || row.limit_bytes || 0,
          file_count: row.file_count || 0,
        });
      }
    } catch {
      // RPC may not exist
    }
  }, [user?.id]);

  const fetchFiles = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: filesData, error: filesError } = await (supabase
        .from('request_media_files') as any)
        .select(`
          *,
          requests!request_media_files_request_id_fkey (
            id,
            name,
            client_id,
            clients!requests_client_id_fkey (
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .eq('is_deleted', false);

      if (filesError) throw filesError;

      // Get request IDs that have files
      const requestIds = [...new Set(
        (filesData || []).map((f: any) => f.request_id).filter(Boolean),
      )];

      // Fetch projects linked to these requests
      let projectsByRequest: Record<string, { name: string; status: string; project_stage: string }> = {};
      if (requestIds.length > 0) {
        const { data: projectsData } = await (supabase
          .from('projects') as any)
          .select('request_id, name, status, project_stage')
          .in('request_id', requestIds);

        if (projectsData) {
          projectsByRequest = projectsData.reduce((acc: any, p: any) => {
            if (p.request_id) {
              acc[p.request_id] = { name: p.name, status: p.status, project_stage: p.project_stage };
            }
            return acc;
          }, {} as Record<string, any>);
        }
      }

      const transformed: MediaFile[] = (filesData || []).map((file: any) => {
        const project = file.request_id ? projectsByRequest[file.request_id] : null;
        const clientName = file.requests?.clients?.name || null;
        return {
          id: file.id,
          file_name: file.file_name,
          file_path: file.file_path,
          file_size: file.file_size,
          mime_type: file.mime_type,
          uploaded_at: file.uploaded_at,
          request_id: file.request_id,
          is_deleted: file.is_deleted,
          project_name: project?.name || null,
          project_status: project?.status || null,
          project_stage: project?.project_stage || null,
          client_name: clientName,
        };
      });

      // Sort: safe-to-delete first, then newest first
      transformed.sort((a, b) => {
        const aCompleted = a.project_status === 'archived' || a.project_stage === 'completed' || a.project_stage === 'invoiced';
        const bCompleted = b.project_status === 'archived' || b.project_stage === 'completed' || b.project_stage === 'invoiced';
        if (aCompleted && !bCompleted) return -1;
        if (!aCompleted && bCompleted) return 1;
        return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      });

      setFiles(transformed);
      computeStorageFromFiles(transformed);
    } catch (err: any) {
      secureLog.error('Failed to fetch files:', err);
    }
  }, [user?.id, computeStorageFromFiles]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStorageInfo(), fetchFiles()]);
    setLoading(false);
  }, [fetchStorageInfo, fetchFiles]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchStorageInfo(), fetchFiles()]);
    setRefreshing(false);
  }, [fetchStorageInfo, fetchFiles]);

  const handleDeleteFile = useCallback(async (file: MediaFile) => {
    if (!user?.id) return;
    setDeleting(file.id);
    try {
      // Delete from storage bucket
      await supabase.storage.from('request-media').remove([file.file_path]);

      // Delete from database
      const { error: dbError } = await (supabase
        .from('request_media_files') as any)
        .delete()
        .eq('id', file.id)
        .eq('user_id', user.id);
      if (dbError) throw dbError;

      // Update storage usage
      await (supabase.rpc as any)('update_storage_usage', {
        p_user_id: user.id,
        p_size_change: -file.file_size,
      });

      // Refresh
      await Promise.all([fetchStorageInfo(), fetchFiles()]);
      showToast('success', t('storageManagement.fileDeleted'));
    } catch (err: any) {
      secureLog.error('Delete failed:', err);
      showToast('error', t('storageManagement.deleteFailed'));
    } finally {
      setDeleting(null);
      setConfirmDeleteFile(null);
    }
  }, [user?.id, fetchStorageInfo, fetchFiles, t]);

  const handleBulkDelete = useCallback(async (filesToDelete: MediaFile[]) => {
    if (!user?.id || filesToDelete.length === 0) return;
    setBulkDeleting(true);
    let deleted = 0;
    try {
      for (const file of filesToDelete) {
        try {
          await supabase.storage.from('request-media').remove([file.file_path]);
          await (supabase.from('request_media_files') as any)
            .delete()
            .eq('id', file.id)
            .eq('user_id', user.id);
          await (supabase.rpc as any)('update_storage_usage', {
            p_user_id: user.id,
            p_size_change: -file.file_size,
          });
          deleted++;
        } catch {
          // Continue with next file
        }
      }
      await Promise.all([fetchStorageInfo(), fetchFiles()]);
      setSelectedFiles(new Set());
      showToast('success', t('storageManagement.filesDeleted', { count: String(deleted) }));
    } catch (err: any) {
      secureLog.error('Bulk delete failed:', err);
      showToast('error', t('storageManagement.deleteFailed'));
    } finally {
      setBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  }, [user?.id, fetchStorageInfo, fetchFiles, t]);

  const toggleSelection = useCallback((fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const isSafeToDelete = (file: MediaFile) =>
    file.project_status === 'archived' ||
    file.project_stage === 'completed' ||
    file.project_stage === 'invoiced';

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('request-media').getPublicUrl(filePath);
    return data?.publicUrl || '';
  };

  // ================================================================
  // RENDER
  // ================================================================

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('storageManagement.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('storageManagement.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Storage Usage Card */}
        {storageInfo && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.usageRow}>
              <Text style={[styles.usageLabel, { color: colors.text }]}>{t('storageManagement.storageUsed')}</Text>
              <Text style={[styles.usageValue, { color: colors.text }]}>
                {formatBytes(storageInfo.used_bytes)} / {plan.features.storage}
              </Text>
            </View>
            <View style={[styles.barBg, { backgroundColor: colors.surfaceSecondary }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: getStorageBarColor(storageInfo.used_bytes, storageInfo.total_bytes, colors),
                    width: storageInfo.total_bytes > 0
                      ? `${Math.min((storageInfo.used_bytes / storageInfo.total_bytes) * 100, 100)}%`
                      : '0%',
                  },
                ]}
              />
            </View>
            <Text style={[styles.fileCount, { color: colors.textTertiary }]}>
              {storageInfo.file_count} {t('settings.storageFiles')}
            </Text>
          </View>
        )}

        {/* Bulk Actions */}
        {files.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {safeToDeleteFiles.length > 0 && (
              <TouchableOpacity
                style={[styles.bulkAction, { borderColor: colors.warning }]}
                onPress={() => {
                  haptics.impact();
                  setSelectedFiles(new Set(safeToDeleteFiles.map(f => f.id)));
                  setConfirmBulkDelete(true);
                }}
              >
                <Ionicons name="trash-outline" size={18} color={colors.warning} />
                <Text style={[styles.bulkActionText, { color: colors.warning }]}>
                  {t('storageManagement.deleteSafe', { count: String(safeToDeleteFiles.length) })}
                </Text>
              </TouchableOpacity>
            )}
            {selectedFiles.size > 0 && (
              <TouchableOpacity
                style={[styles.bulkAction, { borderColor: colors.error, marginTop: safeToDeleteFiles.length > 0 ? Spacing.sm : 0 }]}
                onPress={() => {
                  haptics.impact();
                  setConfirmBulkDelete(true);
                }}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                )}
                <Text style={[styles.bulkActionText, { color: colors.error }]}>
                  {t('storageManagement.deleteSelected', { count: String(selectedFiles.size) })}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* File List */}
        {files.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('storageManagement.noFiles')}</Text>
            <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>{t('storageManagement.noFilesDesc')}</Text>
          </View>
        ) : (
          files.map((file) => {
            const isSelected = selectedFiles.has(file.id);
            const safe = isSafeToDelete(file);
            const isDeleting = deleting === file.id;
            const publicUrl = getPublicUrl(file.file_path);

            return (
              <TouchableOpacity
                key={file.id}
                style={[
                  styles.fileCard,
                  { backgroundColor: colors.surface, borderColor: isSelected ? colors.primary : colors.border },
                  isSelected && { borderWidth: 2 },
                ]}
                onPress={() => toggleSelection(file.id)}
                onLongPress={() => {
                  haptics.impact();
                  toggleSelection(file.id);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.fileRow}>
                  {/* Thumbnail */}
                  <View style={[styles.thumbnail, { backgroundColor: colors.surfaceSecondary }]}>
                    {file.mime_type?.startsWith('image/') && publicUrl ? (
                      <Image source={{ uri: publicUrl }} style={styles.thumbnailImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="document-outline" size={24} color={colors.textTertiary} />
                    )}
                  </View>

                  {/* File Info */}
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                      {file.file_name}
                    </Text>
                    <Text style={[styles.fileMeta, { color: colors.textTertiary }]}>
                      {formatBytes(file.file_size)} · {new Date(file.uploaded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                    {file.client_name && (
                      <Text style={[styles.fileMeta, { color: colors.textTertiary }]} numberOfLines={1}>
                        {file.client_name}{file.project_name ? ` · ${file.project_name}` : ''}
                      </Text>
                    )}
                  </View>

                  {/* Badges + Delete */}
                  <View style={styles.fileActions}>
                    {safe && (
                      <View style={[styles.safeBadge, { backgroundColor: colors.successLight }]}>
                        <Text style={[styles.safeBadgeText, { color: colors.success }]}>
                          {t('storageManagement.safe')}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={[styles.deleteBtn, { backgroundColor: `${colors.error}14` }]}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        haptics.impact();
                        setConfirmDeleteFile(file);
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>

      {/* Single file delete confirm */}
      <ConfirmDialog
        visible={!!confirmDeleteFile}
        title={t('storageManagement.deleteFileTitle')}
        message={t('storageManagement.deleteFileMessage', { name: confirmDeleteFile?.file_name || '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={() => confirmDeleteFile && handleDeleteFile(confirmDeleteFile)}
        onCancel={() => setConfirmDeleteFile(null)}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        visible={confirmBulkDelete}
        title={t('storageManagement.bulkDeleteTitle')}
        message={t('storageManagement.bulkDeleteMessage', { count: String(selectedFiles.size) })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={() => {
          const filesToDelete = files.filter(f => selectedFiles.has(f.id));
          handleBulkDelete(filesToDelete);
        }}
        onCancel={() => setConfirmBulkDelete(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40, height: 40, borderRadius: BorderRadius.lg,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: '700', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },

  // Storage bar
  card: {
    padding: Spacing.lg, borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.md,
  },
  usageRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm,
  },
  usageLabel: { fontSize: FontSizes.sm, fontWeight: '600' },
  usageValue: { fontSize: FontSizes.sm, fontWeight: '700' },
  barBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  fileCount: { fontSize: FontSizes.xs, marginTop: Spacing.xs },

  // Bulk actions
  bulkAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg, borderWidth: 1,
  },
  bulkActionText: { fontSize: FontSizes.sm, fontWeight: '600' },

  // Empty state
  emptyContainer: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
  emptyTitle: { fontSize: FontSizes.lg, fontWeight: '700', marginTop: Spacing.md },
  emptyDesc: { fontSize: FontSizes.sm, marginTop: Spacing.xs, textAlign: 'center' },

  // File cards
  fileCard: {
    padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 1, marginBottom: Spacing.sm,
  },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumbnail: {
    width: 48, height: 48, borderRadius: BorderRadius.lg,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  thumbnailImage: { width: '100%', height: '100%' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: FontSizes.sm, fontWeight: '600' },
  fileMeta: { fontSize: FontSizes.xs, marginTop: 2 },
  fileActions: { alignItems: 'flex-end', gap: Spacing.xs },
  safeBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full,
  },
  safeBadgeText: { fontSize: 10, fontWeight: '700' },
  deleteBtn: {
    width: 36, height: 36, borderRadius: BorderRadius.lg,
    justifyContent: 'center', alignItems: 'center',
  },
});
