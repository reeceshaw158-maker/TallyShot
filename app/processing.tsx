import { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, Button } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
import { extractReceiptData, isExtractionConfident } from '../src/services/extraction';
import { insertReceipt } from '../src/db/receipts';
import { useAppStore } from '../src/stores/appStore';
import { Category, ReceiptDraft, CATEGORY_DEDUCTIBLE_DEFAULTS } from '../src/types';
import { ExtractionResult } from '../src/schemas/extraction';
import { useThemeTokens } from '../src/theme';

type State = 'extracting' | 'error';

export default function ProcessingScreen() {
  const { imageUri } = useLocalSearchParams<{ imageUri: string }>();
  const [state, setState] = useState<State>('extracting');
  const [errorMsg, setErrorMsg] = useState('');
  const incrementScanCount = useAppStore((s) => s.incrementScanCount);
  const currency = useAppStore((s) => s.currency);
  const quickScan = useAppStore((s) => s.quickScan);
  const taxMode = useAppStore((s) => s.taxMode);
  const taxLabel = useAppStore((s) => s.taxLabel);
  const t = useThemeTokens();

  useEffect(() => {
    if (!imageUri) { router.replace('/(tabs)'); return; }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Save a confident extraction result directly to DB and return to the list.
   * Used by Quick Scan mode.
   */
  const saveConfident = async (result: ExtractionResult) => {
    const category = (result.suggested_category as Category) ?? 'Other';
    const draft: ReceiptDraft = {
      merchant: result.merchant,
      date: result.date,
      currency: result.currency ?? currency,
      line_items: result.line_items ?? [],
      subtotal: result.subtotal ?? 0,
      tax: result.tax ?? 0,
      total: result.total,
      payment_method: result.payment_method ?? null,
      invoice_number: result.invoice_number ?? null,
      category,
      notes: '',
      image_uri: imageUri,
      status: 'complete',
      is_tax_deductible: CATEGORY_DEDUCTIBLE_DEFAULTS[category] ?? false,
    };
    await insertReceipt(draft);
    router.replace('/(tabs)');
  };

  const run = async () => {
    setState('extracting');
    // 30-second safety net — if the worker never responds the user is
    // stuck on the spinner forever. This transitions to error so they
    // can retry or save manually.
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setErrorMsg('The AI is taking too long. Check your connection and try again.');
      setState('error');
    }, 30_000);
    try {
      const result = await extractReceiptData(imageUri, taxMode, taxLabel);
      clearTimeout(timeoutId);
      if (timedOut) return;

      // Quick Scan: save direct + skip review when AI is confident.
      if (quickScan && isExtractionConfident(result)) {
        await saveConfident(result);
        incrementScanCount(); // only after receipt is safely saved
        return;
      }

      // Otherwise: send to Review for the user to confirm.
      // Count the scan now — extraction succeeded even if user edits before saving.
      incrementScanCount();
      router.replace({
        pathname: '/review/[id]',
        params: {
          id: 'new',
          imageUri,
          extraction: JSON.stringify(result),
        },
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (timedOut) return; // timeout already showed the error
      setErrorMsg(err?.message ?? 'Unknown error');
      setState('error');
    }
  };

  const saveAsNeedsReview = async () => {
    try {
      const draft: ReceiptDraft = {
        merchant: '',
        date: new Date().toISOString().slice(0, 10),
        currency,
        line_items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        payment_method: null,
        invoice_number: null,
        category: 'Other' as Category,
        notes: '',
        image_uri: imageUri,
        status: 'needs_review',
        is_tax_deductible: false,
      };
      const id = await insertReceipt(draft);
      router.replace({
        pathname: '/review/[id]',
        params: { id: String(id) },
      });
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Could not save receipt');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {imageUri && (
        <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
      )}

      {state === 'extracting' && (
        <View style={styles.overlay}>
          <View style={styles.pill}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.pillText}>Reading receipt...</Text>
          </View>
        </View>
      )}

      {state === 'error' && (
        <View style={[styles.errorBox, { backgroundColor: t.background }]}>
          <View style={[styles.errorCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={[styles.errorIcon, { backgroundColor: t.warningBg }]}>
              <Text style={{ fontSize: 32 }}>⚠️</Text>
            </View>
            <Text style={[styles.errorTitle, { color: t.textPrimary }]}>
              Couldn't read the receipt
            </Text>
            <Text style={[styles.errorBody, { color: t.textMuted }]}>
              We've kept the photo safe. You can edit the details now or retry later from the receipts list.
            </Text>
            {errorMsg ? (
              <Text style={[styles.errorDetail, { color: t.textSubtle }]}>{errorMsg}</Text>
            ) : null}
            <Button
              mode="contained"
              onPress={saveAsNeedsReview}
              buttonColor={t.cta}
              textColor={t.ctaText}
              style={styles.errorBtn}
              labelStyle={styles.errorBtnLabel}
            >
              Edit details
            </Button>
            <Button mode="outlined" onPress={run} textColor={t.textPrimary} style={styles.errorBtn}>
              Try AI again
            </Button>
            <Button onPress={saveAsNeedsReview} textColor={t.textMuted}>
              Save & exit
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  preview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 80,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  pillText: { color: 'white', fontSize: 15, fontFamily: 'Inter_500Medium' },
  errorBox: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%', maxWidth: 380,
    borderRadius: 20, borderWidth: 1, padding: 24,
    alignItems: 'center', gap: 8,
  },
  errorIcon: {
    width: 64, height: 64, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  errorTitle: {
    fontFamily: 'Inter_700Bold', fontSize: 18, textAlign: 'center',
    letterSpacing: -0.3,
  },
  errorBody: {
    fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center',
    lineHeight: 19, marginTop: 4,
  },
  errorDetail: {
    fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center',
    marginTop: 4, marginBottom: 8,
  },
  errorBtn: { width: '100%', borderRadius: 12, marginTop: 8, minHeight: 48, justifyContent: 'center' },
  errorBtnLabel: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});
