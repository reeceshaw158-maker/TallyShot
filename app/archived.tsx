import { useCallback, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getArchivedReceipts,
  restoreReceipt,
  permanentlyDeleteReceipt,
} from '../src/db/receipts';
import { Receipt } from '../src/types';
import { useThemeTokens, SemanticTokens } from '../src/theme';

/**
 * Archived Receipts. Shown from Settings → Archived Receipts.
 *
 * Counters Dext's "no way to access archived receipts" review pattern.
 * Default delete throughout the app is now soft-delete (archive); this
 * screen is the only place a user can hard-delete a receipt's photo + row.
 */
export default function ArchivedScreen() {
  const t = useThemeTokens();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    getArchivedReceipts()
      .then(setReceipts)
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const handleRestore = (r: Receipt) => {
    Alert.alert(
      'Restore receipt?',
      `${r.merchant || 'This receipt'} will return to your active list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            await restoreReceipt(r.id);
            reload();
          },
        },
      ]
    );
  };

  const handlePermanentDelete = (r: Receipt) => {
    Alert.alert(
      'Permanently delete?',
      `This deletes the receipt row and its photo. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: () => {
            // Two-step: extra confirm for an irreversible action.
            Alert.alert(
              'Are you sure?',
              `${r.merchant || 'This receipt'} will be gone for good.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, delete forever',
                  style: 'destructive',
                  onPress: async () => {
                    await permanentlyDeleteReceipt(r.id);
                    reload();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const fmt = (r: Receipt) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: r.currency }).format(r.total);
    } catch {
      return `${r.currency} ${r.total.toFixed(2)}`;
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.intro, { color: t.textMuted }]}>
        Receipts you archived stay here until you restore or permanently delete them. Photos are kept on your device.
      </Text>

      {!loading && receipts.length === 0 && (
        <View style={[styles.emptyCard, { backgroundColor: t.surface, borderColor: t.border }]}>
          <MaterialCommunityIcons name="archive-outline" size={32} color={t.textSubtle} />
          <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>Nothing archived</Text>
          <Text style={[styles.emptyBody, { color: t.textMuted }]}>
            When you archive a receipt it'll appear here so you can bring it back any time.
          </Text>
        </View>
      )}

      {receipts.map((r) => (
        <ArchivedRow
          key={r.id}
          receipt={r}
          tokens={t}
          fmt={fmt}
          onRestore={() => handleRestore(r)}
          onPermanentDelete={() => handlePermanentDelete(r)}
        />
      ))}
    </ScrollView>
  );
}

function ArchivedRow({
  receipt,
  tokens,
  fmt,
  onRestore,
  onPermanentDelete,
}: {
  receipt: Receipt;
  tokens: SemanticTokens;
  fmt: (r: Receipt) => string;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <View style={styles.cardHeader}>
        {receipt.image_uri ? (
          <Image source={{ uri: receipt.image_uri }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: tokens.surfaceElevated }]}>
            <MaterialCommunityIcons name="image-off-outline" size={20} color={tokens.textSubtle} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.merchant, { color: tokens.textPrimary }]} numberOfLines={1}>
            {receipt.merchant || 'Untitled receipt'}
          </Text>
          <Text style={[styles.meta, { color: tokens.textMuted }]} numberOfLines={1}>
            {receipt.date} · {fmt(receipt)}
          </Text>
          {receipt.archived_at && (
            <Text style={[styles.archivedMeta, { color: tokens.textSubtle }]}>
              Archived {new Date(receipt.archived_at).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
      <View style={[styles.actionRow, { borderTopColor: tokens.border }]}>
        <TouchableOpacity onPress={onRestore} style={styles.actionBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="restore" size={18} color={tokens.accent} />
          <Text style={[styles.actionText, { color: tokens.accent }]}>Restore</Text>
        </TouchableOpacity>
        <View style={[styles.actionDivider, { backgroundColor: tokens.border }]} />
        <TouchableOpacity onPress={onPermanentDelete} style={styles.actionBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="delete-forever-outline" size={18} color={tokens.danger} />
          <Text style={[styles.actionText, { color: tokens.danger }]}>Delete forever</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, marginBottom: 4 },

  emptyCard: {
    borderRadius: 16, borderWidth: 1, padding: 24,
    alignItems: 'center', gap: 8,
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, marginTop: 4 },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, textAlign: 'center' },

  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  merchant: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2 },
  meta: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 2 },
  archivedMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 },

  actionRow: {
    flexDirection: 'row', alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  actionDivider: { width: StyleSheet.hairlineWidth },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
});
