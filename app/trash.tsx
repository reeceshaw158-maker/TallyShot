/**
 * Trash / Recently Deleted screen.
 * Receipts stay here for 30 days, then are auto-purged.
 * The user can restore or permanently delete individual items.
 */
import { useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, Alert,
  StatusBar, ActivityIndicator, Image,
} from 'react-native';
import { Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTrashedReceipts, restoreFromTrash, permanentlyDeleteReceipt, purgeOldTrash } from '../src/db/receipts';
import { Receipt } from '../src/types';
import { useThemeTokens, useActiveScheme } from '../src/theme';

function daysLeft(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime();
  const purgeAt = deleted + 30 * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

export default function TrashScreen() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const insets = useSafeAreaInsets();

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await purgeOldTrash();
      const data = await getTrashedReceipts();
      setReceipts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRestore = async (id: number) => {
    await restoreFromTrash(id);
    load();
  };

  const handleDelete = (id: number) => {
    Alert.alert(
      'Delete forever?',
      'This receipt will be permanently removed and cannot be recovered.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await permanentlyDeleteReceipt(id);
            load();
          },
        },
      ]
    );
  };

  const handleEmptyTrash = () => {
    if (receipts.length === 0) return;
    Alert.alert(
      'Empty trash?',
      `This will permanently delete all ${receipts.length} receipt${receipts.length !== 1 ? 's' : ''} in trash. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty trash',
          style: 'destructive',
          onPress: async () => {
            for (const r of receipts) await permanentlyDeleteReceipt(r.id);
            load();
          },
        },
      ]
    );
  };

  const fmt = (amount: number, currency: string) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: 52 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: t.textPrimary }]}>Recently Deleted</Text>
        {receipts.length > 0 && (
          <TouchableOpacity onPress={handleEmptyTrash} hitSlop={8}>
            <Text style={[styles.emptyBtn, { color: t.danger ?? t.danger }]}>Empty</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Info banner */}
      <View style={[styles.infoBanner, { backgroundColor: t.surfaceElevated ?? t.surface, borderColor: t.border }]}>
        <MaterialCommunityIcons name="information-outline" size={16} color={t.textMuted} />
        <Text style={[styles.infoText, { color: t.textMuted }]}>
          Receipts are deleted permanently after 30 days.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={t.cta} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={receipts.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="delete-off-outline" size={52} color={t.textSubtle} />
              <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>Trash is empty</Text>
              <Text style={[styles.emptyBody, { color: t.textMuted }]}>
                Deleted receipts appear here for 30 days before being removed permanently.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const days = item.deleted_at ? daysLeft(item.deleted_at) : 30;
            const urgent = days <= 3;
            return (
              <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
                {/* Thumbnail */}
                {item.image_uri ? (
                  <Image source={{ uri: item.image_uri }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: t.surfaceElevated ?? t.surface }]}>
                    <MaterialCommunityIcons name="receipt-text-outline" size={22} color={t.textSubtle} />
                  </View>
                )}

                {/* Details */}
                <View style={styles.cardMid}>
                  <Text style={[styles.cardMerchant, { color: t.textPrimary }]} numberOfLines={1}>
                    {item.merchant || 'Unknown merchant'}
                  </Text>
                  <Text style={[styles.cardMeta, { color: t.textMuted }]}>
                    {item.date} · {fmt(item.total, item.currency)}
                  </Text>
                  <Text style={[styles.cardDays, { color: urgent ? t.danger : t.textSubtle }]}>
                    {days === 0 ? 'Deletes today' : `${days} day${days !== 1 ? 's' : ''} left`}
                  </Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => handleRestore(item.id)}
                    style={[styles.actionBtn, { backgroundColor: t.cta + '18' }]}
                    hitSlop={4}
                  >
                    <MaterialCommunityIcons name="restore" size={18} color={t.cta} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(item.id)}
                    style={[styles.actionBtn, { backgroundColor: t.dangerBg }]}
                    hitSlop={4}
                  >
                    <MaterialCommunityIcons name="delete-forever-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  backBtn: { marginRight: 4 },
  pageTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 24, letterSpacing: -0.5, flex: 1 },
  emptyBtn: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
  },
  infoText: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 12, marginBottom: 8,
    borderRadius: 14, borderWidth: 1, padding: 12, gap: 12,
  },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardMid: { flex: 1 },
  cardMerchant: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 2 },
  cardMeta: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  cardDays: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
