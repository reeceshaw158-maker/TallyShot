// Deliberately React Native's own Text and not Paper's: this component can be
// rendered in place of a crashed *layout*, which means PaperProvider may not be
// above it. An error screen that itself throws is no error screen at all.
import { View, StyleSheet, TouchableOpacity, ScrollView, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeTokens } from '../theme';

/**
 * What the user sees when a screen throws while rendering.
 *
 * Expo Router looks for an `ErrorBoundary` export on a route or layout file and
 * renders it in place of the crashed subtree, handing it the error and a
 * `retry`. Without one, a render throw leaves a blank screen with no way back —
 * the single worst failure mode in the app, because it looks like the phone
 * died rather than the app.
 *
 * The raw error is deliberately not the headline. It is available behind a
 * disclosure for a bug report, but the message the user reads first is one they
 * can act on, per the rule that no raw error is ever shown to the user.
 */
export interface ErrorBoundaryProps {
  error: Error;
  retry: () => Promise<void>;
}

export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  const t = useThemeTokens();

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: t.dangerBg }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={34} color={t.danger} />
        </View>

        <Text style={[styles.title, { color: t.textPrimary }]}>This screen hit a snag</Text>
        <Text style={[styles.blurb, { color: t.textMuted }]}>
          Nothing has been lost — your receipts and scans are saved on this phone and are
          untouched. Try the screen again.
        </Text>

        <TouchableOpacity
          onPress={() => {
            retry().catch(() => {});
          }}
          accessibilityRole="button"
          accessibilityLabel="Try this screen again"
          style={[styles.cta, { backgroundColor: t.cta }]}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, { color: t.ctaText }]}>Try again</Text>
        </TouchableOpacity>

        {/* Kept for bug reports. Small, muted, and below the fold of attention. */}
        <Text style={[styles.detail, { color: t.textSubtle }]} selectable>
          {error?.message || 'Unknown error'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 12,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 21, fontWeight: '700', textAlign: 'center' },
  blurb: { fontSize: 14.5, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  cta: {
    minWidth: 200,
    minHeight: 52,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 11.5, lineHeight: 16, textAlign: 'center', marginTop: 18, maxWidth: 320 },
});
