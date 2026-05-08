/**
 * Safe haptics helpers.
 *
 * expo-haptics throws on Android emulators (no vibration hardware) and
 * some of its methods (selectionAsync, notificationAsync) are iOS-only.
 * All functions here are best-effort: they catch and swallow any error
 * so a missing vibrator never crashes the app.
 */
import * as Haptics from 'expo-haptics';

/** Light tap — use for selections, toggles, chip presses. */
export function hapticLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium bump — use for confirmations, successful saves, scan complete. */
export function hapticMedium() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Heavy thud — use for destructive actions (delete, bulk delete). */
export function hapticHeavy() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}
