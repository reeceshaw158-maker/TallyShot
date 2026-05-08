/**
 * TallyShot theme system.
 *
 * Single source of truth for colour. Screens consume these via
 * `useThemeTokens()` rather than hardcoding hex values, so the app supports
 * dark and light without per-screen `if (isDark)` branches.
 *
 * Palette: Indigo × Amber.
 * Indigo is the dominant 2026 fintech accent (Revolut, Wise family).
 * Amber CTA keeps the warm, unmissable action contrast.
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
  background: '#0d1117',
  surface: '#1c2128',
  surfaceElevated: '#262d36',
  surfaceMuted: '#22282f',
  border: '#2d343d',

  textPrimary: '#f0f4f9',
  textMuted: '#a3acb8',
  textSubtle: '#6e7682',
  textInverse: '#0d1117',

  accent: '#818cf8',         // indigo-400
  cta: '#f5a623',            // amber gold
  ctaText: '#0d1117',

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
  background: '#fafaf7',
  surface: '#ffffff',
  surfaceElevated: '#f5f5f3',
  surfaceMuted: '#f0f0ed',
  border: '#e5e5e2',

  textPrimary: '#0a0a0a',
  textMuted: '#5a5a5a',
  textSubtle: '#8a8a8a',
  textInverse: '#ffffff',

  accent: '#4f46e5',         // indigo-600 (WCAG AA on white)
  cta: '#f5a623',
  ctaText: '#0a0a0a',

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
