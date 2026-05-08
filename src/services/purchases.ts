/**
 * RevenueCat purchases service.
 *
 * All functions are safe to call even before the SDK is configured —
 * if the API key is missing (e.g. in development) they return sensible
 * defaults instead of crashing.
 */
import type { PurchasesPackage } from 'react-native-purchases';

const RC_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? '';

// react-native-purchases is a native module — not available in Expo Go.
// We lazy-require it so Metro doesn't crash when running in the dev client.
let Purchases: any = null;
try {
  Purchases = require('react-native-purchases').default;
} catch {
  // Running in Expo Go — purchases unavailable, all functions return safe defaults.
}

/** Call once at app startup (in _layout.tsx). */
export async function initPurchases(): Promise<void> {
  if (!RC_KEY || !Purchases) return;
  try {
    if (__DEV__) Purchases.setLogLevel(1); // LOG_LEVEL.DEBUG = 1
    Purchases.configure({ apiKey: RC_KEY });
  } catch {}
}

/** Returns true if the user has an active Pro entitlement. */
export async function getProStatus(): Promise<boolean> {
  if (!RC_KEY || !Purchases) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}

/** Returns the current offerings (packages + prices) from RevenueCat. */
export async function getOfferings() {
  if (!RC_KEY || !Purchases) return null;
  try {
    return await Purchases.getOfferings();
  } catch {
    return null;
  }
}

/**
 * Purchase a package. Returns true if Pro is now active.
 * Throws if the user cancels or the purchase fails — catch in the UI.
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<boolean> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo.entitlements.active['pro'] !== undefined;
}

/** Restore previous purchases. Returns true if Pro was restored. */
export async function restorePurchases(): Promise<boolean> {
  if (!RC_KEY || !Purchases) return false;
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}
