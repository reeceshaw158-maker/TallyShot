import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
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
  /** True once the user has dismissed or completed the post-onboarding trust/priming screens. */
  trustScreensSeen: boolean;
  /** Incremented every time the paywall screen mounts. Drives progressive copy + urgency. */
  paywallViewCount: number;
  scansUsedThisMonth: number;
  scansResetMonth: string;
  isPro: boolean;
  currency: string;
  theme: 'light' | 'dark' | 'system';
  quickScan: boolean;
  region: Region;
  /**
   * True once the user has explicitly chosen a region (onboarding picker
   * or Settings). While false, we re-detect from the device locale on
   * each launch so a freshly installed app reflects the user's actual
   * country instead of whatever the last default was.
   */
  regionExplicitlySet: boolean;
  taxMode: TaxMode;
  taxLabel: string;
  summaryMode: SummaryMode;
  photoMode: PhotoMode;
  /** Null when no deletion is in flight. Set by receipt detail + multi-select delete. */
  pendingDeletion: PendingDeletion | null;

  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setTrustScreensSeen: () => void;
  incrementPaywallViews: () => void;
  incrementScanCount: () => void;
  resetScanCountIfNewMonth: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setCurrency: (currency: string) => void;
  setQuickScan: (v: boolean) => void;
  /**
   * Set region from the picker. Auto-applies the region's currency and
   * tax mode/label as defaults, and marks the choice as user-explicit so
   * we stop auto-detecting on subsequent launches.
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
 * Best-effort device-locale → Region detection.
 *
 * Reads expo-localization (which exposes the OS region setting, not just
 * the UI language) and falls back to currency / locale heuristics. Used
 * both at first launch and on every subsequent launch while the user
 * hasn't explicitly picked a region — that way a user in the UK whose
 * device language is English (US) still gets GBP.
 */
function detectRegionFromLocale(): Region {
  // 1. Primary signal: ISO 3166-1 region code from the device's region
  //    setting (e.g. 'GB', 'US'). This is what we actually want.
  try {
    const locales = Localization.getLocales?.() ?? [];
    for (const l of locales) {
      const code = (l.regionCode || '').toUpperCase();
      if (code === 'GB' || code === 'UK')           return 'GB';
      if (code === 'AU')                            return 'AU';
      if (code === 'NZ')                            return 'NZ';
      if (code === 'US')                            return 'US';
      if (code === 'CA')                            return 'CA';
      if (['DE','FR','ES','IT','NL','PT','FI','SE','DK','PL','GR','IE','AT','BE','LU','CZ','SK','SI','HR','EE','LV','LT','CY','MT','BG','RO','HU'].includes(code))
        return 'EU';
    }
  } catch {}

  // 2. Secondary signal: device currency (some devices report region '' but
  //    still have a currency).
  try {
    const calendars = Localization.getCalendars?.();
    // getCalendars doesn't expose currency directly — try locales[].currencyCode
    const locales = Localization.getLocales?.() ?? [];
    for (const l of locales) {
      const cur = (l.currencyCode || '').toUpperCase();
      if (cur === 'GBP') return 'GB';
      if (cur === 'EUR') return 'EU';
      if (cur === 'USD') return 'US';
      if (cur === 'CAD') return 'CA';
      if (cur === 'AUD') return 'AU';
      if (cur === 'NZD') return 'NZ';
    }
    void calendars; // referenced to keep the inner block consistent
  } catch {}

  // 3. Last resort: fall through to 'other' so the user picks in onboarding.
  return 'other';
}

const initialRegion = detectRegionFromLocale();
const initialPreset = REGION_PRESETS[initialRegion];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      trustScreensSeen: false,
      paywallViewCount: 0,
      scansUsedThisMonth: 0,
      scansResetMonth: currentYearMonth(),
      isPro: false, // set at startup via RevenueCat (see _layout.tsx)
      currency: initialPreset.currency,
      theme: 'dark',
      quickScan: false,
      region: initialRegion,
      regionExplicitlySet: false,
      taxMode: initialPreset.taxMode,
      taxLabel: initialPreset.taxLabel,
      summaryMode: 'lineItems',
      photoMode: 'original',
      pendingDeletion: null,

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ hasCompletedOnboarding: false }),
      setTrustScreensSeen: () => set({ trustScreensSeen: true }),
      incrementPaywallViews: () => set((s) => ({ paywallViewCount: s.paywallViewCount + 1 })),

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
          regionExplicitlySet: true,
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
      // On rehydrate, if the user never picked a region explicitly, re-run
      // detection against the device locale. Fixes the "still on $ even
      // though I live in the UK" case where a previous default got stuck.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.regionExplicitlySet) {
          const detected = detectRegionFromLocale();
          const preset = REGION_PRESETS[detected];
          state.region = detected;
          state.currency = preset.currency;
          state.taxMode = preset.taxMode;
          state.taxLabel = preset.taxLabel;
        }
      },
    }
  )
);

export const FREE_SCAN_LIMIT = 10;
