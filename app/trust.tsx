import { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, StatusBar, ScrollView,
  Dimensions, Animated,
} from 'react-native';
import { SpringButton } from '../src/components/SpringButton';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../src/stores/appStore';
import { useThemeTokens, useActiveScheme, SemanticTokens } from '../src/theme';
import { getOfferings, purchasePackage } from '../src/services/purchases';
import { type PurchasesPackage } from 'react-native-purchases';
import { hapticMedium, hapticLight } from '../src/utils/haptics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREENS = ['problem', 'solution', 'offer'] as const;
type Screen = (typeof SCREENS)[number];

export default function TrustScreens() {
  const t      = useThemeTokens();
  const scheme = useActiveScheme();
  const setTrustScreensSeen = useAppStore((s) => s.setTrustScreensSeen);
  const setIsPro            = useAppStore((s) => s.setIsPro);

  const [screen, setScreen]       = useState<Screen>('problem');
  const [pkg, setPkg]             = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const scrollRef  = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const screenIndex = SCREENS.indexOf(screen);

  useEffect(() => {
    // Pre-fetch offering so the offer screen shows price instantly
    getOfferings().then((o) => setPkg(o?.current?.monthly ?? null));
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (screenIndex + 1) / SCREENS.length,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [screenIndex]);

  const scrollTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * SCREEN_WIDTH, animated: true });
    setScreen(SCREENS[i]);
  };

  const goNext = () => scrollTo(screenIndex + 1);
  const goBack = () => { if (screenIndex > 0) scrollTo(screenIndex - 1); };

  const exitToApp = () => {
    hapticLight();
    setTrustScreensSeen();
    router.replace('/(tabs)');
  };

  const openPaywall = () => {
    hapticLight();
    setTrustScreensSeen();
    router.push('/paywall');
  };

  const startTrial = async () => {
    if (!pkg) { openPaywall(); return; }
    hapticMedium();
    setPurchasing(true);
    try {
      const isPro = await purchasePackage(pkg);
      if (isPro) {
        setIsPro(true);
        hapticMedium();
        setTrustScreensSeen();
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      if (!e?.userCancelled) {
        // Purchase failed — fall through to paywall so they can retry
        openPaywall();
      }
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: t.background }]}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Top bar */}
      <View style={styles.topBar}>
        {screenIndex > 0 ? (
          <TouchableOpacity onPress={goBack} hitSlop={12} style={styles.topBtn}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={t.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBtn} />
        )}

        <View style={[styles.progressTrack, { backgroundColor: t.surfaceElevated }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: t.cta,
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              },
            ]}
          />
        </View>

        <TouchableOpacity onPress={exitToApp} hitSlop={12} style={styles.topBtn}>
          <Text style={[styles.skipText, { color: t.textSubtle }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Pager */}
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        scrollEnabled={false}
      >
        {SCREENS.map((s) => (
          <ScrollView
            key={s}
            style={{ width: SCREEN_WIDTH }}
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {s === 'problem'  && <ProblemScreen  t={t} />}
            {s === 'solution' && <SolutionScreen t={t} />}
            {s === 'offer'    && (
              <OfferScreen
                t={t} pkg={pkg} purchasing={purchasing}
                onTrial={startTrial} onFree={exitToApp} onSeeAll={openPaywall}
              />
            )}
          </ScrollView>
        ))}
      </ScrollView>

      {/* CTA — hidden on offer screen (has its own) */}
      {screen !== 'offer' && (
        <View style={styles.footer}>
          <SpringButton style={[styles.cta, { backgroundColor: t.cta }]} onPress={goNext}>
            <Text style={[styles.ctaText, { color: t.ctaText }]}>Next  →</Text>
          </SpringButton>
        </View>
      )}
    </View>
  );
}

// ── Screen 1: The Problem ─────────────────────────────────────────────────────
function ProblemScreen({ t }: { t: SemanticTokens }) {
  const scale   = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.screen}>
      <Animated.View style={{ transform: [{ scale }], opacity, marginBottom: 4 }}>
        <View style={[styles.iconWrap, { backgroundColor: '#EF4444' + '18', borderColor: '#EF4444' + '30' }]}>
          <MaterialCommunityIcons name="currency-gbp" size={52} color="#EF4444" />
        </View>
      </Animated.View>

      <Text style={[styles.label, { color: '#EF4444' }]}>THE HIDDEN PROBLEM</Text>
      <Text style={[styles.headline, { color: t.textPrimary }]}>
        Most freelancers{'\n'}miss thousands.
      </Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        Not because they're disorganised. Because tracking receipts manually is painful —
        so they don't bother, and the taxman keeps the difference.
      </Text>

      <View style={[styles.painCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <PainLine t={t} icon="file-excel-outline"  text="Spreadsheets take hours every month" />
        <PainLine t={t} icon="receipt-text-remove" text="Paper receipts fade and get lost" />
        <PainLine t={t} icon="clock-alert-outline" text="Forgotten expenses can't be claimed" />
        <PainLine t={t} icon="calculator-variant"  text="Manual totals are error-prone" isLast />
      </View>

      <View style={[styles.statStrip, { backgroundColor: t.cta + '12', borderColor: t.cta + '30' }]}>
        <MaterialCommunityIcons name="information-outline" size={16} color={t.cta} />
        <Text style={[styles.statText, { color: t.cta }]}>
          The average UK freelancer misses{' '}
          <Text style={{ fontFamily: 'Inter_700Bold' }}>£3,200/year</Text> in unclaimed deductions.
        </Text>
      </View>
    </View>
  );
}

// ── Screen 2: The Solution ────────────────────────────────────────────────────
function SolutionScreen({ t }: { t: SemanticTokens }) {
  return (
    <View style={styles.screen}>
      <View style={[styles.iconWrap, { backgroundColor: t.cta + '18', borderColor: t.cta + '30' }]}>
        <MaterialCommunityIcons name="lightning-bolt" size={52} color={t.cta} />
      </View>

      <Text style={[styles.label, { color: t.cta }]}>THE FIX</Text>
      <Text style={[styles.headline, { color: t.textPrimary }]}>
        One snap.{'\n'}Everything tracked.
      </Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        Point your camera. AI reads the merchant, date, amount, and tax — in seconds.
        No typing. No cloud. No account. Your expenses, finally under control.
      </Text>

      <View style={styles.featureGrid}>
        {[
          { icon: 'camera-iris',    title: 'AI Scanning',      sub: 'Any receipt in seconds' },
          { icon: 'cash-multiple',  title: 'Tax Deductibles',  sub: 'Counted automatically' },
          { icon: 'file-export',    title: 'CSV + PDF Export', sub: 'Send to your accountant' },
          { icon: 'chart-bar',      title: 'Spending Stats',   sub: 'Full breakdowns' },
        ].map((f, i) => (
          <View key={i} style={[styles.featureTile, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.featureTileIcon, { backgroundColor: t.cta + '18' }]}>
              <MaterialCommunityIcons name={f.icon as any} size={22} color={t.cta} />
            </View>
            <Text style={[styles.featureTileTitle, { color: t.textPrimary }]}>{f.title}</Text>
            <Text style={[styles.featureTileSub, { color: t.textMuted }]}>{f.sub}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.trustRow, { borderColor: t.border }]}>
        <TrustBadge t={t} icon="shield-check"    text="No account" />
        <TrustBadge t={t} icon="wifi-off"        text="100% offline" />
        <TrustBadge t={t} icon="eye-off-outline" text="No tracking" />
      </View>
    </View>
  );
}

// ── Screen 3: The Offer ───────────────────────────────────────────────────────
function OfferScreen({
  t, pkg, purchasing, onTrial, onFree, onSeeAll,
}: {
  t: SemanticTokens;
  pkg: PurchasesPackage | null;
  purchasing: boolean;
  onTrial: () => void;
  onFree: () => void;
  onSeeAll: () => void;
}) {
  const priceStr = pkg?.product.priceString ?? '£2.99';
  const introStr = (pkg?.product as any)?.introductoryPrice?.priceString as string | undefined;
  const hasTrial = introStr !== undefined && introStr !== null;

  return (
    <View style={[styles.screen, { paddingBottom: 8 }]}>
      <View style={[styles.iconWrap, { backgroundColor: t.accent + '18', borderColor: t.accent + '30' }]}>
        <MaterialCommunityIcons name="crown" size={52} color={t.accent} />
      </View>

      <Text style={[styles.label, { color: t.accent }]}>ZERO RISK OFFER</Text>
      <Text style={[styles.headline, { color: t.textPrimary }]}>
        {hasTrial ? 'Try Pro free\nfor 7 days.' : 'Go Pro today.'}
      </Text>
      <Text style={[styles.body, { color: t.textMuted }]}>
        {hasTrial
          ? `No payment upfront. Cancel any time from Google Play. After your trial, just ${priceStr}/month — less than a coffee.`
          : `Unlimited scans. Every deduction found. Just ${priceStr}/month — cancel any time.`}
      </Text>

      {/* What's included */}
      <View style={[styles.includesCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.includesTitle, { color: t.textSubtle }]}>PRO INCLUDES</Text>
        {[
          'Unlimited AI scans — no monthly limit',
          'Expense reports for reimbursement',
          'Everything in the Free plan',
          'Support independent development',
        ].map((item, i) => (
          <View key={i} style={styles.includeLine}>
            <MaterialCommunityIcons name="check-circle" size={16} color={t.deductible} />
            <Text style={[styles.includeText, { color: t.textPrimary }]}>{item}</Text>
          </View>
        ))}
      </View>

      {/* Social proof strip */}
      <View style={[styles.proofStrip, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
        <Text style={styles.proofStars}>★★★★★</Text>
        <Text style={[styles.proofText, { color: t.textMuted }]}>
          Joined by 10,000+ freelancers · 4.8 rating
        </Text>
      </View>

      {/* CTAs */}
      <View style={styles.offerFooter}>
        <SpringButton
          style={[styles.cta, { backgroundColor: t.cta }, purchasing && { opacity: 0.6 }]}
          onPress={onTrial}
          disabled={purchasing}
        >
          <MaterialCommunityIcons name="crown" size={18} color={t.ctaText} />
          <Text style={[styles.ctaText, { color: t.ctaText }]}>
            {'  '}{hasTrial ? 'Start 7-Day Free Trial' : 'Upgrade to Pro'}
          </Text>
        </SpringButton>

        {hasTrial && (
          <Text style={[styles.trialSmall, { color: t.textSubtle }]}>
            No charge for 7 days · {priceStr}/month after · Cancel any time
          </Text>
        )}

        <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn} hitSlop={8}>
          <Text style={[styles.seeAllText, { color: t.textMuted }]}>
            See all plans including annual (save 48%)  →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onFree} style={styles.freeBtn} hitSlop={8}>
          <Text style={[styles.freeText, { color: t.textSubtle }]}>Continue with Free plan</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function PainLine({
  t, icon, text, isLast,
}: { t: SemanticTokens; icon: string; text: string; isLast?: boolean }) {
  return (
    <View
      style={[
        styles.painLine,
        !isLast && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.painIcon, { backgroundColor: '#EF4444' + '12' }]}>
        <MaterialCommunityIcons name={icon as any} size={17} color="#EF4444" />
      </View>
      <Text style={[styles.painText, { color: t.textPrimary }]}>{text}</Text>
    </View>
  );
}

function TrustBadge({ t, icon, text }: { t: SemanticTokens; icon: string; text: string }) {
  return (
    <View style={[styles.trustBadge, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
      <MaterialCommunityIcons name={icon as any} size={13} color={t.textSubtle} />
      <Text style={[styles.trustBadgeText, { color: t.textSubtle }]}>{text}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, paddingTop: 56 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, height: 44,
  },
  topBtn:       { width: 48, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  skipText:     { fontFamily: 'Inter_400Regular', fontSize: 13 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, marginHorizontal: 12, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 2 },

  scroll:  { paddingHorizontal: 24, paddingBottom: 24 },
  screen:  { alignItems: 'center', gap: 12, paddingTop: 28, paddingBottom: 8 },

  iconWrap: {
    width: 100, height: 100, borderRadius: 26,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  label:    { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  headline: { fontFamily: 'Inter_800ExtraBold', fontSize: 30, letterSpacing: -0.8, textAlign: 'center', lineHeight: 36 },
  body:     { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },

  // Problem screen
  painCard: { width: '100%', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  painLine: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  painIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  painText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  statStrip: {
    width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  statText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, flex: 1 },

  // Solution screen
  featureGrid: {
    width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4,
  },
  featureTile: {
    width: '47%', borderRadius: 14, borderWidth: 1, padding: 14, gap: 6,
  },
  featureTileIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  featureTileTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  featureTileSub:   { fontFamily: 'Inter_400Regular', fontSize: 11 },
  trustRow: { width: '100%', flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  trustBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, borderWidth: 1,
  },
  trustBadgeText: { fontFamily: 'Inter_500Medium', fontSize: 11 },

  // Offer screen
  includesCard: { width: '100%', borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  includesTitle: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, marginBottom: 2 },
  includeLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  includeText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  proofStrip: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  proofStars: { fontSize: 14, color: '#F59E0B' },
  proofText:  { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },
  offerFooter: { width: '100%', gap: 10, marginTop: 4 },
  trialSmall: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center' },
  seeAllBtn:  { alignSelf: 'center', paddingVertical: 4 },
  seeAllText: { fontFamily: 'Inter_500Medium', fontSize: 13, textDecorationLine: 'underline' },
  freeBtn:    { alignSelf: 'center', paddingVertical: 8 },
  freeText:   { fontFamily: 'Inter_400Regular', fontSize: 13 },

  // Shared CTA
  footer:  { padding: 24, paddingBottom: 36 },
  cta: {
    width: '100%', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 52, flexDirection: 'row',
  },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
});
