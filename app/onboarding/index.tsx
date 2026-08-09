import { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
  Dimensions, Animated, Linking, TextInput,
} from 'react-native';
import { SpringButton } from '../../src/components/SpringButton';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore, FREE_SCAN_LIMIT } from '../../src/stores/appStore';
import { useThemeTokens, useActiveScheme, SemanticTokens } from '../../src/theme';
import { REGION_PRESETS, REGION_ORDER } from '../../src/types';
import { AnimatedNumber } from '../../src/components/AnimatedNumber';

// ── Types ─────────────────────────────────────────────────────────────────────
type PainPoint = 'spreadsheet' | 'paper' | 'nothing' | 'other_app';
type UserRole  = 'freelancer' | 'sole_trader' | 'small_biz' | 'employee';
type Volume    = 'few' | 'medium' | 'heavy' | 'chaos';
type Goal      = 'taxes' | 'organised' | 'both';

type Step =
  | 'welcome' | 'name_step' | 'pain_point' | 'role' | 'volume' | 'goal'
  | 'expense_types' | 'tax_deadline' | 'region' | 'insight'
  | 'social_proof' | 'data_privacy' | 'commitment' | 'rating'
  | 'permissions' | 'free_tier';

const STEP_ORDER: Step[] = [
  'welcome', 'name_step', 'pain_point', 'role', 'volume', 'goal',
  'expense_types', 'tax_deadline', 'region', 'insight',
  'social_proof', 'data_privacy', 'commitment', 'rating',
  'permissions', 'free_tier',
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const TOTAL_STEPS  = STEP_ORDER.length;

// ── Insight math ───────────────────────────────────────────────────────────────
const CURRENCY_SYM: Record<string, string> = {
  GB: '£', US: '$', EU: '€', AU: 'A$', NZ: 'NZ$', CA: 'C$', other: '£',
};
const ROLE_BASE: Record<UserRole, number> = {
  freelancer: 3200, sole_trader: 4100, small_biz: 8400, employee: 1200,
};
const REGION_MULT: Record<string, number> = {
  GB: 1.0, US: 1.35, EU: 1.15, AU: 1.85, NZ: 2.0, CA: 1.6, other: 1.0,
};
function calcMissed(role: UserRole | null, region: string) {
  const base = ROLE_BASE[role ?? 'freelancer'];
  const mult = REGION_MULT[region] ?? 1.0;
  const sym  = CURRENCY_SYM[region] ?? '£';
  return { amount: Math.round((base * mult) / 100) * 100, sym };
}

const ROLE_LABEL: Record<UserRole, string> = {
  freelancer: 'freelancer', sole_trader: 'sole trader',
  small_biz: 'small business owner', employee: 'employee',
};
const REGION_NAME: Record<string, string> = {
  GB: 'UK', US: 'US', EU: 'Europe', AU: 'Australia',
  NZ: 'New Zealand', CA: 'Canada', other: 'your region',
};

const EXPENSE_TYPES = [
  { value: 'food', emoji: '🍽️', label: 'Food & Drink' },
  { value: 'travel', emoji: '✈️', label: 'Travel' },
  { value: 'office', emoji: '🖥️', label: 'Office & IT' },
  { value: 'utilities', emoji: '⚡', label: 'Utilities' },
  { value: 'marketing', emoji: '📣', label: 'Marketing' },
  { value: 'professional', emoji: '📋', label: 'Professional' },
  { value: 'equipment', emoji: '🔧', label: 'Equipment' },
  { value: 'other', emoji: '📦', label: 'Other' },
];

const TAX_MONTHS = [
  { value: 'jan', label: 'January' },
  { value: 'apr', label: 'April' },
  { value: 'jul', label: 'July' },
  { value: 'oct', label: 'October' },
  { value: 'jan_us', label: 'January (US)' },
  { value: 'unknown', label: "I'm not sure" },
];

const COMMITMENT_ITEMS = [
  "I'll log every business expense as it happens",
  "I'll review my spending at least once a month",
  "I'm serious about reducing what I pay at tax time",
];

// ── Main component ─────────────────────────────────────────────────────────────
export default function Onboarding() {
  const t       = useThemeTokens();
  const scheme  = useActiveScheme();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const region  = useAppStore((s) => s.region);
  const setRegion = useAppStore((s) => s.setRegion);

  const [step, setStep]         = useState<Step>('welcome');
  const [userName, setUserName]   = useState('');
  const [painPoint, setPainPoint] = useState<PainPoint | null>(null);
  const [userRole, setUserRole]   = useState<UserRole | null>(null);
  const [volume, setVolume]       = useState<Volume | null>(null);
  const [goal, setGoal]           = useState<Goal | null>(null);
  const [expenseTypes, setExpenseTypes] = useState<string[]>([]);
  const [taxDeadline, setTaxDeadline]   = useState<string | null>(null);
  const [checkedCommitments, setCheckedCommitments] = useState<boolean[]>([false, false, false]);

  const scrollRef   = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const stepIndex = STEP_ORDER.indexOf(step);
  const isLast    = stepIndex === TOTAL_STEPS - 1;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (stepIndex + 1) / TOTAL_STEPS,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [stepIndex]);

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setStep(STEP_ORDER[index]);
  };

  const finish = () => {
    completeOnboarding();
    router.replace('/trust' as any);
  };

  const goNext = async () => {
    if (step === 'permissions') {
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    }
    if (isLast) {
      finish();
    } else {
      scrollToIndex(stepIndex + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) scrollToIndex(stepIndex - 1);
  };

  const onSwipeEnd = async (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index   = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const clamped = Math.max(0, Math.min(index, TOTAL_STEPS - 1));
    if (clamped !== stepIndex) {
      if (STEP_ORDER[stepIndex] === 'permissions' && clamped > stepIndex) {
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      setStep(STEP_ORDER[clamped]);
    }
  };

  const toggleExpenseType = (v: string) => {
    setExpenseTypes(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  };

  const toggleCommitment = (i: number) => {
    setCheckedCommitments(prev => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const ctaDisabled =
    (step === 'pain_point'   && !painPoint) ||
    (step === 'role'         && !userRole)  ||
    (step === 'volume'       && !volume)    ||
    (step === 'goal'         && !goal)      ||
    (step === 'expense_types' && expenseTypes.length === 0) ||
    (step === 'tax_deadline' && !taxDeadline) ||
    (step === 'commitment'   && !checkedCommitments.every(Boolean));

  const ctaLabel: Record<Step, string> = {
    welcome:       'Get started  →',
    name_step:     userName.trim() ? `Continue, ${userName.split(' ')[0]}  →` : 'Continue',
    pain_point:    'Continue',
    role:          'Continue',
    volume:        'Continue',
    goal:          'Continue',
    expense_types: 'Continue',
    tax_deadline:  'Continue',
    region:        'Confirm region',
    insight:       'Show me how →',
    social_proof:  'Join them',
    data_privacy:  'I trust this  →',
    commitment:    'I commit  →',
    rating:        'Continue',
    permissions:   'Allow camera access',
    free_tier:     'Start for free',
  };

  const firstName = userName.trim().split(' ')[0] || null;

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Top bar */}
      <View style={styles.topBar}>
        {stepIndex > 0 ? (
          <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.topBtn}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={t.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBtn} />
        )}

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: t.surfaceElevated }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: t.cta,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <View style={styles.topBtn}>
          <Text style={[styles.stepCounter, { color: t.textSubtle }]}>
            {stepIndex + 1}/{TOTAL_STEPS}
          </Text>
        </View>
      </View>

      {/* Horizontal pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onSwipeEnd}
        style={{ flex: 1 }}
      >
        {STEP_ORDER.map((s) => (
          <ScrollView
            key={s}
            style={{ width: SCREEN_WIDTH }}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {s === 'welcome'       && <WelcomeStep tokens={t} />}
            {s === 'name_step'     && (
              <NameStep
                tokens={t}
                value={userName}
                onChange={setUserName}
              />
            )}
            {s === 'pain_point'    && (
              <QuizStep
                tokens={t}
                icon="clipboard-question"
                title="Quick question..."
                subtitle="How do you currently handle business expenses?"
                options={[
                  { value: 'spreadsheet', emoji: '📊', label: 'Spreadsheets', sub: 'Hours of manual work' },
                  { value: 'paper',       emoji: '🧾', label: 'Paper receipts', sub: 'A shoebox full of chaos' },
                  { value: 'nothing',     emoji: '😅', label: "I don't", sub: 'Money left unclaimed' },
                  { value: 'other_app',   emoji: '📱', label: 'Another app', sub: "Time for an upgrade" },
                ]}
                selected={painPoint}
                onSelect={(v) => setPainPoint(v as PainPoint)}
              />
            )}
            {s === 'role' && (
              <QuizStep
                tokens={t}
                icon="account-tie"
                title="What describes you best?"
                subtitle="We'll personalise your experience around you."
                options={[
                  { value: 'freelancer',  emoji: '💼', label: 'Freelancer / Contractor', sub: 'Project-based income' },
                  { value: 'sole_trader', emoji: '🏪', label: 'Sole trader', sub: 'Self-employed, one person' },
                  { value: 'small_biz',   emoji: '🏢', label: 'Small business owner', sub: 'You employ others' },
                  { value: 'employee',    emoji: '👔', label: 'Employee with expenses', sub: 'Claiming work costs back' },
                ]}
                selected={userRole}
                onSelect={(v) => setUserRole(v as UserRole)}
              />
            )}
            {s === 'volume' && (
              <QuizStep
                tokens={t}
                icon="receipt"
                title="How many receipts a month?"
                subtitle="Be honest — no judgement here."
                options={[
                  { value: 'few',    emoji: '🟢', label: '1 – 10',  sub: 'Occasional expenses' },
                  { value: 'medium', emoji: '🟡', label: '10 – 30', sub: 'Regular spending' },
                  { value: 'heavy',  emoji: '🟠', label: '30 – 60', sub: 'High volume' },
                  { value: 'chaos',  emoji: '🔴', label: '60+',      sub: "It's chaos 🤯" },
                ]}
                selected={volume}
                onSelect={(v) => setVolume(v as Volume)}
              />
            )}
            {s === 'goal' && (
              <QuizStep
                tokens={t}
                icon="bullseye-arrow"
                title="What matters most to you?"
                subtitle="This shapes how we highlight things for you."
                options={[
                  { value: 'taxes',      emoji: '💰', label: 'Save money on taxes', sub: 'Maximise every deduction' },
                  { value: 'organised',  emoji: '📁', label: 'Stay organised',       sub: 'One place for everything' },
                  { value: 'both',       emoji: '⚡', label: 'Both, obviously',      sub: "Who wouldn't want both?" },
                ]}
                selected={goal}
                onSelect={(v) => setGoal(v as Goal)}
              />
            )}
            {s === 'expense_types' && (
              <ExpenseTypesStep
                tokens={t}
                selected={expenseTypes}
                onToggle={toggleExpenseType}
              />
            )}
            {s === 'tax_deadline' && (
              <TaxDeadlineStep
                tokens={t}
                selected={taxDeadline}
                onSelect={setTaxDeadline}
                firstName={firstName}
              />
            )}
            {s === 'region' && (
              <RegionStep tokens={t} selected={region} onPick={setRegion} />
            )}
            {s === 'insight' && (
              <InsightStep
                tokens={t}
                role={userRole}
                region={region}
                isActive={step === 'insight'}
                firstName={firstName}
              />
            )}
            {s === 'social_proof' && <SocialProofStep tokens={t} />}
            {s === 'data_privacy'  && <DataPrivacyStep tokens={t} />}
            {s === 'commitment'    && (
              <CommitmentStep
                tokens={t}
                checked={checkedCommitments}
                onToggle={toggleCommitment}
                firstName={firstName}
              />
            )}
            {s === 'rating'        && <RatingStep tokens={t} onDone={goNext} />}
            {s === 'permissions'   && <PermissionsStep tokens={t} />}
            {s === 'free_tier'     && (
              <FreeTierStep
                tokens={t}
                role={userRole}
                onExplorePro={() => router.push('/paywall')}
              />
            )}
          </ScrollView>
        ))}
      </ScrollView>

      {/* CTA — hidden on rating step */}
      {step !== 'rating' && (
        <View style={styles.footer}>
          <SpringButton
            style={[
              styles.cta,
              { backgroundColor: t.cta },
              ctaDisabled && { opacity: 0.4 },
            ]}
            onPress={ctaDisabled ? undefined : goNext}
            disabled={ctaDisabled}
          >
            <Text style={[styles.ctaText, { color: t.ctaText }]}>
              {ctaLabel[step]}
            </Text>
          </SpringButton>
          {step === 'welcome' && (
            <TouchableOpacity onPress={finish} style={styles.skipRow} hitSlop={12}>
              <Text style={[styles.skipText, { color: t.textSubtle }]}>Already have an account? Skip setup</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Step: Welcome ──────────────────────────────────────────────────────────────
function WelcomeStep({ tokens: t }: { tokens: SemanticTokens }) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.stepContent}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <View style={[styles.brandMark, { backgroundColor: t.cta }]}>
          <MaterialCommunityIcons name="receipt-text-check" size={40} color={t.ctaText} />
        </View>
      </Animated.View>

      <Text style={[styles.hookText, { color: t.textPrimary }]}>
        Stop leaving money{'\n'}on the table.
      </Text>
      <Text style={[styles.brandWord, { color: t.textMuted }]}>TallyShot</Text>

      <Text style={[styles.body, { color: t.textMuted }]}>
        Snap a receipt. AI reads every detail instantly. Every expense tracked,
        every deduction counted — automatically.
      </Text>

      <View style={styles.pillRow}>
        <Pill t={t} icon="shield-check"    label="No account" />
        <Pill t={t} icon="wifi-off"        label="Works offline" />
        <Pill t={t} icon="eye-off-outline" label="No tracking" />
      </View>

      <View style={[styles.featureGrid, { borderColor: t.border }]}>
        <Feature t={t} icon="lightning-bolt"       text="AI receipt scanning" />
        <Feature t={t} icon="cash-multiple"        text="Tax-deductible tracking" />
        <Feature t={t} icon="tag-multiple-outline" text="Smart categorisation" />
        <Feature t={t} icon="file-export"          text="CSV + PDF exports" />
        <Feature t={t} icon="barcode-scan"         text="Food barcode scanner" />
        <Feature t={t} icon="head-cog-outline"     text="AI voice shopping guide" />
      </View>
    </View>
  );
}

// ── Step: Name ─────────────────────────────────────────────────────────────────
function NameStep({
  tokens: t, value, onChange,
}: { tokens: SemanticTokens; value: string; onChange: (v: string) => void }) {
  const inputFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(inputFade, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.cta + '18', borderColor: t.cta + '30' }]}>
        <MaterialCommunityIcons name="hand-wave" size={48} color={t.cta} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>Let's make this personal.</Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        What should we call you? We'll use your name to personalise your experience.
      </Text>

      <Animated.View style={[styles.nameInputWrap, { borderColor: t.border, backgroundColor: t.surface, opacity: inputFade }]}>
        <MaterialCommunityIcons name="account-outline" size={20} color={t.textSubtle} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Your first name (optional)"
          placeholderTextColor={t.textSubtle}
          style={[styles.nameInput, { color: t.textPrimary }]}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={32}
          returnKeyType="done"
        />
        {value.trim().length > 0 && (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={t.textSubtle} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {value.trim() && (
        <View style={[styles.namePreview, { backgroundColor: t.cta + '15', borderColor: t.cta + '40' }]}>
          <Text style={[styles.namePreviewText, { color: t.cta }]}>
            Hi {value.trim().split(' ')[0]}! Let's get you set up.
          </Text>
        </View>
      )}

      <View style={[styles.privacyNote, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
        <MaterialCommunityIcons name="lock-outline" size={14} color={t.textSubtle} />
        <Text style={[styles.privacyNoteText, { color: t.textSubtle }]}>
          Stored only on your device. Never sent anywhere.
        </Text>
      </View>
    </View>
  );
}

// ── Step: Expense Types ─────────────────────────────────────────────────────────
function ExpenseTypesStep({
  tokens: t, selected, onToggle,
}: { tokens: SemanticTokens; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.accent + '18', borderColor: t.accent + '30' }]}>
        <MaterialCommunityIcons name="shape-outline" size={48} color={t.accent} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>What do you mainly expense?</Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        Pick everything that applies — we'll suggest the right categories from day one.
      </Text>

      <View style={styles.expenseGrid}>
        {EXPENSE_TYPES.map((item) => {
          const sel = selected.includes(item.value);
          return (
            <TouchableOpacity
              key={item.value}
              onPress={() => onToggle(item.value)}
              activeOpacity={0.75}
              style={[
                styles.expenseTile,
                {
                  backgroundColor: sel ? t.cta + '18' : t.surface,
                  borderColor: sel ? t.cta : t.border,
                  borderWidth: sel ? 1.5 : 1,
                },
              ]}
            >
              <Text style={styles.expenseTileEmoji}>{item.emoji}</Text>
              <Text style={[styles.expenseTileLabel, { color: sel ? t.cta : t.textPrimary }]}>
                {item.label}
              </Text>
              {sel && (
                <View style={[styles.expenseTileCheck, { backgroundColor: t.cta }]}>
                  <MaterialCommunityIcons name="check" size={10} color={t.ctaText} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selected.length > 0 && (
        <Text style={[styles.selectionCount, { color: t.textMuted }]}>
          {selected.length} categor{selected.length === 1 ? 'y' : 'ies'} selected
        </Text>
      )}
    </View>
  );
}

// ── Step: Tax Deadline ──────────────────────────────────────────────────────────
function TaxDeadlineStep({
  tokens: t, selected, onSelect, firstName,
}: {
  tokens: SemanticTokens; selected: string | null; onSelect: (v: string) => void; firstName: string | null;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.accent + '18', borderColor: t.accent + '30' }]}>
        <MaterialCommunityIcons name="calendar-clock" size={48} color={t.accent} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>
        {firstName ? `When's your tax deadline, ${firstName}?` : 'When is your tax deadline?'}
      </Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        We'll help you build good habits before it sneaks up on you.
      </Text>

      <View style={[styles.regionList, { backgroundColor: t.surface, borderColor: t.border }]}>
        {TAX_MONTHS.map((item, i) => {
          const sel = selected === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              onPress={() => onSelect(item.value)}
              activeOpacity={0.7}
              style={[
                styles.regionRow,
                i < TAX_MONTHS.length - 1 && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
                sel && { backgroundColor: t.surfaceElevated },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.regionName, { color: t.textPrimary }]}>{item.label}</Text>
              </View>
              {sel && <MaterialCommunityIcons name="check-circle" size={22} color={t.accent} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Step: Region ───────────────────────────────────────────────────────────────
function RegionStep({
  tokens: t, selected, onPick,
}: { tokens: SemanticTokens; selected: string; onPick: (r: any) => void }) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.accent + '18', borderColor: t.accent + '30' }]}>
        <MaterialCommunityIcons name="earth" size={48} color={t.accent} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>Where are you based?</Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        Sets your currency and tax mode so we format everything correctly for you.
      </Text>

      <View style={[styles.regionList, { backgroundColor: t.surface, borderColor: t.border }]}>
        {REGION_ORDER.map((r, i) => {
          const preset = REGION_PRESETS[r];
          const sel = selected === r;
          return (
            <TouchableOpacity
              key={r}
              onPress={() => onPick(r)}
              activeOpacity={0.7}
              style={[
                styles.regionRow,
                i < REGION_ORDER.length - 1 && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
                sel && { backgroundColor: t.surfaceElevated },
              ]}
            >
              <Text style={styles.regionFlag}>{preset.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.regionName, { color: t.textPrimary }]}>{preset.name}</Text>
                <Text style={[styles.regionSub, { color: t.textMuted }]}>
                  {preset.currency} · {preset.taxLabel} {preset.taxMode}
                </Text>
              </View>
              {sel && <MaterialCommunityIcons name="check-circle" size={22} color={t.accent} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Step: Insight ────────────────────────────────────────────────────────────
function InsightStep({
  tokens: t, role, region, isActive, firstName,
}: {
  tokens: SemanticTokens; role: UserRole | null; region: string; isActive: boolean; firstName: string | null;
}) {
  const { amount, sym } = calcMissed(role, region);
  const [liveAmount, setLiveAmount] = useState(0);

  useEffect(() => {
    if (!isActive) { setLiveAmount(0); return; }
    const tid = setTimeout(() => setLiveAmount(amount), 400);
    return () => clearTimeout(tid);
  }, [isActive, amount]);

  const roleLabel   = ROLE_LABEL[role ?? 'freelancer'];
  const regionLabel = REGION_NAME[region] ?? 'your region';

  return (
    <View style={styles.stepContent}>
      {firstName ? (
        <Text style={[styles.insightPre, { color: t.textMuted }]}>
          {firstName}, you could be missing...
        </Text>
      ) : (
        <Text style={[styles.insightPre, { color: t.textMuted }]}>You could be missing...</Text>
      )}

      <AnimatedNumber
        value={liveAmount}
        formatter={(n) => `${sym}${Math.round(n).toLocaleString()}`}
        style={[styles.insightAmount, { color: t.cta }]}
        duration={1400}
      />

      <Text style={[styles.insightPost, { color: t.textMuted }]}>per year in unclaimed deductions</Text>
      <Text style={[styles.insightCaption, { color: t.textSubtle }]}>
        Average {regionLabel} {roleLabel}
      </Text>

      <View style={[styles.insightDivider, { backgroundColor: t.border }]} />

      <View style={[styles.insightCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <MaterialCommunityIcons name="lightning-bolt" size={22} color={t.cta} style={{ marginBottom: 8 }} />
        <Text style={[styles.insightCardTitle, { color: t.textPrimary }]}>
          TallyShot finds these automatically.
        </Text>
        <Text style={[styles.insightCardBody, { color: t.textMuted }]}>
          Every receipt captured. Every deduction counted —
          without you lifting a finger at tax time.
        </Text>
      </View>

      <Text style={[styles.insightSmall, { color: t.textSubtle }]}>
        * Based on government tax authority averages for self-employed individuals.
      </Text>
    </View>
  );
}

// ── Step: Social Proof ─────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: 'Sarah T.',
    role: 'Freelance Designer',
    text: "Found £2,840 in missed deductions in my first tax year. My accountant was amazed.",
    stars: 5,
  },
  {
    name: 'Marcus L.',
    role: 'IT Contractor',
    text: "The AI scanning alone saves me hours at tax time. I used to absolutely dread it.",
    stars: 5,
  },
  {
    name: 'Amy R.',
    role: 'Sole Trader',
    text: "No account required. Data stays on my phone. Finally an expense app I actually trust.",
    stars: 5,
  },
];

function SocialProofStep({ tokens: t }: { tokens: SemanticTokens }) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.cta + '18', borderColor: t.cta + '30' }]}>
        <MaterialCommunityIcons name="star-circle" size={48} color={t.cta} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>
        Trusted by thousands of freelancers
      </Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        Real people. Real receipts. Real savings.
      </Text>

      <View style={[styles.statBar, { backgroundColor: t.surface, borderColor: t.border }]}>
        <StatPill t={t} value="★ 4.8" label="Rating" />
        <View style={[styles.statDivider, { backgroundColor: t.border }]} />
        <StatPill t={t} value="10k+" label="Users" />
        <View style={[styles.statDivider, { backgroundColor: t.border }]} />
        <StatPill t={t} value="#1" label="Finance" />
      </View>

      <View style={styles.testimonialList}>
        {TESTIMONIALS.map((item, i) => (
          <View
            key={i}
            style={[styles.testimonialCard, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <View style={styles.starsRow}>
              {Array.from({ length: item.stars }).map((_, si) => (
                <MaterialCommunityIcons key={si} name="star" size={14} color="#F59E0B" />
              ))}
            </View>
            <Text style={[styles.testimonialText, { color: t.textPrimary }]}>
              "{item.text}"
            </Text>
            <View style={styles.testimonialAuthor}>
              <View style={[styles.testimonialAvatar, { backgroundColor: t.cta + '22' }]}>
                <Text style={[styles.testimonialAvatarText, { color: t.cta }]}>
                  {item.name[0]}
                </Text>
              </View>
              <View>
                <Text style={[styles.testimonialName, { color: t.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.testimonialRole, { color: t.textMuted }]}>{item.role}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Step: Data Privacy ─────────────────────────────────────────────────────────
function DataPrivacyStep({ tokens: t }: { tokens: SemanticTokens }) {
  const items = [
    { icon: 'phone-lock', title: 'Stays on your device', body: "Receipts and photos live in your phone's storage. Nothing syncs to a cloud account." },
    { icon: 'robot-outline', title: 'AI sees, but never stores', body: 'Your receipt image is sent to our secure AI processor, read in seconds, then deleted. Never logged.' },
    { icon: 'cancel', title: 'Zero trackers', body: 'No analytics, no advertising SDKs, no session recording. We genuinely do not know what you do in the app.' },
    { icon: 'account-off-outline', title: 'No account required', body: 'No email, no password, no login. Your data is yours and lives where you live.' },
  ];

  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.cta + '18', borderColor: t.cta + '30' }]}>
        <MaterialCommunityIcons name="shield-lock" size={48} color={t.cta} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>Your data is sacred.</Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        We built TallyShot to be the most private expense app possible. Here's what that means.
      </Text>

      <View style={styles.privacyCardList}>
        {items.map((item, i) => (
          <View
            key={i}
            style={[styles.privacyCard, { backgroundColor: t.surface, borderColor: t.border }]}
          >
            <View style={[styles.privacyCardIcon, { backgroundColor: t.cta + '18' }]}>
              <MaterialCommunityIcons name={item.icon as any} size={22} color={t.cta} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.privacyCardTitle, { color: t.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.privacyCardBody, { color: t.textMuted }]}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Step: Commitment ──────────────────────────────────────────────────────────
function CommitmentStep({
  tokens: t, checked, onToggle, firstName,
}: {
  tokens: SemanticTokens; checked: boolean[]; onToggle: (i: number) => void; firstName: string | null;
}) {
  const allChecked = checked.every(Boolean);

  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.cta + '18', borderColor: t.cta + '30' }]}>
        <MaterialCommunityIcons name={allChecked ? 'check-decagram' : 'handshake-outline'} size={48} color={t.cta} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>
        {firstName ? `${firstName}, make it official.` : 'Make it official.'}
      </Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        The people who get the most out of TallyShot are the ones who make a small promise to themselves.
        Tick all three to continue.
      </Text>

      <View style={styles.commitmentList}>
        {COMMITMENT_ITEMS.map((item, i) => {
          const ticked = checked[i];
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onToggle(i)}
              activeOpacity={0.75}
              style={[
                styles.commitmentCard,
                {
                  backgroundColor: ticked ? t.cta + '12' : t.surface,
                  borderColor: ticked ? t.cta : t.border,
                  borderWidth: ticked ? 1.5 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.commitmentCheck,
                  { backgroundColor: ticked ? t.cta : 'transparent', borderColor: ticked ? t.cta : t.border },
                ]}
              >
                {ticked && <MaterialCommunityIcons name="check" size={14} color={t.ctaText} />}
              </View>
              <Text style={[styles.commitmentText, { color: ticked ? t.textPrimary : t.textMuted }]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {allChecked && (
        <View style={[styles.commitmentDone, { backgroundColor: t.successBg, borderColor: t.success + '40' }]}>
          <MaterialCommunityIcons name="check-circle" size={20} color={t.success} />
          <Text style={[styles.commitmentDoneText, { color: t.success }]}>
            Brilliant! You're committed. Let's make it happen.
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Step: Rating ───────────────────────────────────────────────────────────────
function RatingStep({ tokens: t, onDone }: { tokens: SemanticTokens; onDone: () => void }) {
  const [rating, setRating]   = useState(0);
  const [submitted, setSubmit] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleStar = (n: number) => {
    if (submitted) return;
    setRating(n);
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setSubmit(true);
  };

  const openStore = () => {
    Linking.openURL('market://details?id=com.tallyshot').catch(() =>
      Linking.openURL('https://play.google.com/store/apps/details?id=com.tallyshot')
    );
  };

  return (
    <View style={[styles.stepContent, { paddingBottom: 32 }]}>
      <View style={[styles.iconBg, { backgroundColor: t.cta + '18', borderColor: t.cta + '30' }]}>
        <MaterialCommunityIcons name="heart-outline" size={48} color={t.cta} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>
        How's TallyShot feeling so far?
      </Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        You're almost ready. Your feedback helps us improve.
      </Text>

      <Animated.View style={[styles.starsLarge, { transform: [{ scale: scaleAnim }] }]}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} onPress={() => handleStar(n)} hitSlop={8} activeOpacity={0.7}>
            <MaterialCommunityIcons
              name={n <= rating ? 'star' : 'star-outline'}
              size={52}
              color={n <= rating ? '#F59E0B' : t.border}
            />
          </TouchableOpacity>
        ))}
      </Animated.View>

      {!submitted && rating > 0 && (
        <SpringButton
          style={[styles.cta, { backgroundColor: t.cta, marginTop: 8 }]}
          onPress={handleSubmit}
        >
          <Text style={[styles.ctaText, { color: t.ctaText }]}>Submit rating</Text>
        </SpringButton>
      )}

      {submitted && rating >= 4 && (
        <View style={styles.ratingResult}>
          <MaterialCommunityIcons name="check-circle" size={28} color={t.cta} />
          <Text style={[styles.ratingResultTitle, { color: t.textPrimary }]}>
            Thank you so much! 🎉
          </Text>
          <Text style={[styles.ratingResultBody, { color: t.textMuted }]}>
            Would you mind leaving a quick review? It helps other freelancers find us.
          </Text>
          <SpringButton
            style={[styles.cta, { backgroundColor: t.cta }]}
            onPress={() => { openStore(); onDone(); }}
          >
            <MaterialCommunityIcons name="star" size={18} color={t.ctaText} />
            <Text style={[styles.ctaText, { color: t.ctaText }]}>  Leave a review</Text>
          </SpringButton>
          <TouchableOpacity onPress={onDone} style={{ marginTop: 12 }} hitSlop={12}>
            <Text style={[styles.skipText, { color: t.textSubtle }]}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      )}

      {submitted && rating < 4 && (
        <View style={styles.ratingResult}>
          <MaterialCommunityIcons name="emoticon-sad-outline" size={28} color={t.textMuted} />
          <Text style={[styles.ratingResultTitle, { color: t.textPrimary }]}>We hear you.</Text>
          <Text style={[styles.ratingResultBody, { color: t.textMuted }]}>
            We're constantly improving TallyShot. Your honest feedback means everything.
          </Text>
          <SpringButton
            style={[styles.cta, { backgroundColor: t.cta }]}
            onPress={onDone}
          >
            <Text style={[styles.ctaText, { color: t.ctaText }]}>Continue</Text>
          </SpringButton>
        </View>
      )}

      {!submitted && rating === 0 && (
        <TouchableOpacity onPress={onDone} style={{ marginTop: 20 }} hitSlop={12}>
          <Text style={[styles.skipText, { color: t.textSubtle }]}>Skip for now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Step: Permissions ──────────────────────────────────────────────────────────
function PermissionsStep({ tokens: t }: { tokens: SemanticTokens }) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.accent + '18', borderColor: t.accent + '30' }]}>
        <MaterialCommunityIcons name="camera-iris" size={56} color={t.accent} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>One tap to capture</Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        TallyShot needs camera access to photograph receipts. We only ever see what you point
        the camera at — nothing else on your device.
      </Text>

      <View style={[styles.permList, { backgroundColor: t.surface, borderColor: t.border }]}>
        <PermLine t={t} icon="camera" label="Camera" desc="Snap receipts in one tap" />
        <PermLine t={t} icon="image-multiple" label="Photos" desc="Only when you choose one" isLast />
      </View>

      <View style={[styles.privacyNote, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
        <MaterialCommunityIcons name="lock-outline" size={16} color={t.textSubtle} />
        <Text style={[styles.privacyNoteText, { color: t.textSubtle }]}>
          Images are processed via secure AI extraction. Never stored in the cloud. Never shared.
        </Text>
      </View>
    </View>
  );
}

// ── Step: Free Tier ────────────────────────────────────────────────────────────
function FreeTierStep({
  tokens: t, role, onExplorePro,
}: { tokens: SemanticTokens; role: UserRole | null; onExplorePro: () => void }) {
  const roleLabel = role ? ROLE_LABEL[role] : 'freelancer';

  return (
    <View style={styles.stepContent}>
      <View style={[styles.brandMark, { backgroundColor: t.cta }]}>
        <MaterialCommunityIcons name="check-bold" size={36} color={t.ctaText} />
      </View>

      <Text style={[styles.title, { color: t.textPrimary }]}>You're all set! 🎉</Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        TallyShot is ready. Here's what every {roleLabel} gets for free, forever.
      </Text>

      <View style={[styles.tierCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.tierTitle, { color: t.textSubtle }]}>FREE · ALWAYS</Text>
        <FreeLine t={t} text={`${FREE_SCAN_LIMIT} AI receipt scans per month`} />
        <FreeLine t={t} text="Unlimited manual entries" />
        <FreeLine t={t} text="Barcode scanner — nutrition + AI advice" />
        <FreeLine t={t} text="Smart expense categories" />
        <FreeLine t={t} text="Tax-deductible tracking" />
        <FreeLine t={t} text="CSV + PDF export" />
        <FreeLine t={t} text="No ads · No tracking · No account" />
      </View>

      <TouchableOpacity
        onPress={onExplorePro}
        activeOpacity={0.75}
        style={[styles.proTeaser, { backgroundColor: t.surface, borderColor: t.cta + '50' }]}
      >
        <MaterialCommunityIcons name="crown" size={18} color={t.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.proTeaserTitle, { color: t.textPrimary }]}>
            Serious about expenses?
          </Text>
          <Text style={[styles.proTeaserSub, { color: t.textMuted }]}>
            Unlock unlimited scans with Pro →
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function Pill({ t, icon, label }: { t: SemanticTokens; icon: string; label: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
      <MaterialCommunityIcons name={icon as any} size={13} color={t.textSubtle} />
      <Text style={[styles.pillText, { color: t.textSubtle }]}>{label}</Text>
    </View>
  );
}

function Feature({ t, icon, text }: { t: SemanticTokens; icon: string; text: string }) {
  return (
    <View style={styles.feature}>
      <MaterialCommunityIcons name={icon as any} size={18} color={t.cta} />
      <Text style={[styles.featureText, { color: t.textPrimary }]}>{text}</Text>
    </View>
  );
}

function StatPill({ t, value, label }: { t: SemanticTokens; value: string; label: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={[styles.statValue, { color: t.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: t.textMuted }]}>{label}</Text>
    </View>
  );
}

function PermLine({
  t, icon, label, desc, isLast,
}: { t: SemanticTokens; icon: string; label: string; desc: string; isLast?: boolean }) {
  return (
    <View
      style={[
        styles.permLine,
        !isLast && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.permIcon, { backgroundColor: t.surfaceElevated }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={t.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.permLabel, { color: t.textPrimary }]}>{label}</Text>
        <Text style={[styles.permDesc, { color: t.textMuted }]}>{desc}</Text>
      </View>
    </View>
  );
}

function FreeLine({ t, text }: { t: SemanticTokens; text: string }) {
  return (
    <View style={styles.freeLine}>
      <MaterialCommunityIcons name="check-circle" size={16} color={t.deductible} />
      <Text style={[styles.freeText, { color: t.textPrimary }]}>{text}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:  { flex: 1, paddingTop: 56 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, height: 44,
  },
  topBtn: { width: 48, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  skipText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  stepCounter: { fontFamily: 'Inter_500Medium', fontSize: 12 },

  progressTrack: { flex: 1, height: 4, borderRadius: 2, marginHorizontal: 12, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 2 },

  scroll:       { paddingHorizontal: 24, paddingBottom: 24 },
  stepContent:  { alignItems: 'center', gap: 12, paddingTop: 28, paddingBottom: 16 },

  // Welcome
  brandMark: {
    width: 80, height: 80, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  hookText: {
    fontFamily: 'Inter_800ExtraBold', fontSize: 30, letterSpacing: -0.8,
    textAlign: 'center', lineHeight: 36,
  },
  brandWord: { fontFamily: 'Inter_400Regular', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' },
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1,
  },
  pillText: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  featureGrid: {
    width: '100%', marginTop: 12,
    flexDirection: 'row', flexWrap: 'wrap',
    borderRadius: 16, borderWidth: 1, padding: 8,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '50%', padding: 8 },
  featureText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1 },

  // Name step
  nameInputWrap: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16,
    paddingVertical: 14, gap: 10, marginTop: 8,
  },
  nameInput: {
    flex: 1, fontFamily: 'Inter_500Medium', fontSize: 18,
    letterSpacing: -0.2,
  },
  namePreview: {
    width: '100%', borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  namePreviewText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, textAlign: 'center' },

  // Expense types
  expenseGrid: {
    width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8,
  },
  expenseTile: {
    width: '47%', borderRadius: 14, padding: 14, gap: 6,
    alignItems: 'center', position: 'relative',
  },
  expenseTileEmoji: { fontSize: 28 },
  expenseTileLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'center' },
  expenseTileCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  selectionCount: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },

  // Commitment
  commitmentList: { width: '100%', gap: 10, marginTop: 8 },
  commitmentCard: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderRadius: 14, padding: 16,
  },
  commitmentCheck: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0,
  },
  commitmentText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, flex: 1 },
  commitmentDone: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginTop: 4,
  },
  commitmentDoneText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flex: 1 },

  // Data privacy
  privacyCardList: { width: '100%', gap: 10, marginTop: 8 },
  privacyCard: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  privacyCardIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  privacyCardTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginBottom: 3 },
  privacyCardBody: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },

  // Shared
  iconBg: {
    width: 100, height: 100, borderRadius: 26,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 26, letterSpacing: -0.5, textAlign: 'center', lineHeight: 32 },
  body:  { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },

  // Quiz / options
  optionList: { width: '100%', gap: 10, marginTop: 8 },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
  },
  optionEmoji: { fontSize: 22 },
  optionLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  optionSub:   { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  optionCheck: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  // Region / Tax Deadline list
  regionList: { width: '100%', marginTop: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  regionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingVertical: 12, minHeight: 56,
  },
  regionFlag: { fontSize: 24 },
  regionName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  regionSub:  { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },

  // Insight
  insightPre:     { fontFamily: 'Inter_500Medium', fontSize: 16, textAlign: 'center', marginTop: 16 },
  insightAmount:  { fontFamily: 'Inter_800ExtraBold', fontSize: 64, letterSpacing: -2, textAlign: 'center' },
  insightPost:    { fontFamily: 'Inter_400Regular', fontSize: 16, textAlign: 'center' },
  insightCaption: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' },
  insightDivider: { width: 40, height: 2, borderRadius: 1, marginVertical: 8 },
  insightCard: {
    width: '100%', borderRadius: 16, borderWidth: 1, padding: 20,
    alignItems: 'center', gap: 6,
  },
  insightCardTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, textAlign: 'center' },
  insightCardBody:  { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  insightSmall:     { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center', marginTop: 4, paddingHorizontal: 16 },

  // Social proof
  statBar: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 4,
  },
  statDivider: { width: 1, height: 32, marginHorizontal: 12 },
  statPill: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: 'Inter_800ExtraBold', fontSize: 16, letterSpacing: -0.3 },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 1 },
  testimonialList:   { width: '100%', gap: 10, marginTop: 4 },
  testimonialCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 8,
  },
  starsRow: { flexDirection: 'row', gap: 2 },
  testimonialText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  testimonialAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  testimonialAvatar: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  testimonialAvatarText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  testimonialName:  { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  testimonialRole:  { fontFamily: 'Inter_400Regular', fontSize: 11 },

  // Rating
  starsLarge: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  ratingResult: { width: '100%', alignItems: 'center', gap: 10, marginTop: 4 },
  ratingResultTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center' },
  ratingResultBody:  { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 300 },

  // Permissions
  permList: { width: '100%', marginTop: 12, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  permLine:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  permIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  permLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  permDesc:  { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },
  privacyNote: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 4,
  },
  privacyNoteText: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, flex: 1 },

  // Free tier
  tierCard: { width: '100%', marginTop: 4, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  tierTitle: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  freeLine:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freeText:  { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  proTeaser: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, padding: 14, marginTop: 4,
  },
  proTeaserTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  proTeaserSub:   { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 1 },

  // Footer CTA
  footer:  { padding: 24, paddingBottom: 36, gap: 12 },
  skipRow: { alignItems: 'center' },
  cta: {
    width: '100%', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 52, flexDirection: 'row',
  },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
});

// ── QuizStep (generic) ─────────────────────────────────────────────────────────
interface QuizOption { value: string; emoji: string; label: string; sub: string }
function QuizStep({
  tokens: t, icon, title, subtitle, options, selected, onSelect,
}: {
  tokens: SemanticTokens; icon: string; title: string; subtitle: string;
  options: QuizOption[]; selected: string | null; onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: t.accent + '18', borderColor: t.accent + '30' }]}>
        <MaterialCommunityIcons name={icon as any} size={48} color={t.accent} />
      </View>
      <Text style={[styles.title, { color: t.textPrimary }]}>{title}</Text>
      <Text style={[styles.body, { color: t.textMuted }]}>{subtitle}</Text>

      <View style={styles.optionList}>
        {options.map((opt) => {
          const sel = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              activeOpacity={0.75}
              onPress={() => onSelect(opt.value)}
              style={[
                styles.optionCard,
                {
                  backgroundColor: sel ? t.cta + '18' : t.surface,
                  borderColor: sel ? t.cta : t.border,
                  borderWidth: sel ? 1.5 : 1,
                },
              ]}
            >
              <Text style={styles.optionEmoji}>{opt.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionLabel, { color: t.textPrimary }]}>{opt.label}</Text>
                <Text style={[styles.optionSub, { color: t.textMuted }]}>{opt.sub}</Text>
              </View>
              <View
                style={[
                  styles.optionCheck,
                  { borderColor: sel ? t.cta : t.border, backgroundColor: sel ? t.cta : 'transparent' },
                ]}
              >
                {sel && <MaterialCommunityIcons name="check" size={12} color={t.ctaText} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
