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

const PRO_FEATURES = [
  { icon: 'camera-burst',      text: 'Unlimited AI scans every month' },
  { icon: 'lightning-bolt',    text: 'Quick Scan — save without reviewing' },
  { icon: 'file-delimited',    text: 'Export to CSV for your accountant' },
  { icon: 'cash-multiple',     text: 'Tax deductible tracking & totals' },
  { icon: 'chart-bar',         text: 'Full spending stats & breakdowns' },
  { icon: 'heart',             text: 'Support independent development' },
];

export default function PaywallScreen() {
  const t = useThemeTokens();
  const setIsPro = useAppStore((s) => s.setIsPro);

  const [offerings, setOfferings]     = useState<any>(null);
  const [selected, setSelected]       = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading]         = useState(true);
  const [purchasing, setPurchasing]   = useState(false);
  const [restoring, setRestoring]     = useState(false);

  useEffect(() => {
    getOfferings().then((o) => {
      setOfferings(o);
      setLoading(false);
    });
  }, []);

  const monthlyPkg: PurchasesPackage | undefined =
    offerings?.current?.monthly;
  const annualPkg: PurchasesPackage | undefined =
    offerings?.current?.annual;

  const selectedPkg = selected === 'monthly' ? monthlyPkg : annualPkg;

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    hapticMedium();
    try {
      const isPro = await purchasePackage(selectedPkg);
      if (isPro) {
        setIsPro(true);
        hapticMedium();
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      // User cancelled — no alert needed. Other errors shown.
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
      {/* Close button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => { hapticLight(); router.back(); }}
        hitSlop={16}
      >
        <MaterialCommunityIcons name="close" size={24} color={t.textMuted} />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: t.accent + '22' }]}>
          <MaterialCommunityIcons name="crown" size={36} color={t.accent} />
        </View>
        <Text style={[styles.title, { color: t.textPrimary }]}>TallyShot Pro</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>
          Scan unlimited receipts. Track every expense. Export in seconds.
        </Text>
      </View>

      {/* Features list */}
      <View style={[styles.featuresCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        {PRO_FEATURES.map((f, i) => (
          <View key={i} style={[styles.featureRow, i < PRO_FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.border }]}>
            <View style={[styles.featureIcon, { backgroundColor: t.accent + '18' }]}>
              <MaterialCommunityIcons name={f.icon as any} size={18} color={t.accent} />
            </View>
            <Text style={[styles.featureText, { color: t.textPrimary }]}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Pricing options */}
      {loading ? (
        <ActivityIndicator color={t.accent} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.pricingRow}>
          {/* Annual */}
          <TouchableOpacity
            style={[
              styles.priceCard,
              { backgroundColor: t.surface, borderColor: selected === 'annual' ? t.accent : t.border },
              selected === 'annual' && { borderWidth: 2 },
            ]}
            onPress={() => { hapticLight(); setSelected('annual'); }}
            activeOpacity={0.85}
          >
            <View style={[styles.bestValueBadge, { backgroundColor: t.accent }]}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <Text style={[styles.priceLabel, { color: t.textMuted }]}>Annual</Text>
            <Text style={[styles.priceAmount, { color: t.textPrimary }]}>
              {annualPkg?.product.priceString ?? '£24.99'}
            </Text>
            <Text style={[styles.priceSub, { color: t.textMuted }]}>per year</Text>
            <Text style={[styles.priceSave, { color: t.accent }]}>Save 48%</Text>
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
          </TouchableOpacity>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={[styles.ctaBtn, { backgroundColor: t.cta }, (purchasing || !selectedPkg) && { opacity: 0.6 }]}
        onPress={handlePurchase}
        disabled={purchasing || !selectedPkg}
        activeOpacity={0.85}
      >
        {purchasing ? (
          <ActivityIndicator color={t.ctaText} size="small" />
        ) : (
          <>
            <MaterialCommunityIcons name="crown" size={20} color={t.ctaText} />
            <Text style={[styles.ctaText, { color: t.ctaText }]}>
              Start Pro {selected === 'annual' ? '· £24.99/yr' : '· £3.99/mo'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={[styles.legal, { color: t.textSubtle }]}>
        Cancel any time. Billed through Google Play. Subscription renews automatically.
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
  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },

  header: { alignItems: 'center', marginBottom: 28 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, textAlign: 'center', lineHeight: 22 },

  featuresCard: { borderRadius: 16, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureText: { fontFamily: 'Inter_500Medium', fontSize: 14, flex: 1 },

  pricingRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  priceCard: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    padding: 16, alignItems: 'center', gap: 4, overflow: 'visible',
  },
  bestValueBadge: {
    position: 'absolute', top: -10, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20,
  },
  bestValueText: { fontFamily: 'Inter_700Bold', fontSize: 9, color: '#fff', letterSpacing: 0.5 },
  priceLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 8 },
  priceAmount: { fontFamily: 'Inter_800ExtraBold', fontSize: 24, letterSpacing: -0.5 },
  priceSub: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  priceSave: { fontFamily: 'Inter_700Bold', fontSize: 12, marginTop: 2 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, padding: 16, minHeight: 56, marginBottom: 12,
  },
  ctaText: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },

  legal: { fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 16 },
  restoreBtn: { alignSelf: 'center', padding: 8 },
  restoreText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
});
