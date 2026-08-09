/**
 * Scan result screen — product details + AI summary + AI voice assistant.
 *
 * Layout (Found state):
 *   Spring slide-up entry → Hero card → Grade pills → Nutrition pills →
 *   Allergen box → AI Summary card (skeleton → reveal) → AI Chat →
 *   Nutrition table → Ingredients → Footer → Action buttons
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, ScrollView, Image, Linking,
  TextInput, KeyboardAvoidingView, Platform, Animated, Easing, TouchableOpacity,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

import { useThemeTokens, SemanticTokens } from '../../../src/theme';
import { SpringButton } from '../../../src/components/SpringButton';
import {
  lookup, refresh, LookupResult, ProductRecord, ProductSource,
  ProductLookupOffline,
} from '../../../src/services/productCache';
import { generateAiSummary } from '../../../src/services/aiSummary';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'found'; record: ProductRecord; refreshing: boolean }
  | { kind: 'not_found'; record: ProductRecord }
  | { kind: 'not_grocery'; record: ProductRecord }
  | { kind: 'offline' }
  | { kind: 'error'; message?: string };

interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

function makeBlank(barcode: string, status: 'not_found' | 'not_grocery' = 'not_found'): ProductRecord {
  return {
    barcode, status,
    name: null, brand: null, imageUrl: null, categories: null, quantity: null,
    nutriscore: null, novaGroup: null, ecoscore: null, nutriments: null,
    ingredients: null, allergens: null, countries: null,
    fetchedAt: new Date().toISOString(),
    source: 'openfoodfacts' as ProductSource,
    aiSummary: null, aiGeneratedAt: null, lastSeenAt: null, description: null,
  };
}

export default function ScanResultScreen() {
  const t = useThemeTokens();
  const insets = useSafeAreaInsets();
  const { barcode, state: stateParam } =
    useLocalSearchParams<{ barcode: string; state?: string }>();

  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
    Speech.stop();
  }, []);

  const safeSet = useCallback((v: ViewState) => {
    if (mounted.current) setView(v);
  }, []);

  const run = useCallback(async () => {
    const rawBarcode = String(barcode ?? '').replace(/\D/g, '');
    if (!rawBarcode || rawBarcode.length < 6) {
      safeSet({ kind: 'not_found', record: makeBlank(rawBarcode) });
      return;
    }

    if (stateParam) {
      const blank = makeBlank(rawBarcode);
      if (stateParam === 'not_found')   { safeSet({ kind: 'not_found', record: blank }); return; }
      if (stateParam === 'not_grocery') { safeSet({ kind: 'not_grocery', record: blank }); return; }
      if (stateParam === 'offline')     { safeSet({ kind: 'offline' }); return; }
      if (stateParam === 'error')       { safeSet({ kind: 'error' }); return; }
      if (stateParam === 'found') {
        safeSet({ kind: 'found', record: { ...blank, status: 'found', name: 'Demo product', brand: 'Demo brand' }, refreshing: false });
        return;
      }
    }

    safeSet({ kind: 'loading' });
    try {
      const result: LookupResult = await lookup(rawBarcode);
      const { record, refreshing } = result;
      if (record.status === 'found')            safeSet({ kind: 'found',       record, refreshing });
      else if (record.status === 'not_grocery') safeSet({ kind: 'not_grocery', record });
      else                                      safeSet({ kind: 'not_found',   record });
    } catch (err: any) {
      if (err instanceof ProductLookupOffline) safeSet({ kind: 'offline' });
      else                                     safeSet({ kind: 'error', message: err?.message });
    }
  }, [barcode, stateParam, safeSet]);

  useEffect(() => { run(); }, [run]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <SpringButton style={styles.iconBtn} onPress={() => { Speech.stop(); router.back(); }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={t.textPrimary} />
        </SpringButton>
        <Text style={[styles.headerTitle, { color: t.textPrimary }]}>Product</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {view.kind === 'loading'     && <Loading      t={t} barcode={String(barcode ?? '')} />}
        {view.kind === 'found'       && <Found        t={t} record={view.record} refreshing={view.refreshing} onRefresh={() => doRefresh(view.record.barcode, safeSet)} />}
        {view.kind === 'not_found'   && <NotFound     t={t} barcode={String(barcode)} />}
        {view.kind === 'not_grocery' && <NotGrocery   t={t} record={view.record} />}
        {view.kind === 'offline'     && <Offline      t={t} onRetry={run} />}
        {view.kind === 'error'       && <ErrorState   t={t} message={view.message} onRetry={run} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

async function doRefresh(barcode: string, safeSet: (v: ViewState) => void) {
  try {
    const record = await refresh(barcode);
    if (record.status === 'found')            safeSet({ kind: 'found',       record, refreshing: false });
    else if (record.status === 'not_grocery') safeSet({ kind: 'not_grocery', record });
    else                                      safeSet({ kind: 'not_found',   record });
  } catch (err: any) {
    if (err instanceof ProductLookupOffline) safeSet({ kind: 'offline' });
    else                                     safeSet({ kind: 'error', message: err?.message });
  }
}

// ── AI Summary Card ──────────────────────────────────────────────────────────

function AiSummaryCard({ t, record }: { t: SemanticTokens; record: ProductRecord }) {
  const [summary, setSummary] = useState<string | null>(record.aiSummary ?? null);
  const [loading, setLoading] = useState(!record.aiSummary);
  const revealAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  // Skeleton pulse
  useEffect(() => {
    if (!loading) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.8, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [loading]);

  useEffect(() => {
    if (record.aiSummary) {
      setSummary(record.aiSummary);
      setLoading(false);
      revealAnim.setValue(1);
      return;
    }
    setLoading(true);
    let cancelled = false;
    generateAiSummary(record).then((result) => {
      if (cancelled) return;
      if (result) setSummary(result);
      setLoading(false);
      Animated.timing(revealAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [record.barcode]);

  return (
    <View style={[styles.summaryCard, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.summaryCardHeader}>
        <View style={[styles.summaryIcon, { backgroundColor: t.accent + '18' }]}>
          <MaterialCommunityIcons name="robot-outline" size={15} color={t.accent} />
        </View>
        <Text style={[styles.summaryCardTitle, { color: t.accent }]}>AI VERDICT</Text>
      </View>

      {loading ? (
        <View style={styles.skeletonWrap}>
          <Animated.View style={[styles.skeletonLine, { backgroundColor: t.border, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeletonLineShort, { backgroundColor: t.border, opacity: pulseAnim }]} />
        </View>
      ) : summary ? (
        <Animated.View style={{ opacity: revealAnim }}>
          <Text style={[styles.summaryText, { color: t.textPrimary }]}>{summary}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ── AI Product Chat ──────────────────────────────────────────────────────────

function AIProductChat({ t, record }: { t: SemanticTokens; record: ProductRecord }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (speaking) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
      return undefined;
    }
  }, [speaking, pulseAnim]);

  const speakAnswer = useCallback(async (text: string) => {
    if (!voiceEnabled) return;
    await Speech.stop();
    setSpeaking(true);
    Speech.speak(text, {
      language: 'en-GB',
      rate: 0.95,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, [voiceEnabled]);

  const send = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    await Speech.stop();
    setSpeaking(false);

    try {
      const workerUrl = process.env.EXPO_PUBLIC_WORKER_URL;
      const resp = await fetch(`${workerUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            name: record.name,
            brand: record.brand,
            quantity: record.quantity,
            nutriscore: record.nutriscore,
            novaGroup: record.novaGroup,
            ecoscore: record.ecoscore,
            allergens: record.allergens,
            ingredients: record.ingredients,
            nutriments: record.nutriments,
            countries: record.countries,
          },
          question: q,
        }),
      });

      if (!resp.ok) throw new Error(`Server error ${resp.status}`);
      const data = await resp.json() as { answer: string };
      const answer = data.answer || 'Sorry, I couldn\'t get an answer right now.';
      setMessages(prev => [...prev, { role: 'ai', text: answer }]);
      speakAnswer(answer);
    } catch {
      const errMsg = 'Sorry, I couldn\'t reach the AI right now. Check your connection.';
      setMessages(prev => [...prev, { role: 'ai', text: errMsg }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, record, speakAnswer]);

  const replaySpeech = useCallback(() => {
    const last = [...messages].reverse().find(m => m.role === 'ai');
    if (last) speakAnswer(last.text);
  }, [messages, speakAnswer]);

  const SUGGESTIONS = (() => {
    const list: string[] = [];
    if (record.allergens)                       list.push('What allergens does this contain?');
    if (record.novaGroup === 4)                 list.push('Is this ultra-processed?');
    if (record.nutriscore && ['c','d','e'].includes(record.nutriscore)) list.push('Is this healthy?');
    if (!list.includes('Is this healthy?'))     list.push('Is this healthy?');
    if (record.nutriments?.sugars100g != null && record.nutriments.sugars100g > 10)
                                                list.push('Is this OK for diabetics?');
    list.push('Is this vegan?');
    list.push('How much protein does this have?');
    return list.slice(0, 4);
  })();

  return (
    <View style={[styles.chatCard, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.chatHeader}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={[styles.chatAiDot, { backgroundColor: t.cta + '22' }]}>
            <MaterialCommunityIcons name="head-cog-outline" size={20} color={t.cta} />
          </View>
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.chatTitle, { color: t.textPrimary }]}>Ask AI About This Product</Text>
          <Text style={[styles.chatSub, { color: t.textMuted }]}>
            {speaking ? 'Speaking…' : 'Type or use your keyboard mic to ask'}
          </Text>
        </View>
        <SpringButton
          style={[styles.voiceToggle, { borderColor: t.border, backgroundColor: voiceEnabled ? t.cta + '22' : 'transparent' }]}
          onPress={async () => {
            if (voiceEnabled) { await Speech.stop(); setSpeaking(false); }
            setVoiceEnabled(v => !v);
          }}
        >
          <MaterialCommunityIcons
            name={voiceEnabled ? 'volume-high' : 'volume-off'}
            size={18}
            color={voiceEnabled ? t.cta : t.textMuted}
          />
        </SpringButton>
      </View>

      {messages.length === 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {SUGGESTIONS.map((s) => (
            <SpringButton
              key={s}
              style={[styles.chip, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}
              onPress={() => { setInput(s); inputRef.current?.focus(); }}
            >
              <Text style={[styles.chipText, { color: t.textPrimary }]}>{s}</Text>
            </SpringButton>
          ))}
        </ScrollView>
      )}

      {messages.length > 0 && (
        <View style={styles.messagesWrap}>
          {messages.map((m, i) => (
            <View
              key={i}
              style={[
                styles.bubble,
                m.role === 'user'
                  ? [styles.bubbleUser, { backgroundColor: t.cta }]
                  : [styles.bubbleAI, { backgroundColor: t.surfaceElevated, borderColor: t.border }],
              ]}
            >
              <Text style={[
                styles.bubbleText,
                { color: m.role === 'user' ? t.ctaText : t.textPrimary },
              ]}>
                {m.text}
              </Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
              <ActivityIndicator size="small" color={t.cta} />
            </View>
          )}
        </View>
      )}

      {messages.some(m => m.role === 'ai') && !speaking && voiceEnabled && (
        <SpringButton
          style={[styles.replayBtn, { borderColor: t.border }]}
          onPress={replaySpeech}
        >
          <MaterialCommunityIcons name="replay" size={14} color={t.textMuted} />
          <Text style={[styles.replayText, { color: t.textMuted }]}>Replay answer</Text>
        </SpringButton>
      )}

      <View style={[styles.inputRow, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything about this product…"
          placeholderTextColor={t.textSubtle}
          style={[styles.chatInput, { color: t.textPrimary }]}
          onSubmitEditing={send}
          returnKeyType="send"
          editable={!loading}
          multiline={false}
        />
        <SpringButton
          style={[styles.sendBtn, { backgroundColor: input.trim() ? t.cta : t.surfaceElevated }]}
          onPress={send}
          disabled={!input.trim() || loading}
        >
          <MaterialCommunityIcons
            name={loading ? 'dots-horizontal' : 'send'}
            size={18}
            color={input.trim() ? t.ctaText : t.textSubtle}
          />
        </SpringButton>
      </View>
    </View>
  );
}

// ── States ──────────────────────────────────────────────────────────────────

function Loading({ t, barcode }: { t: SemanticTokens; barcode: string }) {
  return (
    <View style={styles.stateWrap}>
      <ActivityIndicator color={t.accent} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>Looking up…</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>Barcode {barcode}</Text>
    </View>
  );
}

function Found({
  t, record, refreshing, onRefresh,
}: { t: SemanticTokens; record: ProductRecord; refreshing: boolean; onRefresh: () => void }) {
  const n = record.nutriments;

  // Spring slide-up entry
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 11, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogAsExpense = () => {
    const notes = [record.brand, record.quantity, record.barcode ? `Barcode: ${record.barcode}` : null]
      .filter(Boolean).join(' · ');
    const prefill = { merchant: record.name ?? '', category: 'Food & Drink', notes };
    router.replace({
      pathname: '/review/[id]',
      params: { id: 'new', prefill: JSON.stringify(prefill) },
    });
  };

  const sourceLabel = record.source === 'openbeautyfacts'
    ? 'Open Beauty Facts'
    : record.source === 'openproductsfacts'
      ? 'Open Products Facts'
      : 'Open Food Facts';

  return (
    <Animated.View
      style={[
        styles.foundWrap,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Hero card */}
      <View style={[styles.heroCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        {record.imageUrl ? (
          <Image source={{ uri: record.imageUrl }} style={styles.heroImage} resizeMode="contain" />
        ) : (
          <View style={[styles.heroImagePlaceholder, { backgroundColor: t.surfaceElevated }]}>
            <MaterialCommunityIcons name="package-variant" size={36} color={t.textSubtle} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.heroName, { color: t.textPrimary }]} numberOfLines={3}>
            {record.name ?? 'Unnamed product'}
          </Text>
          {record.brand ? (
            <Text style={[styles.heroBrand, { color: t.textMuted }]} numberOfLines={1}>{record.brand}</Text>
          ) : null}
          {record.quantity ? (
            <Text style={[styles.heroQty, { color: t.textSubtle }]}>{record.quantity}</Text>
          ) : null}
        </View>
      </View>

      {/* Grade pills */}
      <View style={styles.gradeRow}>
        <GradePill t={t} label="Nutri-Score" grade={record.nutriscore} />
        <GradePill t={t} label="Eco-Score"   grade={record.ecoscore} />
        <NovaPill  t={t} group={record.novaGroup} />
      </View>

      {/* Nutrition summary row */}
      {n && (
        <View style={styles.summaryPillRow}>
          <SummaryPill t={t} label="Fat"     value={fmtG(n.fat100g)} />
          <SummaryPill t={t} label="Sugar"   value={fmtG(n.sugars100g)} />
          <SummaryPill t={t} label="Salt"    value={fmtG(n.salt100g)} />
          <SummaryPill t={t} label="Protein" value={fmtG(n.proteins100g)} />
        </View>
      )}

      {/* Allergens */}
      {record.allergens ? (
        <View style={[styles.allergenBox, { backgroundColor: t.dangerBg, borderColor: t.danger }]}>
          <MaterialCommunityIcons name="alert-octagon" size={18} color={t.danger} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.allergenTitle, { color: t.danger }]}>Allergens</Text>
            <Text style={[styles.allergenList, { color: t.danger }]}>{prettyAllergens(record.allergens)}</Text>
          </View>
        </View>
      ) : null}

      {/* AI Summary */}
      <AiSummaryCard t={t} record={record} />

      {/* Country of origin */}
      {record.countries ? (
        <View style={[styles.metaRow, { backgroundColor: t.surface, borderColor: t.border }]}>
          <MaterialCommunityIcons name="earth" size={16} color={t.textMuted} />
          <Text style={[styles.metaLabel, { color: t.textMuted }]}>Country</Text>
          <Text style={[styles.metaValue, { color: t.textPrimary }]} numberOfLines={1}>
            {prettyCountries(record.countries)}
          </Text>
        </View>
      ) : null}

      {/* AI Product Chat */}
      <AIProductChat t={t} record={record} />

      {/* Nutrition table */}
      {record.nutriments ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Per 100g / 100ml</Text>
          <NutritionRow t={t} label="Energy"               value={fmtKcal(record.nutriments.energyKcal100g)} />
          <NutritionRow t={t} label="Fat"                  value={fmtG(record.nutriments.fat100g)} />
          <NutritionRow t={t} label="  of which saturates" value={fmtG(record.nutriments.saturatedFat100g)} indent />
          <NutritionRow t={t} label="Carbohydrates"        value={fmtG(record.nutriments.carbohydrates100g)} />
          <NutritionRow t={t} label="  of which sugars"    value={fmtG(record.nutriments.sugars100g)} indent />
          <NutritionRow t={t} label="Fibre"                value={fmtG(record.nutriments.fiber100g)} />
          <NutritionRow t={t} label="Protein"              value={fmtG(record.nutriments.proteins100g)} />
          <NutritionRow t={t} label="Salt"                 value={fmtG(record.nutriments.salt100g)} last />
        </View>
      ) : (
        <View style={[styles.card, styles.cardCenter, { backgroundColor: t.surface, borderColor: t.border }]}>
          <MaterialCommunityIcons name="nutrition" size={28} color={t.textSubtle} />
          <Text style={[styles.cardEmpty, { color: t.textMuted }]}>No nutrition data on this product yet.</Text>
        </View>
      )}

      {/* Ingredients */}
      {record.ingredients ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text style={[styles.cardTitle, { color: t.textPrimary }]}>Ingredients</Text>
          <Text style={[styles.ingredientsText, { color: t.textMuted }]}>{record.ingredients}</Text>
        </View>
      ) : null}

      {/* Footer */}
      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: t.textSubtle }]}>
          {refreshing ? 'Refreshing…' : `From ${sourceLabel} · ${fmtDate(record.fetchedAt)}`}
        </Text>
        <SpringButton onPress={onRefresh} style={[styles.refreshBtn, { borderColor: t.border }]}>
          <MaterialCommunityIcons name="refresh" size={14} color={t.textMuted} />
          <Text style={[styles.refreshBtnText, { color: t.textMuted }]}>Refresh</Text>
        </SpringButton>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <SpringButton
          style={[styles.cta, styles.ctaHalf, styles.ctaGhost, { borderColor: t.border }]}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="barcode-scan" size={16} color={t.textPrimary} />
          <Text style={[styles.ctaText, { color: t.textPrimary }]}>Scan another</Text>
        </SpringButton>
        <SpringButton
          style={[styles.cta, styles.ctaHalf, { backgroundColor: t.cta }]}
          onPress={handleLogAsExpense}
        >
          <Text style={[styles.ctaText, { color: t.ctaText }]}>Log as Expense →</Text>
        </SpringButton>
      </View>
    </Animated.View>
  );
}

function SummaryPill({ t, label, value }: { t: SemanticTokens; label: string; value: string }) {
  return (
    <View style={[styles.summaryPill, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={[styles.summaryPillValue, { color: t.textPrimary }]} numberOfLines={1}>{value}</Text>
      <Text style={[styles.summaryPillLabel, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

function prettyAllergens(raw: string): string {
  return raw
    .split(/[,;]/)
    .map((s) => s.replace(/^[a-z]{2}:/, '').trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, ' '))
    .join(', ');
}

function prettyCountries(raw: string): string {
  return raw
    .split(/[,;]/)
    .map((s) => s.replace(/^[a-z]{2}:/, '').trim().replace(/-/g, ' '))
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(', ');
}

function NotFound({ t, barcode }: { t: SemanticTokens; barcode: string }) {
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(true);
  const [productDesc, setProductDesc] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Auto-query AI the moment we land here — no typing required
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const workerUrl = process.env.EXPO_PUBLIC_WORKER_URL;
        const resp = await fetch(`${workerUrl}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: { barcode },
            question: `I scanned barcode ${barcode}. What product is this? What is it, what is it used for, and what are the main contents or ingredients? If you can identify the specific product give specific details. If uncertain, give your best assessment of the product category and what buyers should know. Answer in 3-5 sentences.`,
          }),
        });
        if (!resp.ok) throw new Error('failed');
        const data = await resp.json() as { answer: string };
        if (!cancelled) setAiAnswer((data.answer ?? '').trim() || null);
      } catch {
        if (!cancelled) setAiAnswer(null);
      } finally {
        if (!cancelled) setAutoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [barcode]);

  const askWithDesc = async () => {
    const q = productDesc.trim();
    if (!q || manualLoading) return;
    setManualLoading(true);
    setAiAnswer(null);
    try {
      const workerUrl = process.env.EXPO_PUBLIC_WORKER_URL;
      const resp = await fetch(`${workerUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: { barcode },
          question: `Tell me about "${q}" — what are the main ingredients or contents, what is it used for, and what should a buyer know? Be specific and honest in 3-4 sentences.`,
        }),
      });
      if (!resp.ok) throw new Error('failed');
      const data = await resp.json() as { answer: string };
      setAiAnswer((data.answer ?? '').trim() || 'No information found.');
    } catch {
      setAiAnswer('Couldn\'t reach AI. Check your connection and try again.');
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="barcode-scan" size={52} color={t.accent} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>Unknown product</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>
        Barcode {barcode} isn&apos;t in any database — asking AI to identify it.
      </Text>

      <View style={[styles.aiAskCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={styles.aiAskHeader}>
          <MaterialCommunityIcons name="robot-outline" size={18} color={t.accent} />
          <Text style={[styles.aiAskTitle, { color: t.textPrimary }]}>AI Product Lookup</Text>
        </View>

        {autoLoading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
            <ActivityIndicator size="small" color={t.accent} />
            <Text style={[styles.aiAskSub, { color: t.textMuted }]}>Identifying barcode {barcode}…</Text>
          </View>
        )}

        {!autoLoading && aiAnswer && (
          <View style={[styles.aiAnswerBox, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
            <Text style={[styles.aiAnswerText, { color: t.textPrimary }]}>{aiAnswer}</Text>
          </View>
        )}

        {!autoLoading && !aiAnswer && (
          <Text style={[styles.aiAskSub, { color: t.textMuted }]}>
            AI couldn&apos;t identify this barcode. Enter the product name below for a better result.
          </Text>
        )}

        <Text style={[styles.aiAskSub, { color: t.textSubtle, marginTop: 4 }]}>
          Know the product name? Type it for a more specific answer:
        </Text>
        <TextInput
          value={productDesc}
          onChangeText={setProductDesc}
          placeholder='e.g. "Lost Mary vape" or "Grenade Protein Bar"'
          placeholderTextColor={t.textSubtle}
          style={[styles.aiAskInput, { backgroundColor: t.surfaceElevated, borderColor: t.border, color: t.textPrimary }]}
          returnKeyType="send"
          onSubmitEditing={askWithDesc}
          editable={!manualLoading}
          multiline={false}
        />
        <TouchableOpacity
          style={[styles.aiAskBtn, { backgroundColor: productDesc.trim() ? t.cta : t.surfaceElevated }]}
          onPress={askWithDesc}
          activeOpacity={0.8}
          disabled={manualLoading || !productDesc.trim()}
        >
          {manualLoading ? (
            <ActivityIndicator size="small" color={t.ctaText} />
          ) : (
            <Text style={[styles.aiAskBtnText, { color: productDesc.trim() ? t.ctaText : t.textSubtle }]}>
              Ask AI
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <SpringButton
        style={[styles.cta, styles.ctaGhost, { borderColor: t.border, marginTop: 4 }]}
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons name="barcode-scan" size={16} color={t.textPrimary} />
        <Text style={[styles.ctaText, { color: t.textPrimary }]}>Scan another</Text>
      </SpringButton>
    </View>
  );
}

function NotGrocery({ t, record }: { t: SemanticTokens; record: ProductRecord }) {
  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="cart-off" size={56} color={t.textMuted} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>Not a grocery product</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>
        {record.name
          ? `"${record.name}"${record.brand ? ` by ${record.brand}` : ''} isn't a food or drink item.`
          : 'TallyShot focuses on food and household groceries.'}
      </Text>
      <SpringButton style={[styles.cta, { backgroundColor: t.cta }]} onPress={() => router.back()}>
        <Text style={[styles.ctaText, { color: t.ctaText }]}>Back to scanner</Text>
      </SpringButton>
    </View>
  );
}

function Offline({ t, onRetry }: { t: SemanticTokens; onRetry: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="wifi-off" size={56} color={t.textMuted} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>You&apos;re offline</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>
        We couldn&apos;t reach the product database and don&apos;t have this item cached.
      </Text>
      <SpringButton style={[styles.cta, { backgroundColor: t.cta }]} onPress={onRetry}>
        <Text style={[styles.ctaText, { color: t.ctaText }]}>Try again</Text>
      </SpringButton>
    </View>
  );
}

function ErrorState({ t, message, onRetry }: { t: SemanticTokens; message?: string; onRetry: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <MaterialCommunityIcons name="alert-circle-outline" size={56} color={t.danger} />
      <Text style={[styles.stateTitle, { color: t.textPrimary }]}>Couldn&apos;t load this product</Text>
      <Text style={[styles.stateBody, { color: t.textMuted }]}>
        {message ? `${message}. ` : ''}Check your connection and try again.
      </Text>
      <SpringButton style={[styles.cta, { backgroundColor: t.cta }]} onPress={onRetry}>
        <Text style={[styles.ctaText, { color: t.ctaText }]}>Try again</Text>
      </SpringButton>
    </View>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function GradePill({ t, label, grade }: { t: SemanticTokens; label: string; grade: string | null }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    a: { bg: '#00C896', fg: '#0F0F0F' },
    b: { bg: '#85BB2F', fg: '#0F0F0F' },
    c: { bg: '#FFCC00', fg: '#0F0F0F' },
    d: { bg: '#FF8C00', fg: '#0F0F0F' },
    e: { bg: '#FF4757', fg: '#FFFFFF' },
  };
  const palette = grade ? colors[grade] : null;
  return (
    <View style={[styles.gradePill, { backgroundColor: palette?.bg ?? t.surfaceElevated, borderColor: t.border }]}>
      <Text style={[styles.gradePillLabel, { color: palette ? palette.fg : t.textSubtle }]}>{label}</Text>
      <Text style={[styles.gradePillValue, { color: palette ? palette.fg : t.textMuted }]}>
        {grade ? grade.toUpperCase() : '—'}
      </Text>
    </View>
  );
}

function NovaPill({ t, group }: { t: SemanticTokens; group: number | null }) {
  const map: Record<number, { bg: string; fg: string }> = {
    1: { bg: '#00C896', fg: '#0F0F0F' },
    2: { bg: '#85BB2F', fg: '#0F0F0F' },
    3: { bg: '#FF8C00', fg: '#0F0F0F' },
    4: { bg: '#FF4757', fg: '#FFFFFF' },
  };
  const palette = group ? map[group] : null;
  return (
    <View style={[styles.gradePill, { backgroundColor: palette?.bg ?? t.surfaceElevated, borderColor: t.border }]}>
      <Text style={[styles.gradePillLabel, { color: palette ? palette.fg : t.textSubtle }]}>NOVA</Text>
      <Text style={[styles.gradePillValue, { color: palette ? palette.fg : t.textMuted }]}>
        {group ?? '—'}
      </Text>
    </View>
  );
}

function NutritionRow({
  t, label, value, last, indent,
}: { t: SemanticTokens; label: string; value: string; last?: boolean; indent?: boolean }) {
  return (
    <View style={[styles.nutRow, !last && { borderBottomWidth: 1, borderBottomColor: t.border }]}>
      <Text style={[styles.nutLabel, { color: indent ? t.textSubtle : t.textPrimary, paddingLeft: indent ? 12 : 0 }]}>
        {label}
      </Text>
      <Text style={[styles.nutValue, { color: t.textPrimary }]}>{value}</Text>
    </View>
  );
}

// ── Formatters ──────────────────────────────────────────────────────────────

function fmtG(v: number | null): string {
  if (v === null) return '—';
  return v < 1 ? `${v.toFixed(2)} g` : `${v.toFixed(1)} g`;
}
function fmtKcal(v: number | null): string {
  return v === null ? '—' : `${Math.round(v)} kcal`;
}
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingBottom: 12,
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 17 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 14 },

  stateWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 56, gap: 12,
  },
  stateTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center', marginTop: 6 },
  stateBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  cta: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, alignItems: 'center' },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1 },
  ctaText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },

  foundWrap: { gap: 14 },

  heroCard: {
    flexDirection: 'row', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: 'center',
  },
  heroImage: { width: 88, height: 88, borderRadius: 12 },
  heroImagePlaceholder: {
    width: 88, height: 88, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  heroName:  { fontFamily: 'Inter_700Bold',    fontSize: 16, letterSpacing: -0.3 },
  heroBrand: { fontFamily: 'Inter_500Medium',  fontSize: 13, marginTop: 2 },
  heroQty:   { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },

  gradeRow: { flexDirection: 'row', gap: 8 },
  gradePill: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center',
  },
  gradePillLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 0.4 },
  gradePillValue: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, marginTop: 2 },

  summaryPillRow: { flexDirection: 'row', gap: 6 },
  summaryPill: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center',
  },
  summaryPillValue: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: -0.2 },
  summaryPillLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 2, letterSpacing: 0.3 },

  allergenBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderLeftWidth: 4, borderRadius: 12, padding: 12,
  },
  allergenTitle: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 0.4 },
  allergenList: { fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 2 },

  // AI Summary card
  summaryCard: {
    borderRadius: 16, borderWidth: 1, padding: 14, gap: 10,
  },
  summaryCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  summaryIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryCardTitle: {
    fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2,
  },
  summaryText: {
    fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21,
  },
  skeletonWrap: { gap: 8 },
  skeletonLine: {
    height: 14, borderRadius: 7,
  },
  skeletonLineShort: {
    height: 14, borderRadius: 7, width: '68%',
  },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  metaLabel: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  metaValue: { flex: 1, textAlign: 'right', fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardCenter: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22, gap: 8 },
  cardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: 0.2, marginBottom: 4 },
  cardEmpty: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },

  nutRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10,
  },
  nutLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },
  nutValue: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  ingredientsText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },

  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4,
  },
  footerText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  refreshBtn: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  refreshBtnText: { fontFamily: 'Inter_500Medium', fontSize: 11 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  ctaHalf: { flex: 1, flexDirection: 'row', gap: 6, marginTop: 0 },

  // ── AI Chat ──────────────────────────────────────────────────────────────
  chatCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 12 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chatAiDot: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  chatTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  chatSub: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 1 },
  voiceToggle: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  chipsRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 12 },

  messagesWrap: { gap: 8 },
  bubble: { maxWidth: '85%', borderRadius: 16, padding: 12 },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAI: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 },

  replayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  replayText: { fontFamily: 'Inter_500Medium', fontSize: 11 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 4,
  },
  chatInput: {
    flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14,
    paddingVertical: 10, minHeight: 40,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── AI Ask card (not-found fallback) ─────────────────────────────────────
  aiAskCard: {
    width: '100%', borderRadius: 18, borderWidth: 1, padding: 16, gap: 10, marginTop: 4,
  },
  aiAskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiAskTitle: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  aiAskSub: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  aiAskInput: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 11,
    fontFamily: 'Inter_400Regular', fontSize: 14,
  },
  aiAskBtn: {
    paddingVertical: 13, borderRadius: 12, alignItems: 'center',
  },
  aiAskBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  aiAnswerBox: {
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 4,
  },
  aiAnswerText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
});
