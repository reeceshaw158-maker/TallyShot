import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReceiptStatus } from '../types';
import { useThemeTokens } from '../theme';

/**
 * Single source of truth for receipt status display.
 *
 * Counters Dext's "silent upload failures" review pattern: every receipt
 * card surfaces its current state so the user is never guessing whether
 * something went through.
 *
 * v1 only ever renders `complete` and `needs_review`. The other statuses
 * are rendered correctly today so v1.1 (offline AI queue) and v2 (submit
 * workflow) can light up without a component rewrite.
 */
export type StatusPillSize = 'sm' | 'md';

interface Props {
  status: ReceiptStatus;
  size?: StatusPillSize;
  /** Hide the pill entirely when status is `complete` — keeps cards clean. */
  hideWhenComplete?: boolean;
}

export function ReceiptStatusPill({ status, size = 'sm', hideWhenComplete }: Props) {
  const t = useThemeTokens();

  if (hideWhenComplete && status === 'complete') return null;

  const config: Record<
    ReceiptStatus,
    { label: string; icon: string; bg: string; fg: string }
  > = {
    complete: {
      label: 'Saved',
      icon: 'check-circle',
      bg: t.deductibleBg,
      fg: t.deductible,
    },
    needs_review: {
      label: 'Failed — tap to retry',
      icon: 'alert-circle',
      bg: t.needsReviewBg,
      fg: t.needsReview,
    },
    pending: {
      label: 'Pending',
      icon: 'clock-outline',
      bg: t.surfaceElevated,
      fg: t.textMuted,
    },
    extracting: {
      label: 'Extracting…',
      icon: 'progress-clock',
      bg: t.accent + '22',
      fg: t.accent,
    },
    draft: {
      label: 'Draft',
      icon: 'pencil-outline',
      bg: t.surfaceElevated,
      fg: t.textMuted,
    },
    submitted: {
      label: 'Submitted',
      icon: 'send-outline',
      bg: t.accent + '22',
      fg: t.accent,
    },
    approved: {
      label: 'Approved',
      icon: 'check-decagram',
      bg: t.deductibleBg,
      fg: t.deductible,
    },
    rejected: {
      label: 'Rejected',
      icon: 'close-circle',
      bg: t.dangerBg,
      fg: t.danger,
    },
  };

  const c = config[status];
  const px = size === 'md' ? 10 : 8;
  const py = size === 'md' ? 5 : 3;
  const fontSize = size === 'md' ? 12 : 11;
  const iconSize = size === 'md' ? 13 : 11;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: c.bg, paddingHorizontal: px, paddingVertical: py },
      ]}
    >
      <MaterialCommunityIcons name={c.icon as any} size={iconSize} color={c.fg} />
      <Text style={[styles.text, { color: c.fg, fontSize }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { fontFamily: 'Inter_600SemiBold', letterSpacing: -0.1 },
});
