/**
 * Review / Edit receipt form — Step 3
 *
 * Covers both new receipts (from OCR) and editing existing ones.
 * New receipts arrive with an `extraction` JSON param pre-filled by AI;
 * low-confidence fields are left blank for the user to fill in.
 *
 * Sections:
 *   Hero (photo + merchant logo)
 *   Vendor · Date · Amount (total / VAT / subtotal)
 *   Category chip with Tax Deductible badge
 *   Payment method · Invoice number
 *   Toggles: Tax deductible · Reimbursable · Refund
 *   Report assignment
 *   Additional photos (multi-page)
 *   Notes
 *   Action bar: Delete | Save
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, Image, Alert, TextInput,
  TouchableOpacity, Switch, FlatList,
} from 'react-native';
import { Text, Menu } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpringButton } from '../../src/components/SpringButton';
import { MerchantAvatar } from '../../src/components/MerchantAvatar';
import { hapticMedium, hapticLight, hapticHeavy } from '../../src/utils/haptics';

import {
  insertReceipt, getReceipt, updateReceipt, setReceiptStatus, trashReceipt,
} from '../../src/db/receipts';
import { getAllCategories } from '../../src/db/categories';
import { getAllReports } from '../../src/db/reports';
import { ExtractionResult } from '../../src/schemas/extraction';
import {
  Category, ReceiptDraft, ReceiptStatus, CATEGORY_DEDUCTIBLE_DEFAULTS,
  LineItem, DbCategory, Report,
} from '../../src/types';
import { useAppStore } from '../../src/stores/appStore';
import { useThemeTokens, SemanticTokens } from '../../src/theme';
import * as FileSystem from 'expo-file-system/legacy';

const PAYMENT_METHODS = [
  'Card', 'Credit Card', 'Cash', 'Bank Transfer',
  'PayPal', 'Cheque', 'Invoice', 'Expense Account', 'Other',
];

export default function ReviewScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { id, imageUri, extraction, additionalImages, prefill } = useLocalSearchParams<{
    id: string;
    imageUri?: string;
    extraction?: string;
    additionalImages?: string;
    /** JSON blob of {merchant, category, notes} for barcode-driven prefills. */
    prefill?: string;
  }>();
  const isNew = id === 'new';
  const currency = useAppStore((s) => s.currency);
  const taxLabel = useAppStore((s) => s.taxLabel);
  const taxMode = useAppStore((s) => s.taxMode);

  // ── Form state ───────────────────────────────────────────────────────────
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA').slice(0, 10));
  const [total, setTotal] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [tax, setTax] = useState('');
  const [cur, setCur] = useState(currency);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [imgUri, setImgUri] = useState(imageUri ?? '');
  const [extraImgs, setExtraImgs] = useState<string[]>(
    JSON.parse(additionalImages ?? '[]')
  );
  const [isTaxDeductible, setIsTaxDeductible] = useState(false);
  const [isReimbursable, setIsReimbursable] = useState(false);
  const [isRefund, setIsRefund] = useState(false);
  const [deductibleManuallySet, setDeductibleManuallySet] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [status, setStatus] = useState<ReceiptStatus>('complete');
  const [saving, setSaving] = useState(false);

  // ── DB-driven dropdowns ──────────────────────────────────────────────────
  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  // Legacy text category (kept for backwards compat)
  const [legacyCategory, setLegacyCategory] = useState<Category>('Other');

  // Menu visibility
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const [reportMenuOpen, setReportMenuOpen] = useState(false);

  const selectedCategory = useMemo(
    () => dbCategories.find((c) => c.id === selectedCategoryId) ?? null,
    [dbCategories, selectedCategoryId]
  );

  // ── Load reference data ──────────────────────────────────────────────────
  useEffect(() => {
    getAllCategories().then(setDbCategories);
    getAllReports().then(setReports);
  }, []);

  // ── Pre-fill from extraction or existing receipt ─────────────────────────
  useEffect(() => {
    // Barcode-driven prefill: no image, just merchant/category/notes from the
    // Open Food Facts scan. Lighter than the extraction path because OFF data
    // doesn't include amounts.
    if (isNew && prefill && !extraction) {
      try {
        const p = JSON.parse(prefill) as { merchant?: string; category?: string; notes?: string };
        if (p.merchant) setMerchant(p.merchant);
        if (p.notes) setNotes(p.notes);
        const cat = (p.category as Category) ?? 'Other';
        setLegacyCategory(cat);
        setIsTaxDeductible(CATEGORY_DEDUCTIBLE_DEFAULTS[cat] ?? false);
      } catch {}
      return;
    }
    if (isNew && extraction) {
      try {
        const ex: ExtractionResult = JSON.parse(extraction);
        const legCat = (ex.suggested_category as Category) ?? 'Other';
        setMerchant(ex.merchant ?? '');
        setDate(ex.date ?? new Date().toLocaleDateString('en-CA').slice(0, 10));
        // Low-confidence: leave blank if zero (AI returns 0 when unsure)
        setTotal(ex.total > 0 ? String(ex.total) : '');
        setSubtotal(ex.subtotal > 0 ? String(ex.subtotal) : '');
        setTax(ex.tax > 0 ? String(ex.tax) : '');
        setCur(ex.currency ?? currency);
        setPaymentMethod(ex.payment_method ?? '');
        setInvoiceNumber((ex as any).invoice_number ?? '');
        setLegacyCategory(legCat);
        setIsTaxDeductible(CATEGORY_DEDUCTIBLE_DEFAULTS[legCat] ?? false);
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
        setNotes(r.notes);
        setImgUri(r.image_uri);
        setExtraImgs(r.additional_images ?? []);
        setStatus(r.status);
        setIsTaxDeductible(r.is_tax_deductible);
        setIsReimbursable(r.is_reimbursable);
        setIsRefund(r.refund);
        setDeductibleManuallySet(true);
        setLineItems(r.line_items ?? []);
        setLegacyCategory(r.category);
        setSelectedCategoryId(r.category_id);
        setSelectedReportId(r.report_id);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once DB categories load, resolve legacy category to an id if we don't have one yet
  useEffect(() => {
    if (selectedCategoryId === null && dbCategories.length > 0 && legacyCategory) {
      const match = dbCategories.find(
        (c) => c.name.toLowerCase().includes(legacyCategory.toLowerCase()) ||
               legacyCategory.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
      );
      if (match) {
        setSelectedCategoryId(match.id);
        if (!deductibleManuallySet) setIsTaxDeductible(match.tax_deductible);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbCategories]);

  // ── Validation ───────────────────────────────────────────────────────────
  const numbersDisagree = useMemo(() => {
    const tot = parseFloat(total) || 0;
    const s = parseFloat(subtotal) || 0;
    const x = parseFloat(tax) || 0;
    if (tot === 0 || (s === 0 && x === 0)) return false;
    const diff = Math.abs(s + x - tot);
    return diff / tot > 0.02 && diff > 0.05;
  }, [total, subtotal, tax]);

  // ── Category helpers ─────────────────────────────────────────────────────
  const handleCategoryChange = (cat: DbCategory) => {
    setSelectedCategoryId(cat.id);
    setLegacyCategory(cat.name as Category);
    setCategoryMenuOpen(false);
    if (!deductibleManuallySet) setIsTaxDeductible(cat.tax_deductible);
  };

  const handleDeductibleToggle = (v: boolean) => {
    setIsTaxDeductible(v);
    setDeductibleManuallySet(true);
    hapticLight();
  };

  // ── Line items ────────────────────────────────────────────────────────────
  const addLineItem = () =>
    setLineItems((items) => [...items, { description: '', quantity: 1, unit_price: 0, total: 0 }]);

  const updateLineItem = (i: number, patch: Partial<LineItem>) => {
    setLineItems((items) =>
      items.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, ...patch };
        if ('quantity' in patch || 'unit_price' in patch)
          next.total = Number((next.quantity * next.unit_price).toFixed(2));
        return next;
      })
    );
  };

  // ── Additional photos ─────────────────────────────────────────────────────
  const addExtraPhoto = async () => {
    hapticLight();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.92,
      allowsMultipleSelection: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const dir = `${FileSystem.documentDirectory}receipts/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const uris: string[] = [];
    for (const asset of result.assets) {
      const dest = `${dir}receipt_extra_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest });
      uris.push(dest);
    }
    setExtraImgs((prev) => [...prev, ...uris]);
  };

  // ── Delete (trash) ────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (isNew) { router.back(); return; }
    hapticHeavy();
    Alert.alert(
      'Move to Trash?',
      'This receipt will be in Trash for 30 days, then permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Trash',
          style: 'destructive',
          onPress: async () => {
            await trashReceipt(Number(id));
            hapticMedium();
            router.replace('/(tabs)/stats');
          },
        },
      ]
    );
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!merchant.trim()) {
      Alert.alert('Vendor required', 'Please enter the vendor name.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD format, e.g. 2025-01-31.');
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
        category: legacyCategory,
        category_id: selectedCategoryId,
        notes: notes.trim(),
        image_uri: imgUri,
        additional_images: extraImgs,
        is_tax_deductible: isTaxDeductible,
        is_reimbursable: isReimbursable,
        refund: isRefund,
        report_id: selectedReportId,
        status: 'complete',
      };
      if (isNew) {
        await insertReceipt(draft);
      } else {
        await updateReceipt(Number(id), draft);
        if (status === 'needs_review') await setReceiptStatus(Number(id), 'complete');
      }
      hapticMedium();
      router.replace('/(tabs)/stats');
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      {/* Sticky header */}
      <View style={[styles.stickyHeader, { backgroundColor: t.background, borderBottomColor: t.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>
          {isNew ? 'New Receipt' : 'Edit Receipt'}
        </Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={12} style={styles.headerBtn}>
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={t.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero row ─────────────────────────────────────────────────── */}
        {imgUri ? (
          <View style={styles.heroRow}>
            <Image source={{ uri: imgUri }} style={styles.heroImage} resizeMode="cover" />
            <View style={[styles.heroCard, { backgroundColor: t.surface, borderColor: t.border }]}>
              <MerchantAvatar
                merchant={merchant}
                category={legacyCategory}
                size={56}
                iconColor={selectedCategory?.color ?? t.accent}
                backgroundColor={(selectedCategory?.color ?? t.accent) + '22'}
                borderRadius={14}
              />
              <Text style={[styles.heroName, { color: t.textPrimary }]} numberOfLines={2}>
                {merchant || 'Vendor'}
              </Text>
              {selectedCategory && (
                <View style={[styles.categoryChip, { backgroundColor: selectedCategory.color + '22' }]}>
                  <MaterialCommunityIcons name={selectedCategory.icon as any} size={12} color={selectedCategory.color} />
                  <Text style={[styles.categoryChipText, { color: selectedCategory.color }]}>
                    {selectedCategory.name}
                  </Text>
                </View>
              )}
              {isTaxDeductible && (
                <View style={[styles.deductibleBadge, { backgroundColor: '#10b98122' }]}>
                  <MaterialCommunityIcons name="check-circle-outline" size={11} color="#10b981" />
                  <Text style={styles.deductibleBadgeText}>Tax Deductible</Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {/* Needs-review banner */}
        {status === 'needs_review' && (
          <View style={[styles.banner, { backgroundColor: t.needsReviewBg, borderColor: t.needsReview }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={t.needsReview} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: t.needsReview }]}>Needs review</Text>
              <Text style={[styles.bannerBody, { color: t.textPrimary }]}>
                Check the details below and tap Save when done.
              </Text>
            </View>
          </View>
        )}

        {/* ── Vendor ───────────────────────────────────────────────────── */}
        <Section tokens={t} title="VENDOR">
          <FormInput tokens={t} value={merchant} onChange={setMerchant} placeholder="Required" />
        </Section>

        {/* ── Date ─────────────────────────────────────────────────────── */}
        <Section tokens={t} title="DATE">
          <FormInput tokens={t} value={date} onChange={setDate} placeholder="YYYY-MM-DD" keyboardType="numeric" />
        </Section>

        {/* ── Amount ───────────────────────────────────────────────────── */}
        <Section tokens={t} title="AMOUNT">
          <View style={styles.row}>
            <View style={{ flex: 2 }}>
              <FormLabel tokens={t}>Total</FormLabel>
              <FormInput tokens={t} value={total} onChange={setTotal} keyboardType="decimal-pad" placeholder="0.00" error={numbersDisagree} />
            </View>
            <View style={{ flex: 1 }}>
              <FormLabel tokens={t}>Currency</FormLabel>
              <FormInput tokens={t} value={cur} onChange={setCur} maxLength={3} autoCapitalize="characters" />
            </View>
          </View>
          {numbersDisagree && (
            <Text style={[styles.errorText, { color: t.danger }]}>
              Subtotal + {taxLabel} doesn't match total — please double-check.
            </Text>
          )}
          <View style={[styles.row, { marginTop: 8 }]}>
            <View style={{ flex: 1 }}>
              <FormLabel tokens={t}>Subtotal</FormLabel>
              <FormInput tokens={t} value={subtotal} onChange={setSubtotal} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
            <View style={{ flex: 1 }}>
              <FormLabel tokens={t}>{taxLabel}{taxMode === 'inclusive' ? ' (incl.)' : ''}</FormLabel>
              <FormInput tokens={t} value={tax} onChange={setTax} keyboardType="decimal-pad" placeholder="0.00" />
            </View>
          </View>
        </Section>

        {/* ── Category ─────────────────────────────────────────────────── */}
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
                {selectedCategory ? (
                  <>
                    <MaterialCommunityIcons name={selectedCategory.icon as any} size={18} color={selectedCategory.color} />
                    <Text style={[styles.dropdownText, { color: t.textPrimary, flex: 1 }]}>{selectedCategory.name}</Text>
                    {selectedCategory.tax_deductible && (
                      <View style={[styles.deductibleBadge, { backgroundColor: '#10b98122' }]}>
                        <Text style={styles.deductibleBadgeText}>Deductible</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={[styles.dropdownText, { color: t.textSubtle, flex: 1 }]}>Select category</Text>
                )}
                <MaterialCommunityIcons name="chevron-down" size={20} color={t.textMuted} />
              </TouchableOpacity>
            }
          >
            {dbCategories.map((cat) => (
              <Menu.Item
                key={cat.id}
                leadingIcon={() => (
                  <MaterialCommunityIcons name={cat.icon as any} size={18} color={cat.color} />
                )}
                title={cat.name}
                trailingIcon={cat.tax_deductible ? () => (
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color="#10b981" />
                ) : undefined}
                onPress={() => handleCategoryChange(cat)}
              />
            ))}
          </Menu>
        </Section>

        {/* ── Payment method ────────────────────────────────────────────── */}
        <Section tokens={t} title="PAYMENT METHOD">
          <Menu
            visible={paymentMenuOpen}
            onDismiss={() => setPaymentMenuOpen(false)}
            anchor={
              <TouchableOpacity
                onPress={() => setPaymentMenuOpen(true)}
                activeOpacity={0.7}
                style={[styles.dropdownBtn, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}
              >
                <MaterialCommunityIcons
                  name={paymentMethod === 'Cash' ? 'cash' : 'credit-card-outline'}
                  size={18}
                  color={paymentMethod ? t.accent : t.textSubtle}
                />
                <Text style={[styles.dropdownText, { color: paymentMethod ? t.textPrimary : t.textSubtle, flex: 1 }]}>
                  {paymentMethod || 'Select payment method'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={t.textMuted} />
              </TouchableOpacity>
            }
          >
            {PAYMENT_METHODS.map((pm) => (
              <Menu.Item key={pm} title={pm} onPress={() => { setPaymentMethod(pm); setPaymentMenuOpen(false); }} />
            ))}
            <Menu.Item title="Clear" titleStyle={{ color: '#888' }} onPress={() => { setPaymentMethod(''); setPaymentMenuOpen(false); }} />
          </Menu>
        </Section>

        {/* ── Invoice number ────────────────────────────────────────────── */}
        <Section tokens={t} title="INVOICE / RECEIPT NUMBER">
          <FormInput tokens={t} value={invoiceNumber} onChange={setInvoiceNumber} placeholder="Optional — e.g. INV-1042" />
        </Section>

        {/* ── Toggles ───────────────────────────────────────────────────── */}
        <ToggleCard
          tokens={t}
          icon="cash-multiple"
          title="Tax deductible"
          subtitle={isTaxDeductible ? 'Counts toward your deductible total' : 'Mark as a business expense'}
          value={isTaxDeductible}
          onChange={handleDeductibleToggle}
          activeColor="#10b981"
        />
        <ToggleCard
          tokens={t}
          icon="briefcase-outline"
          title="Reimbursable"
          subtitle={isReimbursable ? 'Included in reimbursement exports' : 'Mark if your employer owes you this'}
          value={isReimbursable}
          onChange={(v) => { setIsReimbursable(v); hapticLight(); }}
          activeColor={t.accent}
        />
        <ToggleCard
          tokens={t}
          icon="swap-horizontal"
          title="Refund / credit note"
          subtitle={isRefund ? 'This receipt represents money returned to you' : 'Mark if this is a refund'}
          value={isRefund}
          onChange={(v) => { setIsRefund(v); hapticLight(); }}
          activeColor={t.warning ?? '#f59e0b'}
        />

        {/* ── Report assignment ─────────────────────────────────────────── */}
        <Section tokens={t} title="REPORT">
          <Menu
            visible={reportMenuOpen}
            onDismiss={() => setReportMenuOpen(false)}
            anchor={
              <TouchableOpacity
                onPress={() => setReportMenuOpen(true)}
                activeOpacity={0.7}
                style={[styles.dropdownBtn, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}
              >
                <MaterialCommunityIcons name="folder-outline" size={18} color={selectedReportId ? t.accent : t.textSubtle} />
                <Text style={[styles.dropdownText, { color: selectedReportId ? t.textPrimary : t.textSubtle, flex: 1 }]}>
                  {reports.find((r) => r.id === selectedReportId)?.name ?? 'No report assigned'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color={t.textMuted} />
              </TouchableOpacity>
            }
          >
            <Menu.Item
              title="No report"
              titleStyle={{ color: '#888' }}
              onPress={() => { setSelectedReportId(null); setReportMenuOpen(false); }}
            />
            {reports.map((r) => (
              <Menu.Item
                key={r.id}
                title={r.name}
                onPress={() => { setSelectedReportId(r.id); setReportMenuOpen(false); }}
              />
            ))}
          </Menu>
        </Section>

        {/* ── Additional photos ─────────────────────────────────────────── */}
        <Section
          tokens={t}
          title={`PAGES${extraImgs.length > 0 ? ` (${extraImgs.length + 1} total)` : ''}`}
          rightAction={
            <TouchableOpacity onPress={addExtraPhoto} style={styles.addBtn} hitSlop={10}>
              <MaterialCommunityIcons name="plus-circle-outline" size={18} color={t.accent} />
              <Text style={[styles.addBtnText, { color: t.accent }]}>Add page</Text>
            </TouchableOpacity>
          }
        >
          {extraImgs.length === 0 ? (
            <Text style={[styles.lineEmpty, { color: t.textSubtle }]}>
              Tap "Add page" for multi-page receipts
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {extraImgs.map((uri, i) => (
                <View key={uri} style={styles.extraImgWrap}>
                  <Image source={{ uri }} style={styles.extraImg} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.extraImgRemove}
                    onPress={() => setExtraImgs((prev) => prev.filter((_, idx) => idx !== i))}
                    hitSlop={6}
                  >
                    <MaterialCommunityIcons name="close-circle" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.extraImgLabel}>Page {i + 2}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* ── Line items ────────────────────────────────────────────────── */}
        <Section
          tokens={t}
          title={`LINE ITEMS${lineItems.length > 0 ? ` (${lineItems.length})` : ''}`}
          rightAction={
            <TouchableOpacity onPress={addLineItem} style={styles.addBtn} hitSlop={10}>
              <MaterialCommunityIcons name="plus-circle-outline" size={18} color={t.accent} />
              <Text style={[styles.addBtnText, { color: t.accent }]}>Add item</Text>
            </TouchableOpacity>
          }
        >
          {lineItems.length === 0 ? (
            <Text style={[styles.lineEmpty, { color: t.textSubtle }]}>
              Add individual items from a long receipt
            </Text>
          ) : (
            <View style={{ gap: 12 }}>
              {lineItems.map((item, i) => (
                <LineItemRow
                  key={i} tokens={t} item={item}
                  onChange={(patch) => updateLineItem(i, patch)}
                  onRemove={() => setLineItems((items) => items.filter((_, idx) => idx !== i))}
                />
              ))}
            </View>
          )}
        </Section>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <Section tokens={t} title="NOTES">
          <FormInput tokens={t} value={notes} onChange={setNotes} multiline minHeight={70} placeholder="Optional" />
        </Section>
      </ScrollView>

      {/* Sticky save button */}
      <View style={[styles.saveBar, { backgroundColor: t.background, borderTopColor: t.border, paddingBottom: insets.bottom + 8 }]}>
        <SpringButton
          style={[styles.saveBtn, { backgroundColor: t.cta }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <MaterialCommunityIcons name="check" size={20} color={t.ctaText} />
          <Text style={[styles.saveBtnText, { color: t.ctaText }]}>
            {saving ? 'Saving…' : 'Save Receipt'}
          </Text>
        </SpringButton>
      </View>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  tokens, title, children, rightAction,
}: {
  tokens: SemanticTokens; title: string; children: React.ReactNode; rightAction?: React.ReactNode;
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
  tokens, value, onChange, placeholder, keyboardType, multiline,
  minHeight, maxLength, autoCapitalize, error, small,
}: {
  tokens: SemanticTokens; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
  minHeight?: number; maxLength?: number; autoCapitalize?: any;
  error?: boolean; small?: boolean;
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

function ToggleCard({
  tokens, icon, title, subtitle, value, onChange, activeColor,
}: {
  tokens: SemanticTokens; icon: string; title: string; subtitle: string;
  value: boolean; onChange: (v: boolean) => void; activeColor: string;
}) {
  return (
    <View style={[
      styles.toggleCard,
      { backgroundColor: value ? activeColor + '14' : tokens.surface, borderColor: value ? activeColor + '55' : tokens.border },
    ]}>
      <MaterialCommunityIcons name={icon as any} size={20} color={value ? activeColor : tokens.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleTitle, { color: value ? activeColor : tokens.textPrimary }]}>{title}</Text>
        <Text style={[styles.toggleSub, { color: tokens.textMuted }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: tokens.surfaceElevated, true: activeColor }}
        thumbColor="#fff"
      />
    </View>
  );
}

function LineItemRow({
  tokens, item, onChange, onRemove,
}: {
  tokens: SemanticTokens; item: LineItem;
  onChange: (patch: Partial<LineItem>) => void; onRemove: () => void;
}) {
  return (
    <View style={[styles.lineItemCard, { backgroundColor: tokens.surfaceElevated, borderColor: tokens.border }]}>
      <View style={styles.lineItemHeader}>
        <View style={{ flex: 1 }}>
          <FormLabel tokens={tokens}>Description</FormLabel>
          <FormInput tokens={tokens} value={item.description} onChange={(v) => onChange({ description: v })} placeholder="e.g. Coffee" small />
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={12} style={styles.removeBtn}>
          <MaterialCommunityIcons name="close-circle-outline" size={22} color={tokens.danger} />
        </TouchableOpacity>
      </View>
      <View style={[styles.row, { marginTop: 8 }]}>
        <View style={{ flex: 1 }}>
          <FormLabel tokens={tokens}>Qty</FormLabel>
          <FormInput tokens={tokens} value={String(item.quantity)} onChange={(v) => onChange({ quantity: parseFloat(v) || 0 })} keyboardType="decimal-pad" small />
        </View>
        <View style={{ flex: 1 }}>
          <FormLabel tokens={tokens}>Unit price</FormLabel>
          <FormInput tokens={tokens} value={String(item.unit_price)} onChange={(v) => onChange({ unit_price: parseFloat(v) || 0 })} keyboardType="decimal-pad" small />
        </View>
        <View style={{ flex: 1 }}>
          <FormLabel tokens={tokens}>Line total</FormLabel>
          <FormInput tokens={tokens} value={String(item.total)} onChange={(v) => onChange({ total: parseFloat(v) || 0 })} keyboardType="decimal-pad" small />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stickyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 14 },

  heroRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  heroImage: { flex: 1, height: 150, borderRadius: 14 },
  heroCard: {
    width: 112, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    padding: 10, gap: 6,
  },
  heroName: { fontFamily: 'Inter_600SemiBold', fontSize: 11, textAlign: 'center', lineHeight: 15 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3,
  },
  categoryChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 0.2 },
  deductibleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3,
  },
  deductibleBadgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 9, color: '#10b981', letterSpacing: 0.2 },

  banner: {
    flexDirection: 'row', gap: 12, padding: 14,
    borderRadius: 14, borderWidth: 1, alignItems: 'center',
  },
  bannerTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, marginBottom: 2 },
  bannerBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 },

  sectionTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6, marginLeft: 4, marginRight: 4,
  },
  sectionLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8 },
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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, minHeight: 44,
  },
  dropdownText: { fontFamily: 'Inter_500Medium', fontSize: 15 },

  toggleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  toggleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 2 },
  toggleSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },

  extraImgWrap: { marginRight: 8, position: 'relative' },
  extraImg: { width: 80, height: 100, borderRadius: 10 },
  extraImgRemove: { position: 'absolute', top: 4, right: 4 },
  extraImgLabel: { textAlign: 'center', fontSize: 10, color: '#888', marginTop: 4, fontFamily: 'Inter_400Regular' },

  lineEmpty: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, padding: 4 },
  lineItemCard: { borderRadius: 12, borderWidth: 1, padding: 10 },
  lineItemHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  removeBtn: { padding: 4, marginBottom: 4 },

  saveBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingTop: 12, borderTopWidth: 1,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, padding: 16, minHeight: 52,
  },
  saveBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
});
