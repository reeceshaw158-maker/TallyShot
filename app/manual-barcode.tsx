import { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeTokens } from '../src/theme';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { canonicalBarcode, hasValidCheckDigit } from '../src/services/productLookup';

/**
 * Type a barcode in by hand.
 *
 * The case this exists for: the barcode is torn, curved round a tin, under
 * shrink wrap, wet, or printed too small for the camera to resolve. Every
 * scanner that lacks this screen dead-ends on those products, and the app has
 * nothing to say beyond "try again".
 *
 * The check digit is verified before we spend a network round trip, because a
 * mistyped code and a genuinely unknown product are indistinguishable once the
 * lookup comes back empty — and telling someone a real product "isn't in any
 * database" when they simply transposed two digits is the worse failure.
 */
export default function ManualBarcodeScreen() {
  const t = useThemeTokens();
  const [value, setValue] = useState('');

  const digits = value.replace(/\D/g, '');

  const status = useMemo((): { ok: boolean; message: string } => {
    if (digits.length === 0) {
      return { ok: false, message: 'EAN-13, EAN-8, UPC-A or ITF-14 — the digits printed under the bars.' };
    }
    if (![8, 12, 13, 14].includes(digits.length)) {
      return {
        ok: false,
        message: `${digits.length} digit${digits.length === 1 ? '' : 's'} — retail barcodes are 8, 12, 13 or 14.`,
      };
    }
    if (!hasValidCheckDigit(digits)) {
      return {
        ok: false,
        message: "That doesn't check out — the last digit is a checksum of the others, so two are probably swapped.",
      };
    }
    if (!canonicalBarcode(digits, digits.length === 8 ? 'ean8' : 'ean13')) {
      return { ok: false, message: 'Not a barcode any product database indexes.' };
    }
    return { ok: true, message: 'Valid barcode.' };
  }, [digits]);

  const submit = () => {
    if (!status.ok) return;
    hapticMedium();
    // Hand off to the scanner screen's existing lookup path rather than
    // duplicating it. `rescan` runs the full chain — cache first, so a code
    // typed twice answers instantly and offline.
    router.replace({ pathname: '/capture', params: { rescan: digits } });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={[styles.iconWrap, { backgroundColor: t.surfaceElevated }]}>
          <MaterialCommunityIcons name="barcode" size={34} color={t.accent} />
        </View>

        <Text style={[styles.title, { color: t.textPrimary }]}>Type the barcode</Text>
        <Text style={[styles.blurb, { color: t.textMuted }]}>
          For barcodes that are torn, curved, wrapped or just too small to scan.
        </Text>

        <TextInput
          value={value}
          onChangeText={(next) => setValue(next.replace(/\D/g, '').slice(0, 14))}
          keyboardType="number-pad"
          inputMode="numeric"
          returnKeyType="search"
          onSubmitEditing={submit}
          autoFocus
          maxLength={14}
          placeholder="0000000000000"
          placeholderTextColor={t.textSubtle}
          accessibilityLabel="Barcode digits"
          style={[
            styles.input,
            {
              color: t.textPrimary,
              backgroundColor: t.surface,
              borderColor: digits.length === 0 ? t.border : status.ok ? t.success : t.warning,
            },
          ]}
        />

        <Text
          style={[
            styles.status,
            { color: digits.length === 0 ? t.textSubtle : status.ok ? t.success : t.warning },
          ]}
        >
          {status.message}
        </Text>

        <TouchableOpacity
          onPress={submit}
          disabled={!status.ok}
          accessibilityRole="button"
          accessibilityLabel="Look up this barcode"
          accessibilityState={{ disabled: !status.ok }}
          style={[styles.cta, { backgroundColor: t.cta }, !status.ok && styles.ctaDisabled]}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, { color: t.ctaText }]}>Look it up</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            hapticLight();
            router.back();
          }}
          accessibilityRole="button"
          style={styles.secondary}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryText, { color: t.textMuted }]}>Back to the scanner</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 32, alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 22, fontWeight: '700' },
  blurb: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  input: {
    width: '100%',
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  status: { fontSize: 13, lineHeight: 18, textAlign: 'center', minHeight: 36, maxWidth: 320 },
  cta: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontSize: 16, fontWeight: '700' },
  secondary: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryText: { fontSize: 14 },
});
