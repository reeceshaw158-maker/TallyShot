import { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, StatusBar, ScrollView, Dimensions, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SpringButton } from '../../src/components/SpringButton';

// Enable LayoutAnimation on Android (it's a no-op on iOS without this).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore, FREE_SCAN_LIMIT } from '../../src/stores/appStore';
import { useThemeTokens, useActiveScheme, SemanticTokens } from '../../src/theme';
import { REGION_PRESETS, REGION_ORDER } from '../../src/types';

type Step = 'welcome' | 'region' | 'permissions' | 'free_tier';
const STEP_ORDER: Step[] = ['welcome', 'region', 'permissions', 'free_tier'];
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function Onboarding() {
  const t = useThemeTokens();
  const scheme = useActiveScheme();
  const [step, setStep] = useState<Step>('welcome');
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const region = useAppStore((s) => s.region);
  const setRegion = useAppStore((s) => s.setRegion);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scrollRef = useRef<ScrollView>(null);

  const stepIndex = STEP_ORDER.indexOf(step);
  const isLast = stepIndex === STEP_ORDER.length - 1;

  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  /** Scroll the pager to a given page index and sync step state. */
  const scrollToIndex = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    setStep(STEP_ORDER[index]);
  };

  const goNext = async () => {
    if (step === 'permissions') {
      if (!cameraPermission?.granted) await requestCameraPermission();
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

  /** Sync step state when the user swipes manually. */
  const onSwipeEnd = async (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    const clamped = Math.max(0, Math.min(index, STEP_ORDER.length - 1));
    if (clamped !== stepIndex) {
      // If the user swiped forward past the permissions step, trigger the
      // permission request just as the CTA button would have.
      const leavingPermissions = STEP_ORDER[stepIndex] === 'permissions' && clamped > stepIndex;
      if (leavingPermissions) {
        if (!cameraPermission?.granted) await requestCameraPermission();
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStep(STEP_ORDER[clamped]);
    }
  };

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
        <View style={styles.dots}>
          {STEP_ORDER.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: t.surfaceElevated },
                i === stepIndex && [styles.dotActive, { backgroundColor: t.cta }],
              ]}
            />
          ))}
        </View>
        {!isLast ? (
          <TouchableOpacity onPress={finish} hitSlop={12} style={styles.topBtn}>
            <Text style={[styles.skipText, { color: t.textMuted }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.topBtn} />
        )}
      </View>

      {/* Horizontal pager — swipe left/right to navigate steps.
          Each page is exactly SCREEN_WIDTH wide; inner ScrollView handles
          any vertical overflow (e.g. long region list on small phones). */}
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
            // Prevent the inner vertical scroll from fighting the outer
            // horizontal pager on small phones with lots of content.
            scrollEnabled={true}
          >
            {s === 'welcome' && <WelcomeStep tokens={t} />}
            {s === 'region' && <RegionStep tokens={t} selected={region} onPick={setRegion} />}
            {s === 'permissions' && <PermissionsStep tokens={t} />}
            {s === 'free_tier' && <FreeTierStep tokens={t} />}
          </ScrollView>
        ))}
      </ScrollView>

      {/* CTA */}
      <View style={styles.footer}>
        <SpringButton
          style={[styles.cta, { backgroundColor: t.cta }]}
          onPress={goNext}
        >
          <Text style={[styles.ctaText, { color: t.ctaText }]}>
            {step === 'welcome' && 'Get started'}
            {step === 'region' && 'Continue'}
            {step === 'permissions' && (cameraPermission?.granted ? 'Continue' : 'Allow access')}
            {step === 'free_tier' && 'Start scanning'}
          </Text>
        </SpringButton>
      </View>
    </View>
  );
}

// ── Steps ──────────────────────────────────────────────────────────────

function WelcomeStep({ tokens }: { tokens: SemanticTokens }) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.brandMark, { backgroundColor: tokens.cta }]}>
        <MaterialCommunityIcons name="receipt" size={36} color={tokens.ctaText} />
      </View>
      <Text style={[styles.brandWord, { color: tokens.textPrimary }]}>TallyShot</Text>
      <Text style={[styles.tagline, { color: tokens.cta }]}>Zero to organised in 30 seconds</Text>
      <Text style={[styles.body, { color: tokens.textMuted }]}>
        Snap a receipt, our AI extracts the details, and your expenses are tracked. No typing.
        No accounts. No ads.
      </Text>

      <View style={[styles.featureGrid, { borderColor: tokens.border }]}>
        <Feature tokens={tokens} icon="lightning-bolt" text="AI extraction in seconds" />
        <Feature tokens={tokens} icon="shield-check" text="Stays on your device" />
        <Feature tokens={tokens} icon="cash-multiple" text="Tracks tax-deductibles" />
        <Feature tokens={tokens} icon="file-export" text="CSV + PDF exports" />
      </View>
    </View>
  );
}

function RegionStep({ tokens, selected, onPick }: { tokens: SemanticTokens; selected: string; onPick: (r: any) => void }) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: tokens.accent + '18', borderColor: tokens.accent + '40' }]}>
        <MaterialCommunityIcons name="earth" size={48} color={tokens.accent} />
      </View>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>Where do you live?</Text>
      <Text style={[styles.body, { color: tokens.textMuted }]}>
        Sets your default currency and tax mode. UK / EU / AU receipts include tax in the total;
        US / CA add it on top. We never double-count.
      </Text>

      <View style={[styles.regionList, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
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
                i < REGION_ORDER.length - 1 && {
                  borderBottomColor: tokens.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
                sel && { backgroundColor: tokens.surfaceElevated },
              ]}
            >
              <Text style={styles.regionFlag}>{preset.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.regionName, { color: tokens.textPrimary }]}>{preset.name}</Text>
                <Text style={[styles.regionSub, { color: tokens.textMuted }]}>
                  {preset.currency} · {preset.taxLabel} {preset.taxMode}
                </Text>
              </View>
              {sel && <MaterialCommunityIcons name="check-circle" size={22} color={tokens.accent} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function PermissionsStep({ tokens }: { tokens: SemanticTokens }) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: tokens.accent + '18', borderColor: tokens.accent + '40' }]}>
        <MaterialCommunityIcons name="camera-iris" size={56} color={tokens.accent} />
      </View>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>Camera access</Text>
      <Text style={[styles.body, { color: tokens.textMuted }]}>
        TallyShot needs your camera to photograph receipts. We never access your existing photos
        unless you tap "Choose from Gallery".
      </Text>

      <View style={[styles.permList, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <PermLine tokens={tokens} icon="camera" text="Camera — for snapping receipts" />
        <PermLine tokens={tokens} icon="image-multiple" text="Photos — only when you pick one" isLast />
      </View>
    </View>
  );
}

function FreeTierStep({ tokens }: { tokens: SemanticTokens }) {
  return (
    <View style={styles.stepContent}>
      <View style={[styles.iconBg, { backgroundColor: tokens.cta + '18', borderColor: tokens.cta + '40' }]}>
        <MaterialCommunityIcons name="gift-outline" size={56} color={tokens.cta} />
      </View>
      <Text style={[styles.title, { color: tokens.textPrimary }]}>What's free</Text>
      <Text style={[styles.body, { color: tokens.textMuted }]}>
        No paywall pop-ups. No bait-and-switch. Just an honest free tier.
      </Text>

      <View style={[styles.tierCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <Text style={[styles.tierTitle, { color: tokens.textSubtle }]}>FREE FOREVER</Text>
        <FreeLine tokens={tokens} text={`${FREE_SCAN_LIMIT} AI scans per month`} />
        <FreeLine tokens={tokens} text="Unlimited manual entries" />
        <FreeLine tokens={tokens} text="Categories, search, filters" />
        <FreeLine tokens={tokens} text="CSV + PDF export" />
        <FreeLine tokens={tokens} text="Tax-deductible tracking" />
        <FreeLine tokens={tokens} text="No ads. No tracking. No account." />
      </View>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function Feature({ tokens, icon, text }: { tokens: SemanticTokens; icon: string; text: string }) {
  return (
    <View style={styles.feature}>
      <MaterialCommunityIcons name={icon as any} size={20} color={tokens.cta} />
      <Text style={[styles.featureText, { color: tokens.textPrimary }]}>{text}</Text>
    </View>
  );
}

function PermLine({ tokens, icon, text, isLast }: { tokens: SemanticTokens; icon: string; text: string; isLast?: boolean }) {
  return (
    <View
      style={[
        styles.permLine,
        !isLast && { borderBottomColor: tokens.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.permIcon, { backgroundColor: tokens.surfaceElevated }]}>
        <MaterialCommunityIcons name={icon as any} size={18} color={tokens.accent} />
      </View>
      <Text style={[styles.permText, { color: tokens.textPrimary }]}>{text}</Text>
    </View>
  );
}

function FreeLine({ tokens, text }: { tokens: SemanticTokens; text: string }) {
  return (
    <View style={styles.freeLine}>
      <MaterialCommunityIcons name="check-circle" size={16} color={tokens.deductible} />
      <Text style={[styles.freeText, { color: tokens.textPrimary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 56 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  topBtn: { width: 56, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  skipText: { fontFamily: 'Inter_500Medium', fontSize: 14, textAlign: 'right', width: 56 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22, borderRadius: 4 },

  scroll: { paddingHorizontal: 24, paddingBottom: 24 },
  stepContent: { alignItems: 'center', gap: 12, paddingTop: 24, paddingBottom: 16 },

  brandMark: {
    width: 72, height: 72, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  brandWord: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, letterSpacing: -0.6 },
  tagline: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2, textAlign: 'center' },

  iconBg: {
    width: 112, height: 112, borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },

  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 26, letterSpacing: -0.5, textAlign: 'center', lineHeight: 32 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 320 },

  // Welcome features grid
  featureGrid: {
    width: '100%', marginTop: 18,
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 0,
    borderRadius: 16, borderWidth: 1, padding: 12,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '50%', padding: 8 },
  featureText: { fontFamily: 'Inter_500Medium', fontSize: 12, flex: 1 },

  // Region list
  regionList: { width: '100%', marginTop: 18, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  regionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56 },
  regionFlag: { fontSize: 24 },
  regionName: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  regionSub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },

  // Permissions
  permList: { width: '100%', marginTop: 18, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  permLine: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  permIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  permText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },

  // Free tier
  tierCard: { width: '100%', marginTop: 18, borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  tierTitle: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  freeLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freeText: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },

  // CTA
  footer: { padding: 24, paddingBottom: 36 },
  cta: {
    paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 52,
  },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },
});
