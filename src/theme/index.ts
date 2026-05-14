/**
 * TallyShot theme system.
 *
 * Single source of truth for colour. Screens consume these via
 * `useThemeTokens()` rather than hardcoding hex values, so the app supports
 * dark and light without per-screen `if (isDark)` branches.
 *
 * Palette: Corporate Blue.
 * Deep blue primary — professional fintech feel (Xero, Wise, Revolut family).
 */

import { useColorScheme } from 'react-native';
import { useAppStore } from '../stores/appStore';

export interface SemanticTokens {
  // Surfaces
  background: string;        // page background
  surface: string;           // standard card / sheet
  surfaceElevated: string;   // raised card / pressed state
  surfaceMuted: string;      // pill chip background
  border: string;            // dividers, card edges, hairlines

  // Text
  textPrimary: string;       // main body / headings
  textMuted: string;         // secondary / metadata
  textSubtle: string;        // tertiary / placeholder
  textInverse: string;       // text on accent/CTA backgrounds

  // Brand
  accent: string;            // teal — selection, links, info chips
  cta: string;               // amber — primary action button
  ctaText: string;           // text colour on amber CTA

  // Semantic
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;

  // Receipt-specific
  needsReview: string;       // amber for needs-review banner/border
  needsReviewBg: string;
  deductible: string;        // green for tax-deductible chips
  deductibleBg: string;
}

export const darkTokens: SemanticTokens = {
  background: '#0d0f14',
  surface: '#161b27',
  surfaceElevated: '#1e2535',
  surfaceMuted: '#1a2030',
  border: '#252d3d',

  textPrimary: '#f0f2f5',
  textMuted: '#8b96a8',
  textSubtle: '#4f5b6e',
  textInverse: '#ffffff',

  accent: '#60a5fa',         // blue-400
  cta: '#2563eb',            // blue-600
  ctaText: '#ffffff',

  success: '#34d399',
  successBg: 'rgba(52,211,153,0.14)',
  warning: '#fbbf24',
  warningBg: 'rgba(251,191,36,0.14)',
  danger: '#f87171',
  dangerBg: 'rgba(248,113,113,0.14)',

  needsReview: '#fbbf24',
  needsReviewBg: 'rgba(251,191,36,0.16)',
  deductible: '#34d399',
  deductibleBg: 'rgba(52,211,153,0.16)',
};

export const lightTokens: SemanticTokens = {
  background: '#f0f2f5',
  surface: '#ffffff',
  surfaceElevated: '#e8ecf2',
  surfaceMuted: '#eef1f6',
  border: '#dde2ea',

  textPrimary: '#0d1117',
  textMuted: '#4a5568',
  textSubtle: '#8b96a8',
  textInverse: '#ffffff',

  accent: '#1d4ed8',         // blue-700
  cta: '#2563eb',            // blue-600
  ctaText: '#ffffff',

  success: '#15803d',
  successBg: '#dcfce7',
  warning: '#b45309',
  warningBg: '#fef3c7',
  danger: '#b91c1c',
  dangerBg: '#fee2e2',

  needsReview: '#b45309',
  needsReviewBg: '#fff3cd',
  deductible: '#15803d',
  deductibleBg: '#dcfce7',
};

/**
 * Resolve the active token set based on the user's chosen theme mode.
 * Use this at the top of any component that needs colours.
 */
export function useThemeTokens(): SemanticTokens {
  const systemScheme = useColorScheme();
  const themeMode = useAppStore((s) => s.theme);
  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');
  return isDark ? darkTokens : lightTokens;
}

/**
 * Active scheme as a string — handy for components that need to switch
 * Paper props (e.g. Searchbar `inputStyle`) by colour mode.
 */
export function useActiveScheme(): 'dark' | 'light' {
  const systemScheme = useColorScheme();
  const themeMode = useAppStore((s) => s.theme);
  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');
  return isDark ? 'dark' : 'light';
}
