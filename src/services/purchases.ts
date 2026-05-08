/**
 * RevenueCat purchases service.
 *
 * All functions are safe to call even before the SDK is configured —
 * if the API key is missing (e.g. in development) they return sensible
 * defaults instead of crashing.
 */
import Purchases, {
  LOG_LEVEL,
  type PurchasesPackage,
  type CustomerInfo,
} from 'react-native-purchases';

const RC_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY ?? '';

/** Call once at app startup (in _layout.tsx). */
export async function initPurchases(): Promise<void> {
  if (!RC_KEY) return;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: RC_KEY });
  } catch {}
}

/** Returns true if the user has an active Pro entitlement. */
export async function getProStatus(): Promise<boolean> {
  if (!RC_KEY) return false;
  try {
    const info: CustomerInfo = await Purchases.getCustomerInfo();
    return info.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}

/** Returns the current offerings (packages + prices) from RevenueCat. */
export async function getOfferings() {
  if (!RC_KEY) return null;
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
  if (!RC_KEY) return false;
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active['pro'] !== undefined;
  } catch {
    return false;
  }
}
