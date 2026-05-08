/**
 * Subscription management — honest, one-tap cancellation.
 *
 * Counters the SparkReceipt cancellation pattern (review thread, Jan 2026):
 * "downgrade" routed users to billing, billing only cancelled the *next* bill.
 * No retention modal, no guilt screen, no hidden close button. The button in
 * Settings opens Google Play's own subscription manager and Play handles the
 * cancellation — there is no way for us to slow that down even if we wanted to.
 *
 * Format ratified by Google Play developer docs (verified May 2026):
 *   https://developer.android.com/google/play/billing/billing_subscriptions#deep-links-manage-subs
 *
 *   - All subscriptions for this app: ?package=<pkg>
 *   - Specific SKU: ?package=<pkg>&sku=<sku>
 *   - Bare URL with no params lists every Play subscription on the account.
 */
import { Linking, Platform, Alert } from 'react-native';

export const PLAY_PACKAGE = 'com.tallyshot.app';

const PLAY_SUBS_BASE = 'https://play.google.com/store/account/subscriptions';

/**
 * Build the Play Store deep-link URL for managing TallyShot's subscription.
 *
 * @param sku optional product SKU. If provided, opens the specific
 *            subscription's management page. If omitted, opens the user's
 *            list of all TallyShot subscriptions on this Google account.
 *            Until RevenueCat is wired in we have no live SKU, so callers
 *            currently pass nothing — the all-subscriptions page is fine.
 */
export function getManageSubscriptionUrl(sku?: string): string {
  const params = new URLSearchParams({ package: PLAY_PACKAGE });
  if (sku) params.set('sku', sku);
  return `${PLAY_SUBS_BASE}?${params.toString()}`;
}

/**
 * Open Play Store's subscription manager for TallyShot. Resolves once the
 * deep link has been launched (or alerts the user on the rare case where
 * Linking refuses — non-Play Android, web, sideloaded build, etc.).
 */
export async function openManageSubscription(sku?: string): Promise<void> {
  const url = getManageSubscriptionUrl(sku);

  // iOS / non-Android builds get a friendly redirect to the web subscription
  // manager. iOS apps would use a different deep link
  // (itms-apps://apps.apple.com/account/subscriptions); we don't ship iOS yet
  // but the web URL works there too.
  if (Platform.OS !== 'android') {
    await Linking.openURL(url);
    return;
  }

  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      // Extremely unlikely on a real Play device — surface honestly rather
      // than failing silently. Never fail silently is a TallyShot rule.
      Alert.alert(
        'Could not open Play Store',
        `Open this URL in your browser to manage your subscription:\n\n${url}`
      );
      return;
    }
    await Linking.openURL(url);
  } catch (err: any) {
    Alert.alert(
      'Could not open Play Store',
      err?.message ?? `Open this URL in your browser:\n\n${url}`
    );
  }
}
