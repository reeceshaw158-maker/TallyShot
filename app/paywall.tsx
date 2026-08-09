import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { type PurchasesPackage } from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases } from '../src/services/purchases';
import { useAppStore } from '../src/stores/appStore';
import { useThemeTokens } from '../src/theme';
import { hapticLight, hapticMedium } from '../src/utils/haptics';

// ── What Pro includes ──────────────────────────────────────────────────────────
const PRO_FEATURES = [
  { icon: 'camera-burst',      text: 'Unlimited AI scans every month' },
  { icon: 'file-delimited',    text: 'Export to CSV for your accountant' },
  { icon: 'cash-multiple',     text: 'Tax deductible tracking & totals' },
  { icon: 'chart-bar',         text: 'Full spending stats & breakdowns' },
  { icon: 'heart',             text: 'Support independent development' },
];

// ── Progressive copy by visit count ───────────────────────────────────────────
function getHeaderCopy(viewCount: number, hasTrial: boolean) {
  if (viewCount <= 1) {
    return {
      badge:    hasTrial ? '7 DAYS FREE' : 'UPGRADE',
      title:    hasTrial ? 'Try Pro free\nfor 7 days.' : 'TallyShot Pro',
      subtitle: hasTrial
        ? 'Unlimited scans, zero risk. Cancel any time from Google Play.'
        : 'Scan unlimited receipts. Track every expense. Export in seconds.',
    };
  }
  if (viewCount === 2) {
    return {
      badge:    'STILL THINKING?',
      title:    "You're leaving\nmoney behind.",
      subtitle: 'Every receipt you don\'t scan is a deduction you can\'t claim. Pro makes it effortless.',
    };
  }
  if (viewCount === 3) {
    return {
      badge:    'YOU\'VE BEEN HERE BEFORE',
      title:    "Let's make\nthis easy.",
      subtitle: '10,000+ freelancers already upgraded. The annual plan works out at just £2.08/month.',
    };
  }
  // 4+ visits — founding member framing
  return {
    badge:    '🎁 FOUNDING MEMBER OFFER',
    title:    'Lock in the lowest\nprice, forever.',
    subtitle: 'Annual Pro locks your rate for life. Prices may increase as we grow — get in now.',
  };
}

function getCtaCopy(viewCount: number, hasTrial: boolean, isAnnual: boolean) {
  if (viewCount <= 1 && hasTrial) return 'Start 7-Day Free Trial';
  if (viewCount === 2)            return isAnnual ? 'Claim Annual Pro — Save 48%' : 'Start Free Trial';
  if (viewCount === 3)            return isAnnual ? 'Get Annual for £2.08/mo' : 'Upgrade to Pro';
  return isAnnual ? 'Lock In Annual Price' : 'Go Pro Now';
}

export default function PaywallScreen() {
  const t                   = useThemeTokens();
  const setIsPro            = useAppStore((s) => s.setIsPro);
  const trustScreensSeen    = useAppStore((s) => s.trustScreensSeen);
  const setTrustScreensSeen = useAppStore((s) => s.setTrustScreensSeen);
  const paywallViewCount    = useAppStore((s) => s.paywallViewCount);
  const incrementPaywallViews = useAppStore((s) => s.incrementPaywallViews);

  const [offerings, setOfferings]   = useState<any>(null);
  const [selected, setSelected]     = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading]       = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring]   = useState(false);

  useEffect(() => {
    incrementPaywallViews();
    getOfferings().then((o) => { setOfferings(o); setLoading(false); });
  }, []);

  const monthlyPkg: PurchasesPackage | undefined = offerings?.current?.monthly;
  const annualPkg:  PurchasesPackage | undefined = offerings?.current?.annual;
  const selectedPkg = selected === 'monthly' ? monthlyPkg : annualPkg;

  const hasTrial =
    ((monthlyPkg?.product as any)?.introductoryPrice?.priceString !== undefined) ||
    ((annualPkg?.product  as any)?.introductoryPrice?.priceString !== undefined);

  // paywallViewCount is the value BEFORE this visit (increment fires in useEffect)
  const viewCount = paywallViewCount + 1;
  const copy = getHeaderCopy(viewCount, hasTrial);
  const ctaLabel = getCtaCopy(viewCount, hasTrial, selected === 'annual');

  const handleClose = () => {
    hapticLight();
    if (!trustScreensSeen) {
      setTrustScreensSeen();
      router.replace('/(tabs)');
    } else {
      router.back();
    }
  };

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    hapticMedium();
    try {
      const isPro = await purchasePackage(selectedPkg);
      if (isPro) {
        setIsPro(true);
        setTrustScreensSeen();
        hapticMedium();
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    hapticLight();
    const isPro = await restorePurchases();
    setRestoring(false);
    if (isPro) {
      setIsPro(true);
      setTrustScreensSeen();
      hapticMedium();
      router.replace('/(tabs)');
    } else {
      Alert.alert('No purchases found', 'No active Pro subscription was found for this account.');
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentContainerStyle={[styles.container, { backgroundColor: t.background }]}
    >
      {/* Close */}
      <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={16}>
        <MaterialCommunityIcons name="close" size={24} color={t.textMuted} />
      </TouchableOpacity>

      {/* Progressive header */}
      <View style={styles.header}>
        {copy.badge && (
          <View style={[styles.badge, { backgroundColor: t.accent + '22', borderColor: t.accent + '40' }]}>
            <Text style={[styles.badgeText, { color: t.accent }]}>{copy.badge}</Text>
          </View>
        )}
        <View style={[styles.iconWrap, { backgroundColor: t.accent + '22' }]}>
          <MaterialCommunityIcons name="crown" size={36} color={t.accent} />
        </View>
        <Text style={[styles.title, { color: t.textPrimary }]}>{copy.title}</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>{copy.subtitle}</Text>
      </View>

      {/* Annual nudge on repeat visits */}
      {viewCount >= 3 && (
        <View style={[styles.nudgeCard, { backgroundColor: t.cta + '12', borderColor: t.cta + '30' }]}>
          <MaterialCommunityIcons name="star-circle" size={18} color={t.cta} />
          <Text style={[styles.nudgeText, { color: t.cta }]}>
            Annual = <Text style={{ fontFamily: 'Inter_700Bold' }}>£2.08/month</Text> · Save 48% vs monthly
          </Text>
        </View>
      )}

      {/* Features */}
      <View style={[styles.featuresCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        {PRO_FEATURES.map((f, i) => (
          <View
            key={i}
            style={[
              styles.featureRow,
              i < PRO_FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.border },
            ]}
          >
            <View style={[styles.featureIcon, { backgroundColor: t.accent + '18' }]}>
              <MaterialCommunityIcons name={f.icon as any} size={18} color={t.accent} />
            </View>
            <Text style={[styles.featureText, { color: t.textPrimary }]}>{f.text}</Text>
            <MaterialCommunityIcons name="check" size={16} color={t.cta} />
          </View>
        ))}
      </View>

      {/* Pricing */}
      {loading ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.pricingRow}>
          {/* Annual — always shown first, positioned as hero option */}
          <TouchableOpacity
            style={[
              styles.priceCard,
              { backgroundColor: t.surface, borderColor: selected === 'annual' ? t.cta : t.border },
              selected === 'annual' && { borderWidth: 2 },
            ]}
            onPress={() => { hapticLight(); setSelected('annual'); }}
            activeOpacity={0.85}
          >
            <View style={[styles.bestValueBadge, { backgroundColor: t.cta }]}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={[styles.priceLabel, { color: t.textMuted }]}>Annual</Text>
            <Text style={[styles.priceAmount, { color: t.textPrimary }]}>
              {annualPkg?.product.priceString ?? '£24.99'}
            </Text>
            <Text style={[styles.priceSub, { color: t.textMuted }]}>per year</Text>
            <Text style={[styles.priceMath, { color: t.cta }]}>£2.08/mo · Save 48%</Text>
          </TouchableOpacity>

          {/* Monthly */}
          <TouchableOpacity
            style={[
              styles.priceCard,
              { backgroundColor: t.surface, borderColor: selected === 'monthly' ? t.accent : t.border },
              selected === 'monthly' && { borderWidth: 2 },
            ]}
            onPress={() => { hapticLight(); setSelected('monthly'); }}
            activeOpacity={0.85}
          >
            <Text style={[styles.priceLabel, { color: t.textMuted }]}>Monthly</Text>
            <Text style={[styles.priceAmount, { color: t.textPrimary }]}>
              {monthlyPkg?.product.priceString ?? '£3.99'}
            </Text>
            <Text style={[styles.priceSub, { color: t.textMuted }]}>per month</Text>
            {hasTrial && (
              <Text style={[styles.priceMath, { color: t.cta }]}>7 days free</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Social proof on repeat visits */}
      {viewCount >= 2 && (
        <View style={[styles.socialRow, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}>
          <Text style={styles.socialStars}>★★★★★</Text>
          <Text style={[styles.socialText, { color: t.textMuted }]}>
            10,000+ freelancers track expenses with TallyShot
          </Text>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={[
          styles.ctaBtn,
          { backgroundColor: t.cta },
          (purchasing || !selectedPkg) && { opacity: 0.6 },
        ]}
        onPress={handlePurchase}
        disabled={purchasing || !selectedPkg}
        activeOpacity={0.85}
      >
        {purchasing ? (
          <ActivityIndicator color={t.ctaText} size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="crown" size={20} color={t.ctaText} />
            <Text style={[styles.ctaText, { color: t.ctaText }]}>  {ctaLabel}</Text>
          </>
        )}
      </TouchableOpacity>

      {hasTrial && (
        <Text style={[styles.trialNote, { color: t.textSubtle }]}>
          No charge for 7 days. {selected === 'annual' ? annualPkg?.product.priceString ?? '£24.99' : monthlyPkg?.product.priceString ?? '£3.99'}/{selected === 'annual' ? 'year' : 'month'} after. Cancel any time.
        </Text>
      )}

      <Text style={[styles.legal, { color: t.textSubtle }]}>
        Billed through Google Play. Subscription renews automatically. Cancel any time.
      </Text>

      <TouchableOpacity onPress={handleRestore} disabled={restoring} style={styles.restoreBtn}>
        <Text style={[styles.restoreText, { color: t.textMuted }]}>
          {restoring ? 'Restoring...' : 'Restore purchases'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 48, minHeight: '100%' },
  closeBtn:  { alignSelf: 'flex-end', padding: 4, marginBottom: 4 },

  header: { alignItems: 'center', marginBottom: 20, gap: 8 },
  badge: {
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100, borderWidth: 1,
  },
  badgeText: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.6 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title:    { fontFamily: 'Inter_800ExtraBold', fontSize: 28, letterSpacing: -0.5, textAlign: 'center', lineHeight: 34 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300 },

  nudgeCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4,
  },
  nudgeText: { fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1 },

  featuresCard: { borderRadius: 16, borderWidth: 1, marginBottom: 20, overflow: 'hidden' },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  featureIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText:  { fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 },

  pricingRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  priceCard: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'center', gap: 3, overflow: 'visible',
  },
  bestValueBadge: {
    position: 'absolute', top: -10, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  bestValueText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#fff', letterSpacing: 0.5 },
  priceLabel:  { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 8 },
  priceAmount: { fontFamily: 'Inter_800ExtraBold', fontSize: 22, letterSpacing: -0.5 },
  priceSub:    { fontFamily: 'Inter_400Regular', fontSize: 12 },
  priceMath:   { fontFamily: 'Inter_700Bold', fontSize: 11, marginTop: 2 },

  socialRow: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8,
  },
  socialStars: { color: '#F59E0B', fontSize: 14 },
  socialText:  { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, padding: 16, minHeight: 56, marginBottom: 8,
  },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },

  trialNote: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  legal:     { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 16 },
  restoreBtn:  { alignSelf: 'center', padding: 8 },
  restoreText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
