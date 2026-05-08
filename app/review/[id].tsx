import { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, Image, Alert, TextInput, TouchableOpacity, Switch } from 'react-native';
import { SpringButton } from '../../src/components/SpringButton';
import * as Haptics from 'expo-haptics';
import { Text, Menu } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { insertReceipt, getReceipt, updateReceipt, setReceiptStatus } from '../../src/db/receipts';
import { ExtractionResult } from '../../src/schemas/extraction';
import {
  CATEGORIES,
  Category,
  ReceiptDraft,
  ReceiptStatus,
  CATEGORY_DEDUCTIBLE_DEFAULTS,
  LineItem,
} from '../../src/types';
import { useAppStore } from '../../src/stores/appStore';
import { useThemeTokens, SemanticTokens } from '../../src/theme';

export default function ReviewScreen() {
  const t = useThemeTokens();
  const { id, imageUri, extraction } = useLocalSearchParams<{
    id: string;
    imageUri?: string;
    extraction?: string;
  }>();
  const isNew = id === 'new';
  const currency = useAppStore((s) => s.currency);
  const taxLabel = useAppStore((s) => s.taxLabel);
  const taxMode = useAppStore((s) => s.taxMode);

  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState('0.00');
  const [subtotal, setSubtotal] = useState('0.00');
  const [tax, setTax] = useState('0.00');
  const [cur, setCur] = useState(currency);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [category, setCategory] = useState<Category>('Other');
  const [notes, setNotes] = useState('');
  const [imgUri, setImgUri] = useState(imageUri ?? '');
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<ReceiptStatus>('complete');
  const [isTaxDeductible, setIsTaxDeductible] = useState(false);
  const [deductibleManuallySet, setDeductibleManuallySet] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (isNew && extraction) {
      try {
        const ex: ExtractionResult = JSON.parse(extraction);
        const cat = (ex.suggested_category as Category) ?? 'Other';
        setMerchant(ex.merchant ?? '');
        setDate(ex.date ?? new Date().toISOString().slice(0, 10));
        setTotal(String(ex.total ?? 0));
        setSubtotal(String(ex.subtotal ?? 0));
        setTax(String(ex.tax ?? 0));
        setCur(ex.currency ?? currency);
        setPaymentMethod(ex.payment_method ?? '');
        setInvoiceNumber((ex as any).invoice_number ?? '');
        setCategory(cat);
        setIsTaxDeductible(CATEGORY_DEDUCTIBLE_DEFAULTS[cat] ?? false);
        setLineItems(ex.line_items ?? []);
      } catch {}
    } else if (!isNew) {
      getReceipt(Number(id)).then((r) => {
        if (!r) return;
        setMerchant(r.merchant);
        setDate(r.date);
        setTotal(String(r.total));
        setSubtotal(String(r.subtotal));
        setTax(String(r.tax));
        setCur(r.currency);
        setPaymentMethod(r.payment_method ?? '');
        setInvoiceNumber(r.invoice_number ?? '');
        setCategory(r.category);
        setNotes(r.notes);
        setImgUri(r.image_uri);
        setStatus(r.status);
        setIsTaxDeductible(r.is_tax_deductible);
        setDeductibleManuallySet(true);
        setLineItems(r.line_items ?? []);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numbersDisagree = useMemo(() => {
    const tot = parseFloat(total) || 0;
    const s = parseFloat(subtotal) || 0;
    const x = parseFloat(tax) || 0;
    if (tot === 0 && s === 0 && x === 0) return false;
    if (tot === 0) return false;
    const diff = Math.abs(s + x - tot);
    return diff / tot > 0.02 && diff > 0.05;
  }, [total, subtotal, tax]);

  const handleCategoryChange = (newCat: Category) => {
    setCategory(newCat);
    setCategoryMenuOpen(false);
    if (!deductibleManuallySet) {
      setIsTaxDeductible(CATEGORY_DEDUCTIBLE_DEFAULTS[newCat] ?? false);
    }
  };

  const handleDeductibleToggle = (v: boolean) => {
    setIsTaxDeductible(v);
    setDeductibleManuallySet(true);
  };

  // ── Line items editing ──
  const addLineItem = () => {
    setLineItems((items) => [...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };
  const updateLineItem = (i: number, patch: Partial<LineItem>) => {
    setLineItems((items) =>
      items.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, ...patch };
        // Auto-recalc total when qty or unit price changes
        if ('quantity' in patch || 'unit_price' in patch) {
          next.total = Number((next.quantity * next.unit_price).toFixed(2));
        }
        return next;
      })
    );
  };
  const removeLineItem = (i: number) => {
    setLineItems((items) => items.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    if (!merchant.trim()) {
      Alert.alert('Merchant required', 'Please enter the merchant name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Date must be in YYYY-MM-DD format (e.g. 2025-01-31).');
      return;
    }
    setSaving(true);
    try {
      const draft: ReceiptDraft = {
        merchant: merchant.trim(),
        date,
        currency: cur,
        line_items: lineItems.filter((li) => li.description.trim() || li.total > 0),
        subtotal: parseFloat(subtotal) || 0,
        tax: parseFloat(tax) || 0,
        total: parseFloat(total) || 0,
        payment_method: paymentMethod.trim() || null,
        invoice_number: invoiceNumber.trim() || null,
        category,
        notes: notes.trim(),
        image_uri: imgUri,
        status: 'complete',
        is_tax_deductible: isTaxDeductible,
      };
      if (isNew) {
        await insertReceipt(draft);
      } else {
        await updateReceipt(Number(id), draft);
        if (status === 'needs_review') {
          await setReceiptStatus(Number(id), 'complete');
        }
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={styles.container}>
      {imgUri ? (
        <Image source={{ uri: imgUri }} style={styles.image} resizeMode="cover" />
      ) : null}

      {status === 'needs_review' && (
        <View style={[styles.banner, { backgroundColor: t.needsReviewBg, borderColor: t.needsReview }]}>
          <MaterialCommunityIcons name="alert-circle" size={20} color={t.needsReview} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: t.needsReview }]}>Needs review</Text>
            <Text style={[styles.bannerBody, { color: t.textPrimary }]}>
              Photo is saved. Edit the details below and tap Save.
            </Text>
          </View>
        </View>
      )}

      <Section tokens={t} title="MERCHANT">
        <FormInput tokens={t} value={merchant} onChange={setMerchant} placeholder="Required" />
      </Section>

      <Section tokens={t} title="DATE">
        <FormInput tokens={t} value={date} onChange={setDate} placeholder="YYYY-MM-DD" keyboardType="numeric" />
      </Section>

      <Section tokens={t} title="AMOUNT">
        <View style={styles.row}>
          <View style={{ flex: 2 }}>
            <FormLabel tokens={t}>Total</FormLabel>
            <FormInput
              tokens={t}
              value={total}
              onChange={setTotal}
              keyboardType="decimal-pad"
              error={numbersDisagree}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormLabel tokens={t}>Currency</FormLabel>
            <FormInput tokens={t} value={cur} onChange={setCur} maxLength={3} autoCapitalize="characters" />
          </View>
        </View>
        {numbersDisagree && (
          <Text style={[styles.errorText, { color: t.danger }]}>
            Subtotal + {taxLabel.toLowerCase()} doesn't match total. Please double-check.
          </Text>
        )}
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={{ flex: 1 }}>
            <FormLabel tokens={t}>Subtotal</FormLabel>
            <FormInput tokens={t} value={subtotal} onChange={setSubtotal} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <FormLabel tokens={t}>{taxLabel}{taxMode === 'inclusive' ? ' (incl.)' : ''}</FormLabel>
            <FormInput tokens={t} value={tax} onChange={setTax} keyboardType="decimal-pad" />
          </View>
        </View>
      </Section>

      <Section tokens={t} title="PAYMENT METHOD">
        <FormInput tokens={t} value={paymentMethod} onChange={setPaymentMethod} placeholder="Card, Cash, etc." />
      </Section>

      <Section tokens={t} title="INVOICE / RECEIPT NUMBER">
        <FormInput
          tokens={t}
          value={invoiceNumber}
          onChange={setInvoiceNumber}
          placeholder="Optional — e.g. Invoice #1042"
        />
      </Section>

      <Section tokens={t} title="CATEGORY">
        <Menu
          visible={categoryMenuOpen}
          onDismiss={() => setCategoryMenuOpen(false)}
          anchor={
            <TouchableOpacity
              onPress={() => setCategoryMenuOpen(true)}
              activeOpacity={0.7}
              style={[styles.dropdownBtn, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}
            >
              <Text style={[styles.dropdownText, { color: t.textPrimary }]}>{category}</Text>
              <MaterialCommunityIcons name="chevron-down" size={20} color={t.textMuted} />
            </TouchableOpacity>
          }
        >
          {CATEGORIES.map((cat) => (
            <Menu.Item key={cat} title={cat} onPress={() => handleCategoryChange(cat)} />
          ))}
        </Menu>
      </Section>

      {/* Tax-deductible toggle */}
      <View style={[
        styles.deductibleCard,
        {
          backgroundColor: isTaxDeductible ? t.deductibleBg : t.surface,
          borderColor: isTaxDeductible ? t.deductible + '55' : t.border,
        },
      ]}>
        <View style={styles.deductibleLeft}>
          <MaterialCommunityIcons
            name="cash-multiple"
            size={20}
            color={isTaxDeductible ? t.deductible : t.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.deductibleTitle, { color: isTaxDeductible ? t.deductible : t.textPrimary }]}>
              Tax-deductible
            </Text>
            <Text style={[styles.deductibleSub, { color: t.textMuted }]}>
              {isTaxDeductible ? 'Counts toward your monthly deductible total' : 'Mark as a business expense'}
            </Text>
          </View>
        </View>
        <Switch
          value={isTaxDeductible}
          onValueChange={handleDeductibleToggle}
          trackColor={{ false: t.surfaceElevated, true: t.accent }}
          thumbColor="#ffffff"
        />
      </View>

      {/* Line items editor */}
      <Section
        tokens={t}
        title={`LINE ITEMS${lineItems.length > 0 ? ` (${lineItems.length})` : ''}`}
        rightAction={
          <TouchableOpacity onPress={addLineItem} hitSlop={10} style={styles.addBtn}>
            <MaterialCommunityIcons name="plus-circle" size={18} color={t.accent} />
            <Text style={[styles.addBtnText, { color: t.accent }]}>Add item</Text>
          </TouchableOpacity>
        }
      >
        {lineItems.length === 0 ? (
          <Text style={[styles.lineEmpty, { color: t.textSubtle }]}>
            No line items yet. Tap "Add item" to break down this receipt by individual purchases.
          </Text>
        ) : (
          <View style={{ gap: 12 }}>
            {lineItems.map((item, i) => (
              <LineItemRow
                key={i}
                tokens={t}
                item={item}
                onChange={(patch) => updateLineItem(i, patch)}
                onRemove={() => removeLineItem(i)}
              />
            ))}
          </View>
        )}
      </Section>

      <Section tokens={t} title="NOTES">
        <FormInput
          tokens={t}
          value={notes}
          onChange={setNotes}
          multiline
          minHeight={70}
          placeholder="Optional"
        />
      </Section>

      <SpringButton
        style={[styles.saveBtn, { backgroundColor: t.cta }, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <MaterialCommunityIcons name="check" size={20} color={t.ctaText} />
        <Text style={[styles.saveBtnText, { color: t.ctaText }]}>
          {saving ? 'Saving...' : 'Save Receipt'}
        </Text>
      </SpringButton>
    </ScrollView>
  );
}

// ── Form sub-components ──────────────────────────────────────────────────

function Section({
  tokens,
  title,
  children,
  rightAction,
}: {
  tokens: SemanticTokens;
  title: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
}) {
  return (
    <View>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionLabel, { color: tokens.textSubtle }]}>{title}</Text>
        {rightAction}
      </View>
      <View style={[styles.sectionCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        {children}
      </View>
    </View>
  );
}

function FormLabel({ tokens, children }: { tokens: SemanticTokens; children: React.ReactNode }) {
  return <Text style={[styles.formLabel, { color: tokens.textMuted }]}>{children}</Text>;
}

function FormInput({
  tokens,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  minHeight,
  maxLength,
  autoCapitalize,
  error,
  small,
}: {
  tokens: SemanticTokens;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  multiline?: boolean;
  minHeight?: number;
  maxLength?: number;
  autoCapitalize?: any;
  error?: boolean;
  small?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={tokens.textSubtle}
      keyboardType={keyboardType}
      multiline={multiline}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize}
      style={[
        styles.input,
        small && { paddingVertical: 8, fontSize: 13, minHeight: 38 },
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: error ? tokens.danger : tokens.border,
          color: tokens.textPrimary,
          minHeight: minHeight ?? (small ? 38 : 44),
          textAlignVertical: multiline ? 'top' : 'center',
        },
      ]}
    />
  );
}

function LineItemRow({
  tokens,
  item,
  onChange,
  onRemove,
}: {
  tokens: SemanticTokens;
  item: LineItem;
  onChange: (patch: Partial<LineItem>) => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.lineItemCard, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
      <View style={styles.lineItemHeader}>
        <View style={{ flex: 1 }}>
          <FormLabel tokens={tokens}>Description</FormLabel>
          <FormInput
            tokens={tokens}
            value={item.description}
            onChange={(v) => onChange({ description: v })}
            placeholder="e.g. Coffee"
            small
          />
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={12} style={styles.removeBtn}>
          <MaterialCommunityIcons name="close-circle" size={22} color={tokens.danger} />
        </TouchableOpacity>
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <FormLabel tokens={tokens}>Qty</FormLabel>
          <FormInput
            tokens={tokens}
            value={String(item.quantity)}
            onChange={(v) => onChange({ quantity: parseFloat(v) || 0 })}
            keyboardType="decimal-pad"
            small
          />
        </View>
        <View style={{ flex: 1 }}>
          <FormLabel tokens={tokens}>Unit price</FormLabel>
          <FormInput
            tokens={tokens}
            value={String(item.unit_price)}
            onChange={(v) => onChange({ unit_price: parseFloat(v) || 0 })}
            keyboardType="decimal-pad"
            small
          />
        </View>
        <View style={{ flex: 1 }}>
          <FormLabel tokens={tokens}>Line total</FormLabel>
          <FormInput
            tokens={tokens}
            value={String(item.total)}
            onChange={(v) => onChange({ total: parseFloat(v) || 0 })}
            keyboardType="decimal-pad"
            small
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, paddingBottom: 40 },
  image: { width: '100%', height: 200, borderRadius: 16, marginBottom: 4 },

  banner: {
    flexDirection: 'row', gap: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, alignItems: 'center',
  },
  bannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 2 },
  bannerBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },

  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 4,
    marginRight: 4,
  },
  sectionLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8,
  },
  sectionCard: { borderRadius: 14, borderWidth: 1, padding: 12 },

  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  formLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.4, marginBottom: 4, marginLeft: 2 },
  input: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: 'Inter_500Medium', fontSize: 15,
  },
  row: { flexDirection: 'row', gap: 8 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 6, marginLeft: 4 },

  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, minHeight: 44,
  },
  dropdownText: { fontFamily: 'Inter_500Medium', fontSize: 15 },

  deductibleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  deductibleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  deductibleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 2 },
  deductibleSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },

  lineEmpty: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, padding: 4 },
  lineItemCard: { borderRadius: 12, borderWidth: 1, padding: 10 },
  lineItemHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  removeBtn: { padding: 4, marginBottom: 4 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, padding: 16, marginTop: 8, minHeight: 52,
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
});
