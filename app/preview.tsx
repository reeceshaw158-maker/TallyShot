import { useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sharePDFFile } from '../src/services/export';
import { useAppStore } from '../src/stores/appStore';
import { useThemeTokens, SemanticTokens } from '../src/theme';

/**
 * PDF preview screen.
 *
 * Renders the generated PDF in a WebView so the user sees exactly what they'll
 * share before tapping Share. Counters Easy Expense's "I shared the wrong report"
 * complaints — you see the report first.
 *
 * Note: Android WebView doesn't render PDF files directly via file:// URI.
 * Workaround: route through Google Docs viewer for Android, native viewer on iOS.
 */
export default function PreviewScreen() {
  const { uri, title, count, total, deductible } = useLocalSearchParams<{
    uri: string;
    title: string;
    count: string;
    total: string;
    deductible: string;
  }>();
  const [sharing, setSharing] = useState(false);
  const [webLoading, setWebLoading] = useState(true);
  const t = useThemeTokens();
  const currency = useAppStore((s) => s.currency);

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(n);
    } catch {
      return `${currency} ${n.toFixed(2)}`;
    }
  };

  const totalNum = Number(total) || 0;
  const deductibleNum = Number(deductible) || 0;
  const countNum = Number(count) || 0;

  const handleShare = async () => {
    if (!uri) return;
    setSharing(true);
    try {
      await sharePDFFile(uri);
    } catch (err: any) {
      Alert.alert('Share failed', err?.message ?? 'Could not open share sheet');
    } finally {
      setSharing(false);
    }
  };

  // Android WebView can't render local PDF files reliably; use Google's PDF viewer.
  // On iOS, the native viewer handles file:// URIs fine.
  const webViewUri =
    Platform.OS === 'android'
      ? `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(uri ?? '')}`
      : (uri ?? '');

  // For Android, the file:// URI won't be reachable by Google Docs.
  // Fallback: render a friendly "ready to share" card.
  const useFallback = Platform.OS === 'android';

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      {/* Stats bar */}
      <View style={[styles.statsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Stat tokens={t} label="Receipts" value={String(countNum)} />
        <View style={[styles.statDivider, { backgroundColor: t.border }]} />
        <Stat tokens={t} label="Total" value={fmt(totalNum)} />
        {deductibleNum > 0 && (
          <>
            <View style={[styles.statDivider, { backgroundColor: t.border }]} />
            <Stat tokens={t} label="Deductible" value={fmt(deductibleNum)} accent={t.deductible} />
          </>
        )}
      </View>

      {/* PDF preview area */}
      <View style={[styles.previewArea, { backgroundColor: t.surface, borderColor: t.border }]}>
        {useFallback ? (
          <View style={styles.androidFallback}>
            <View style={[styles.fallbackIcon, { backgroundColor: t.cta + '22' }]}>
              <MaterialCommunityIcons name="file-pdf-box" size={56} color={t.cta} />
            </View>
            <Text style={[styles.fallbackTitle, { color: t.textPrimary }]}>
              {title || 'Report ready'}
            </Text>
            <Text style={[styles.fallbackBody, { color: t.textMuted }]}>
              Your PDF has been generated. Tap Share to send it, or open it in your phone's PDF viewer.
            </Text>
          </View>
        ) : (
          <>
            <WebView
              source={{ uri: webViewUri }}
              style={styles.webview}
              onLoadEnd={() => setWebLoading(false)}
              startInLoadingState
            />
            {webLoading && (
              <View style={[styles.loadingOverlay, { backgroundColor: t.surface + 'd9' }]}>
                <ActivityIndicator size="large" color={t.accent} />
              </View>
            )}
          </>
        )}
      </View>

      {/* Action bar */}
      <View style={[styles.actions, { backgroundColor: t.surface, borderTopColor: t.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.editBtn, { backgroundColor: t.surfaceElevated, borderColor: t.border }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="pencil" size={18} color={t.textPrimary} />
          <Text style={[styles.btnText, { color: t.textPrimary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleShare}
          disabled={sharing}
          style={[styles.shareBtn, { backgroundColor: t.cta }, sharing && { opacity: 0.6 }]}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="share-variant" size={18} color={t.ctaText} />
          <Text style={[styles.btnText, { color: t.ctaText }]}>
            {sharing ? 'Sharing...' : 'Share'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Stat({
  tokens,
  label,
  value,
  accent,
}: {
  tokens: SemanticTokens;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: tokens.textSubtle }]}>{label}</Text>
      <Text style={[styles.statValue, { color: accent ?? tokens.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    margin: 12,
    marginBottom: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    marginTop: 4,
    letterSpacing: -0.3,
  },
  statDivider: { width: 1, height: 28 },

  previewArea: {
    flex: 1,
    margin: 12,
    marginTop: 4,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  fallbackIcon: {
    width: 100, height: 100, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  fallbackTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  fallbackBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 320,
  },

  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
  },
  shareBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    minHeight: 48,
  },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: -0.1 },
});
