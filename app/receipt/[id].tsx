import { useState, useCallback } from 'react';
import { View, ScrollView, Image, StyleSheet, Alert, TouchableOpacity, Pressable } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getReceipt,
  archiveReceipt,
  updateReceipt,
  setReceiptStatus,
  recordExtractionFeedback,
} from '../../src/db/receipts';
import { extractReceiptData } from '../../src/services/extraction';
import { Receipt } from '../../src/types';
import { useThemeTokens } from '../../src/theme';
import { useAppStore } from '../../src/stores/appStore';
import { ReceiptStatusPill } from '../../src/components/ReceiptStatusPill';
import { CATEGORY_ICONS } from '../../src/constants';
import { hapticHeavy } from '../../src/utils/haptics';

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [retrying, setRetrying] = useState(false);
  const t = useThemeTokens();
  const taxMode = useAppStore((s) => s.taxMode);
  const taxLabel = useAppStore((s) => s.taxLabel);
  const summaryMode = useAppStore((s) => s.summaryMode);
  const setSummaryMode = useAppStore((s) => s.setSummaryMode);
  const setPendingDeletion = useAppStore((s) => s.setPendingDeletion);
  // In totals mode line items default collapsed; user can still expand them.
  // In line-items mode the section is always open.
  const [lineItemsExpanded, setLineItemsExpanded] = useState(false);

  // Long-press on any extracted field flags it as wrong. We persist the
  // feedback locally — future versions will surface it for fine-tuning, and
  // we may add a "send anonymised feedback" toggle to Settings later.
  const handleFieldFeedback = (field: string, extracted: string | number | null | undefined) => {
    if (!receipt) return;
    Alert.alert(
      'Mark as wrong?',
      `We'll note that the AI got "${field}" wrong on this receipt and tap that signal for future improvements. Edit the field with a tap to fix the value.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark wrong',
          style: 'destructive',
          onPress: () => {
            recordExtractionFeedback({
              receiptId: receipt.id,
              field,
              extractedValue: extracted ?? null,
            }).catch(() => {});
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      getReceipt(Number(id)).then(setReceipt);
    }, [id])
  );

  if (!receipt) {
    return <View style={{ flex: 1, backgroundColor: t.background }} />;
  }

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: receipt.currency }).format(n);
    } catch {
      return `${receipt.currency} ${n.toFixed(2)}`;
    }
  };

  const handleArchive = () => {
    Alert.alert(
      'Archive receipt?',
      'It will be hidden from your lists. You can restore it any time from Settings → Archived Receipts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          onPress: async () => {
            await archiveReceipt(receipt.id);
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  /**
   * Hard delete — trash icon in the header. Archives immediately so the
   * receipt disappears from lists, then shows a 5-second undo snackbar on
   * the receipts list. After 5 s the list permanently deletes it.
   *
   * TODO v1.1: if the receipt is synced to cloud, cancel the remote record
   * here too (after the undo window expires).
   */
  const handleHardDelete = () => {
    hapticHeavy();
    Alert.alert(
      'Delete receipt?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await archiveReceipt(receipt.id);
            setPendingDeletion({
              ids: [receipt.id],
              label: `${receipt.merchant || 'Receipt'} deleted`,
            });
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const handleRetry = async () => {
    if (!receipt.image_uri) {
      Alert.alert('No image', 'This receipt has no photo to re-scan.');
      return;
    }
    setRetrying(true);
    try {
      const result = await extractReceiptData(receipt.image_uri, taxMode, taxLabel);
      await updateReceipt(receipt.id, {
        merchant: result.merchant ?? receipt.merchant,
        date: result.date ?? receipt.date,
        currency: result.currency ?? receipt.currency,
        subtotal: result.subtotal ?? receipt.subtotal,
        tax: result.tax ?? receipt.tax,
        total: result.total ?? receipt.total,
        payment_method: result.payment_method ?? receipt.payment_method,
        invoice_number: result.invoice_number ?? receipt.invoice_number,
        category: (result.suggested_category as any) ?? receipt.category,
      });
      await setReceiptStatus(receipt.id, 'complete');
      const updated = await getReceipt(receipt.id);
      setReceipt(updated);
      Alert.alert('Done', 'Receipt updated from AI.');
    } catch (err: any) {
      Alert.alert('Retry failed', err?.message ?? 'AI extraction failed again. You can edit manually.');
    } finally {
      setRetrying(false);
    }
  };

  const goEdit = () => router.push(`/review/${id}`);
  const isNeedsReview = receipt.status === 'needs_review';
  const categoryIcon = (CATEGORY_ICONS[receipt.category] ?? 'tag') as any;

  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Trash icon in the native header — hard delete with 5-second undo */}
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={handleHardDelete}
              hitSlop={12}
              style={{ marginRight: 4, padding: 4 }}
            >
              <MaterialCommunityIcons name="delete-outline" size={22} color={t.danger} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* HERO IMAGE — prominent, full-width, no rounded chrome at top */}
      {receipt.image_uri ? (
        <Pressable onPress={goEdit} style={styles.imageWrap}>
          <Image source={{ uri: receipt.image_uri }} style={styles.image} resizeMode="cover" />
          <View style={styles.imageOverlay} />
          <View style={[styles.imageBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
            <MaterialCommunityIcons name="image-outline" size={14} color="white" />
            <Text style={styles.imageBadgeText}>Tap photo to edit</Text>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.noImage, { backgroundColor: t.surface, borderColor: t.border }]}>
          <MaterialCommunityIcons name="image-off-outline" size={32} color={t.textSubtle} />
          <Text style={{ color: t.textSubtle, fontSize: 13, marginTop: 6 }}>No photo</Text>
        </View>
      )}

      <View style={styles.content}>
        {/* NEEDS REVIEW BANNER */}
        {isNeedsReview && (
          <View style={[styles.banner, { backgroundColor: t.needsReviewBg, borderColor: t.needsReview }]}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={t.needsReview} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: t.needsReview }]}>Needs review</Text>
              <Text style={[styles.bannerBody, { color: t.textPrimary }]}>
                AI extraction didn't complete. Tap Retry AI or edit the fields below.
              </Text>
            </View>
          </View>
        )}

        {/* HERO CARD — merchant + total */}
        <Section tokens={t}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: t.accent + '22' }]}>
              <MaterialCommunityIcons name={categoryIcon} size={26} color={t.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.merchantName, { color: t.textPrimary }]} numberOfLines={2}>
                {receipt.merchant || '—'}
              </Text>
              <Text style={[styles.merchantMeta, { color: t.textMuted }]}>
                {receipt.date} · {receipt.category}
              </Text>
              <View style={{ marginTop: 6 }}>
                <ReceiptStatusPill status={receipt.status} size="md" hideWhenComplete />
              </View>
            </View>
            <EditButton onPress={goEdit} tokens={t} />
          </View>

          <View style={[styles.divider, { backgroundColor: t.border }]} />

          <View style={styles.totalRow}>
            <View>
              <Text style={[styles.totalLabel, { color: t.textSubtle }]}>TOTAL</Text>
              <Text style={[styles.totalAmount, { color: t.textPrimary }]}>
                {fmt(receipt.total)}
              </Text>
            </View>

            {receipt.is_tax_deductible && (
              <View style={[styles.deductibleChip, { backgroundColor: t.deductibleBg }]}>
                <MaterialCommunityIcons name="check-circle" size={14} color={t.deductible} />
                <Text style={[styles.deductibleText, { color: t.deductible }]}>
                  Tax deductible
                </Text>
              </View>
            )}
          </View>
        </Section>

        {/* TOTALS SUMMARY — only in 'totals' display mode. Three numbers
            small-business users actually need to file. Setting toggle is
            inline so they can flip it from this screen too. */}
        {summaryMode === 'totals' && (
          <Section tokens={t} title="Summary">
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: t.textSubtle }]}>NET</Text>
                <Text style={[styles.summaryValue, { color: t.textPrimary }]}>{fmt(receipt.subtotal)}</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: t.border }]} />
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: t.textSubtle }]}>{taxLabel.toUpperCase()}</Text>
                <Text style={[styles.summaryValue, { color: t.textPrimary }]}>{fmt(receipt.tax)}</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: t.border }]} />
              <View style={styles.summaryCell}>
                <Text style={[styles.summaryLabel, { color: t.textSubtle }]}>GROSS</Text>
                <Text style={[styles.summaryValue, { color: t.cta }]}>{fmt(receipt.total)}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setSummaryMode('lineItems')}
              activeOpacity={0.7}
              style={[styles.modeToggleRow, { borderTopColor: t.border }]}
            >
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color={t.textMuted} />
              <Text style={[styles.modeToggleText, { color: t.textMuted }]}>
                Switch to line-items view
              </Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* DETAILS CARD — labelled rows with edit affordance.
            Tap = edit. Long-press = "this extraction was wrong" feedback. */}
        <Section tokens={t} title="Details">
          <DetailRow
            label="Subtotal"
            value={fmt(receipt.subtotal)}
            tokens={t}
            onEdit={goEdit}
            onLongPress={() => handleFieldFeedback('subtotal', receipt.subtotal)}
          />
          <DetailRow
            label={taxMode === 'inclusive' ? `${taxLabel} (included)` : taxLabel}
            value={fmt(receipt.tax)}
            tokens={t}
            onEdit={goEdit}
            onLongPress={() => handleFieldFeedback('tax', receipt.tax)}
          />
          <DetailRow
            label="Currency"
            value={receipt.currency}
            tokens={t}
            onEdit={goEdit}
            onLongPress={() => handleFieldFeedback('currency', receipt.currency)}
          />
          {receipt.payment_method && (
            <DetailRow
              label="Payment method"
              value={receipt.payment_method}
              tokens={t}
              onEdit={goEdit}
              onLongPress={() => handleFieldFeedback('payment_method', receipt.payment_method)}
            />
          )}
          <DetailRow
            label="Invoice number"
            value={receipt.invoice_number ?? '—'}
            tokens={t}
            onEdit={goEdit}
            onLongPress={() => handleFieldFeedback('invoice_number', receipt.invoice_number)}
          />
          <DetailRow
            label="Tax deductible"
            value={receipt.is_tax_deductible ? 'Yes' : 'No'}
            valueColor={receipt.is_tax_deductible ? t.deductible : t.textMuted}
            tokens={t}
            onEdit={goEdit}
            isLast
          />
        </Section>

        {/* LINE ITEMS — proper list. Default-collapsed in 'totals' mode so
            the user sees the three numbers prominently; one tap to reveal. */}
        {receipt.line_items.length > 0 ? (
          summaryMode === 'totals' && !lineItemsExpanded ? (
            <Section tokens={t}>
              <TouchableOpacity
                onPress={() => setLineItemsExpanded(true)}
                activeOpacity={0.7}
                style={styles.expanderRow}
              >
                <MaterialCommunityIcons name="chevron-down" size={20} color={t.textMuted} />
                <Text style={[styles.expanderText, { color: t.textPrimary }]}>
                  Show line items ({receipt.line_items.length})
                </Text>
              </TouchableOpacity>
            </Section>
          ) : (
            <Section tokens={t} title={`Line items (${receipt.line_items.length})`}>
              {receipt.line_items.map((item, i) => (
                <View key={i}>
                  <View style={styles.lineRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lineDesc, { color: t.textPrimary }]} numberOfLines={2}>
                        {item.description || 'Item'}
                      </Text>
                      <Text style={[styles.lineMeta, { color: t.textMuted }]}>
                        {item.quantity} × {fmt(item.unit_price)}
                      </Text>
                    </View>
                    <Text style={[styles.lineTotal, { color: t.textPrimary }]}>{fmt(item.total)}</Text>
                  </View>
                  {i < receipt.line_items.length - 1 && (
                    <View style={[styles.lineDivider, { backgroundColor: t.border }]} />
                  )}
                </View>
              ))}
              {summaryMode === 'totals' && lineItemsExpanded && (
                <TouchableOpacity
                  onPress={() => setLineItemsExpanded(false)}
                  activeOpacity={0.7}
                  style={[styles.expanderRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}
                >
                  <MaterialCommunityIcons name="chevron-up" size={18} color={t.textMuted} />
                  <Text style={[styles.expanderText, { color: t.textMuted }]}>Hide line items</Text>
                </TouchableOpacity>
              )}
            </Section>
          )
        ) : (
          <Section tokens={t} title="Line items">
            <View style={styles.emptyLine}>
              <MaterialCommunityIcons name="format-list-bulleted" size={20} color={t.textSubtle} />
              <Text style={[styles.emptyLineText, { color: t.textSubtle }]}>
                No line items captured for this receipt
              </Text>
            </View>
          </Section>
        )}

        {/* NOTES */}
        <Section tokens={t} title="Notes" headerActionIcon="pencil" onHeaderAction={goEdit}>
          {receipt.notes ? (
            <Text style={[styles.notesText, { color: t.textPrimary }]}>{receipt.notes}</Text>
          ) : (
            <Text style={[styles.emptyLineText, { color: t.textSubtle }]}>No notes</Text>
          )}
        </Section>

        {/* PRIMARY ACTIONS — full-width edit, then secondary actions */}
        <View style={styles.actionStack}>
          {isNeedsReview && (
            <Button
              mode="contained"
              icon="auto-fix"
              onPress={handleRetry}
              loading={retrying}
              disabled={retrying}
              buttonColor={t.cta}
              textColor={t.ctaText}
              style={styles.primaryBtn}
              contentStyle={styles.primaryBtnContent}
              labelStyle={styles.primaryBtnLabel}
            >
              Retry AI extraction
            </Button>
          )}
          <Button
            mode={isNeedsReview ? 'outlined' : 'contained'}
            icon="pencil"
            onPress={goEdit}
            buttonColor={isNeedsReview ? undefined : t.cta}
            textColor={isNeedsReview ? t.textPrimary : t.ctaText}
            style={styles.primaryBtn}
            contentStyle={styles.primaryBtnContent}
            labelStyle={styles.primaryBtnLabel}
          >
            Edit receipt
          </Button>
          <TouchableOpacity onPress={handleArchive} style={styles.deleteBtn} hitSlop={8}>
            <MaterialCommunityIcons name="archive-outline" size={18} color={t.danger} />
            <Text style={[styles.deleteText, { color: t.danger }]}>Archive receipt</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Section({
  tokens,
  title,
  children,
  headerActionIcon,
  onHeaderAction,
}: {
  tokens: ReturnType<typeof useThemeTokens>;
  title?: string;
  children: React.ReactNode;
  headerActionIcon?: string;
  onHeaderAction?: () => void;
}) {
  return (
    <View
      style={[
        styles.section,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      {title && (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: tokens.textMuted }]}>{title}</Text>
          {headerActionIcon && onHeaderAction && (
            <TouchableOpacity
              onPress={onHeaderAction}
              hitSlop={12}
              style={[styles.sectionHeaderAction, { backgroundColor: tokens.surfaceElevated }]}
            >
              <MaterialCommunityIcons name={headerActionIcon as any} size={14} color={tokens.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={title ? styles.sectionBody : styles.sectionBodyNoHeader}>{children}</View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  valueColor,
  tokens,
  onEdit,
  onLongPress,
  isLast,
}: {
  label: string;
  value: string;
  valueColor?: string;
  tokens: ReturnType<typeof useThemeTokens>;
  onEdit?: () => void;
  onLongPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onEdit}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.detailRow,
        !isLast && { borderBottomColor: tokens.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: tokens.surfaceElevated },
      ]}
    >
      <Text style={[styles.detailLabel, { color: tokens.textMuted }]}>{label}</Text>
      <View style={styles.detailRight}>
        <Text style={[styles.detailValue, { color: valueColor ?? tokens.textPrimary }]}>{value}</Text>
        <MaterialCommunityIcons name="pencil-outline" size={14} color={tokens.textSubtle} style={{ marginLeft: 8 }} />
      </View>
    </Pressable>
  );
}

function EditButton({ onPress, tokens }: { onPress: () => void; tokens: ReturnType<typeof useThemeTokens> }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={12}
      style={[styles.editIconBtn, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}
    >
      <MaterialCommunityIcons name="pencil-outline" size={18} color={tokens.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 32 },

  // Hero image
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 280 },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  imageBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imageBadgeText: { color: 'white', fontSize: 11, fontFamily: 'Inter_500Medium' },
  noImage: {
    height: 120,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { padding: 16, gap: 14 },

  // Banner
  banner: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  bannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 2 },
  bannerBody: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },

  // Section card
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionHeaderAction: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionBody: { padding: 16, paddingTop: 8 },
  sectionBodyNoHeader: { padding: 16 },

  // Hero
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroIcon: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  merchantName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  merchantMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 4,
  },
  editIconBtn: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  divider: { height: 1, marginVertical: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  totalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  totalAmount: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 36,
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  deductibleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
  },
  deductibleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },

  // Net/VAT/Gross summary (totals display mode)
  summaryGrid: { flexDirection: 'row', alignItems: 'stretch' },
  summaryCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  summaryDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  summaryLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8, marginBottom: 6 },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.4 },
  modeToggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 14, marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  modeToggleText: { fontFamily: 'Inter_500Medium', fontSize: 12 },

  // Line-items expander (totals display mode, default-collapsed)
  expanderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
  },
  expanderText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // Detail rows
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 10,
  },
  detailLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  detailRight: { flexDirection: 'row', alignItems: 'center' },
  detailValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },

  // Line items
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  lineDivider: { height: StyleSheet.hairlineWidth },
  lineDesc: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    marginBottom: 2,
  },
  lineMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  lineTotal: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    marginLeft: 12,
  },
  emptyLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  emptyLineText: { fontFamily: 'Inter_400Regular', fontSize: 13 },

  // Notes
  notesText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },

  // Actions
  actionStack: { gap: 10, marginTop: 6 },
  primaryBtn: { borderRadius: 14, minHeight: 50 },
  primaryBtnContent: { paddingVertical: 8 },
  primaryBtnLabel: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.1 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    minHeight: 48,
  },
  deleteText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
});
