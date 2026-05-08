import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { REGION_PRESETS, Region, TaxMode } from '../types';

/**
 * How the receipt detail screen summarises numbers.
 * - `lineItems` (default): show every line item.
 * - `totals`: prominently show the three numbers small-business users actually
 *   need to file (net / VAT / gross) and collapse line items behind an
 *   expander. Line items are still captured and exported — just hidden.
 *   Counters SparkReceipt's Peter Hawthorne (Feb 2026) review: line-item
 *   extraction can be unreliable, users want a "just the three numbers"
 *   fallback on the receipt screen.
 */
export type SummaryMode = 'lineItems' | 'totals';

/**
 * What the camera does to a captured photo before extraction.
 * - `original` (default): no client-side filters or auto-adjust. Counters
 *   SparkReceipt's Peter Hawthorne (Feb 2026) review: aggressive default
 *   filtering hurts OCR on thermal-paper receipts.
 * - `enhanced`: opt-in de-skew + contrast boost via expo-image-manipulator.
 */
export type PhotoMode = 'original' | 'enhanced';

/**
 * Receipts the user just "deleted" but haven't been permanently removed yet.
 * They are archived immediately (disappear from the list) and stay archived
 * for 5 seconds while the undo snackbar is visible. On undo: restoreReceipt
 * for each id. On timeout: permanentlyDeleteReceipt for each id.
 *
 * Not persisted — if the app restarts during the 5-second window, the receipt
 * stays archived (recoverable from Settings → Archived Receipts) rather than
 * being restored unexpectedly.
 */
export interface PendingDeletion {
  ids: number[];
  /** Human-readable label for the snackbar, e.g. "Receipt deleted" */
  label: string;
}

interface AppState {
  hasCompletedOnboarding: boolean;
  scansUsedThisMonth: number;
  scansResetMonth: string;
  isPro: boolean;
  currency: string;
  theme: 'light' | 'dark' | 'system';
  quickScan: boolean;
  region: Region;
  taxMode: TaxMode;
  taxLabel: string;
  summaryMode: SummaryMode;
  photoMode: PhotoMode;
  /** Null when no deletion is in flight. Set by receipt detail + multi-select delete. */
  pendingDeletion: PendingDeletion | null;

  completeOnboarding: () => void;
  incrementScanCount: () => void;
  resetScanCountIfNewMonth: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCurrency: (currency: string) => void;
  setQuickScan: (v: boolean) => void;
  /**
   * Set region from the picker. Auto-applies the region's currency and
   * tax mode/label as defaults.
   */
  setRegion: (region: Region) => void;
  setTaxMode: (mode: TaxMode) => void;
  setSummaryMode: (mode: SummaryMode) => void;
  setPhotoMode: (mode: PhotoMode) => void;
  setPendingDeletion: (v: PendingDeletion | null) => void;
  setIsPro: (v: boolean) => void;
}

// Use the device's local calendar date so the monthly reset fires at
// midnight local time, not UTC midnight (which would be the wrong day
// for users in UTC+1 through UTC+14).
const currentYearMonth = () => new Date().toLocaleDateString('en-CA').slice(0, 7);

/**
 * Best-effort device-locale → Region detection. Used only as the *initial*
 * default — the user picks their region during onboarding and can change it
 * any time in Settings.
 */
function detectRegionFromLocale(): Region {
  let locale = '';
  try {
    if (Platform.OS === 'ios') {
      locale =
        NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ||
        '';
    } else if (Platform.OS === 'android') {
      locale = NativeModules.I18nManager?.localeIdentifier || '';
    }
  } catch {
    locale = '';
  }
  const code = locale.toLowerCase();
  if (code.includes('gb') || code.includes('uk')) return 'GB';
  if (code.includes('au')) return 'AU';
  if (code.includes('nz')) return 'NZ';
  if (code.includes('us')) return 'US';
  if (code.includes('ca')) return 'CA';
  if (/^(de|fr|es|it|nl|pt|fi|se|dk|pl|gr|ie|at|be)/.test(code)) return 'EU';
  return 'GB'; // sensible default
}

const initialRegion = detectRegionFromLocale();
const initialPreset = REGION_PRESETS[initialRegion];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      scansUsedThisMonth: 0,
      scansResetMonth: currentYearMonth(),
      isPro: false, // set at startup via RevenueCat (see _layout.tsx)
      currency: initialPreset.currency,
      theme: 'dark',
      quickScan: false,
      region: initialRegion,
      taxMode: initialPreset.taxMode,
      taxLabel: initialPreset.taxLabel,
      summaryMode: 'lineItems',
      photoMode: 'original',
      pendingDeletion: null,

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      incrementScanCount: () => {
        get().resetScanCountIfNewMonth();
        set((s) => ({ scansUsedThisMonth: s.scansUsedThisMonth + 1 }));
      },

      resetScanCountIfNewMonth: () => {
        const now = currentYearMonth();
        if (get().scansResetMonth !== now) {
          set({ scansUsedThisMonth: 0, scansResetMonth: now });
        }
      },

      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
      setQuickScan: (v) => set({ quickScan: v }),

      setRegion: (region) => {
        const preset = REGION_PRESETS[region];
        set({
          region,
          currency: preset.currency,
          taxMode: preset.taxMode,
          taxLabel: preset.taxLabel,
        });
      },

      setTaxMode: (mode) => set({ taxMode: mode }),
      setSummaryMode: (mode) => set({ summaryMode: mode }),
      setPhotoMode: (mode) => set({ photoMode: mode }),
      setPendingDeletion: (v) => set({ pendingDeletion: v }),
      setIsPro: (v) => set({ isPro: v }),
    }),
    {
      name: 'tallyshot-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      // pendingDeletion is intentionally excluded from persistence.
      // If the app restarts mid-5-second-window the receipt stays archived
      // (recoverable from Settings → Archived Receipts) — never silently lost.
      partialize: ({ pendingDeletion: _pd, ...rest }) => rest,
    }
  )
);

export const FREE_SCAN_LIMIT = 10;
