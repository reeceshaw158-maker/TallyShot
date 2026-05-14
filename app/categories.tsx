/**
 * Categories management screen — Step 4
 *
 * Lists all active categories. Tapping a category opens the edit sheet.
 * FAB adds a custom category. Default categories can be archived but not deleted.
 * Custom categories can be archived or permanently deleted.
 */
import { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  Alert, StatusBar, Switch, Modal, FlatList,
} from 'react-native';
import { Text } from 'react-native-paper';
import { router, useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getAllCategories, insertCategory, updateCategory,
  archiveCategory, CategoryDraft,
} from '../src/db/categories';
import { DbCategory } from '../src/types';
import { useThemeTokens, SemanticTokens } from '../src/theme';
import { hapticLight, hapticMedium, hapticHeavy } from '../src/utils/haptics';

// ── Icon picker options ────────────────────────────────────────────────────
const ICON_OPTIONS = [
  'office-building-outline', 'train-car', 'silverware-fork-knife', 'bed-outline',
  'gas-station-outline', 'laptop', 'briefcase-outline', 'bullhorn-outline',
  'lightning-bolt-outline', 'account-outline', 'dots-horizontal-circle-outline',
  'car-outline', 'airplane-outline', 'shopping-outline', 'medical-bag',
  'home-outline', 'phone-outline', 'camera-outline', 'wrench-outline',
  'chart-bar', 'gift-outline', 'bicycle-outline', 'coffee-outline',
  'book-outline', 'tools', 'palette-outline', 'wifi', 'shield-outline',
];

const COLOR_OPTIONS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444',
  '#6366f1', '#10b981', '#0ea5e9', '#64748b', '#94a3b8',
  '#ec4899', '#14b8a6', '#84cc16', '#a855f7', '#f43f5e',
];

// ── Empty state ────────────────────────────────────────────────────────────
const DEFAULT_DRAFT: CategoryDraft = {
  name: '',
  icon: 'dots-horizontal-circle-outline',
  color: '#6366f1',
  tax_deductible: false,
};

export default function CategoriesScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/Add sheet state
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editing, setEditing] = useState<DbCategory | null>(null);
  const [draft, setDraft] = useState<CategoryDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const cats = await getAllCategories();
    setCategories(cats);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => {
    setEditing(null);
    setDraft(DEFAULT_DRAFT);
    setSheetVisible(true);
    hapticLight();
  };

  const openEdit = (cat: DbCategory) => {
    setEditing(cat);
    setDraft({ name: cat.name, icon: cat.icon, color: cat.color, tax_deductible: cat.tax_deductible });
    setSheetVisible(true);
    hapticLight();
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Please enter a category name.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, draft);
      } else {
        await insertCategory(draft);
      }
      hapticMedium();
      setSheetVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = (cat: DbCategory) => {
    hapticHeavy();
    const isDefault = cat.is_default;
    Alert.alert(
      `Archive "${cat.name}"?`,
      isDefault
        ? 'This is a default category. You can archive it and it will stop appearing in the picker. You can restore it later from archived categories.'
        : 'This category will be hidden from the picker. Receipts using it will keep their existing category.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            await archiveCategory(cat.id);
            hapticMedium();
            setSheetVisible(false);
            await load();
          },
        },
      ]
    );
  };

  const defaultCats = categories.filter((c) => c.is_default);
  const customCats = categories.filter((c) => !c.is_default);

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Categories</Text>
        <TouchableOpacity onPress={openAdd} hitSlop={12} style={styles.headerBtn}>
          <MaterialCommunityIcons name="plus" size={24} color={t.cta} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>

        {/* Default categories */}
        <Text style={[styles.sectionLabel, { color: t.textSubtle }]}>DEFAULT</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          {defaultCats.map((cat, i) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              tokens={t}
              onPress={() => openEdit(cat)}
              isLast={i === defaultCats.length - 1}
            />
          ))}
          {defaultCats.length === 0 && (
            <Text style={[styles.emptyRow, { color: t.textSubtle }]}>No default categories</Text>
          )}
        </View>

        {/* Custom categories */}
        {customCats.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: t.textSubtle }]}>CUSTOM</Text>
            <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
              {customCats.map((cat, i) => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  tokens={t}
                  onPress={() => openEdit(cat)}
                  isLast={i === customCats.length - 1}
                />
              ))}
            </View>
          </>
        )}

        {/* Add button */}
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: t.cta }]}
          onPress={openAdd}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add Custom Category</Text>
        </TouchableOpacity>

        <Text style={[styles.hint, { color: t.textSubtle }]}>
          Default categories can be archived but not deleted. Custom categories can be removed.
        </Text>
      </ScrollView>

      {/* Add / Edit sheet */}
      <CategorySheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        editing={editing}
        draft={draft}
        setDraft={setDraft}
        onSave={handleSave}
        onArchive={editing ? () => handleArchive(editing) : undefined}
        saving={saving}
        tokens={t}
        insets={insets}
      />
    </View>
  );
}

// ── Category row ───────────────────────────────────────────────────────────
function CategoryRow({
  cat, tokens, onPress, isLast,
}: {
  cat: DbCategory; tokens: SemanticTokens;
  onPress: () => void; isLast: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: tokens.border }]}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: cat.color + '22' }]}>
        <MaterialCommunityIcons name={cat.icon as any} size={20} color={cat.color} />
      </View>

      {/* Name + badges */}
      <View style={{ flex: 1 }}>
        <Text style={[styles.catName, { color: tokens.textPrimary }]}>{cat.name}</Text>
        <View style={styles.badges}>
          {cat.tax_deductible && (
            <View style={[styles.badge, { backgroundColor: '#10b98122' }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={10} color="#10b981" />
              <Text style={[styles.badgeText, { color: '#10b981' }]}>Tax deductible</Text>
            </View>
          )}
          {!cat.is_default && (
            <View style={[styles.badge, { backgroundColor: tokens.accent + '22' }]}>
              <Text style={[styles.badgeText, { color: tokens.accent }]}>Custom</Text>
            </View>
          )}
        </View>
      </View>

      <MaterialCommunityIcons name="chevron-right" size={18} color={tokens.textSubtle} />
    </TouchableOpacity>
  );
}

// ── Add / Edit sheet ───────────────────────────────────────────────────────
function CategorySheet({
  visible, onClose, editing, draft, setDraft,
  onSave, onArchive, saving, tokens, insets,
}: {
  visible: boolean;
  onClose: () => void;
  editing: DbCategory | null;
  draft: CategoryDraft;
  setDraft: (d: CategoryDraft) => void;
  onSave: () => void;
  onArchive?: () => void;
  saving: boolean;
  tokens: SemanticTokens;
  insets: { bottom: number; top: number };
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheetRoot, { backgroundColor: tokens.background }]}>
        {/* Sheet header */}
        <View style={[styles.sheetHeader, { borderBottomColor: tokens.border }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.sheetCancel, { color: tokens.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.sheetTitle, { color: tokens.textPrimary }]}>
            {editing ? 'Edit Category' : 'New Category'}
          </Text>
          <TouchableOpacity onPress={onSave} disabled={saving} hitSlop={12}>
            <Text style={[styles.sheetSave, { color: tokens.cta, opacity: saving ? 0.5 : 1 }]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.sheetScroll, { paddingBottom: insets.bottom + 40 }]}>

          {/* Preview */}
          <View style={styles.preview}>
            <View style={[styles.previewIcon, { backgroundColor: draft.color + '22' }]}>
              <MaterialCommunityIcons name={draft.icon as any} size={32} color={draft.color} />
            </View>
            <Text style={[styles.previewName, { color: tokens.textPrimary }]}>
              {draft.name || 'Category name'}
            </Text>
            {draft.tax_deductible && (
              <View style={[styles.badge, { backgroundColor: '#10b98122' }]}>
                <MaterialCommunityIcons name="check-circle-outline" size={11} color="#10b981" />
                <Text style={[styles.badgeText, { color: '#10b981' }]}>Tax deductible</Text>
              </View>
            )}
          </View>

          {/* Name */}
          <SheetLabel tokens={tokens}>Name</SheetLabel>
          <TextInput
            value={draft.name}
            onChangeText={(v) => setDraft({ ...draft, name: v })}
            placeholder="e.g. Client Entertainment"
            placeholderTextColor={tokens.textSubtle}
            style={[styles.nameInput, { backgroundColor: tokens.surface, borderColor: tokens.border, color: tokens.textPrimary }]}
            maxLength={40}
            autoFocus={!editing}
          />

          {/* Tax deductible toggle */}
          <View style={[
            styles.toggleRow,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
            draft.tax_deductible && { borderColor: '#10b98155', backgroundColor: '#10b98110' },
          ]}>
            <MaterialCommunityIcons
              name="cash-multiple"
              size={20}
              color={draft.tax_deductible ? '#10b981' : tokens.textMuted}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleTitle, { color: draft.tax_deductible ? '#10b981' : tokens.textPrimary }]}>
                Tax deductible
              </Text>
              <Text style={[styles.toggleSub, { color: tokens.textMuted }]}>
                Receipts in this category default to deductible
              </Text>
            </View>
            <Switch
              value={draft.tax_deductible}
              onValueChange={(v) => setDraft({ ...draft, tax_deductible: v })}
              trackColor={{ false: tokens.surfaceElevated, true: '#10b981' }}
              thumbColor="#fff"
            />
          </View>

          {/* Color picker */}
          <SheetLabel tokens={tokens}>Colour</SheetLabel>
          <View style={styles.colorGrid}>
            {COLOR_OPTIONS.map((color) => (
              <TouchableOpacity
                key={color}
                onPress={() => { setDraft({ ...draft, color }); hapticLight(); }}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: color },
                  draft.color === color && styles.colorSwatchSelected,
                ]}
              >
                {draft.color === color && (
                  <MaterialCommunityIcons name="check" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Icon picker */}
          <SheetLabel tokens={tokens}>Icon</SheetLabel>
          <View style={styles.iconGrid}>
            {ICON_OPTIONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                onPress={() => { setDraft({ ...draft, icon }); hapticLight(); }}
                style={[
                  styles.iconOption,
                  {
                    backgroundColor: draft.icon === icon ? draft.color + '22' : tokens.surface,
                    borderColor: draft.icon === icon ? draft.color : tokens.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={icon as any}
                  size={22}
                  color={draft.icon === icon ? draft.color : tokens.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          {/* Archive button (edit mode only) */}
          {editing && onArchive && (
            <TouchableOpacity
              style={[styles.archiveBtn, { borderColor: tokens.danger + '55' }]}
              onPress={onArchive}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="archive-outline" size={18} color={tokens.danger} />
              <Text style={[styles.archiveBtnText, { color: tokens.danger }]}>
                {editing.is_default ? 'Archive category' : 'Archive category'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SheetLabel({ tokens, children }: { tokens: SemanticTokens; children: string }) {
  return (
    <Text style={[styles.sheetLabel, { color: tokens.textSubtle }]}>{children.toUpperCase()}</Text>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  scroll: { padding: 16, gap: 8 },
  sectionLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8,
    marginBottom: 6, marginLeft: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catName: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  emptyRow: { padding: 16, fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, padding: 14, marginTop: 4,
  },
  addBtnText: { fontFamily: 'Inter_700Bold', fontSize: 15, color: '#fff' },

  hint: {
    fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center',
    lineHeight: 17, paddingHorizontal: 16, marginTop: 4,
  },

  // Sheet
  sheetRoot: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 20, borderBottomWidth: 1,
  },
  sheetTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  sheetCancel: { fontFamily: 'Inter_500Medium', fontSize: 16 },
  sheetSave: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  sheetScroll: { padding: 20, gap: 10 },
  sheetLabel: {
    fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0.8,
    marginTop: 8, marginBottom: 6, marginLeft: 2,
  },

  preview: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  previewIcon: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  previewName: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },

  nameInput: {
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: 'Inter_500Medium', fontSize: 16, minHeight: 48,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  toggleTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 2 },
  toggleSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: {
    width: 48, height: 48, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  archiveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 16,
  },
  archiveBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
