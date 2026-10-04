/**
 * TallyShot theme system.
 *
 * Single source of truth for colour. Screens consume these via
 * `useThemeTokens()` rather than hardcoding hex values, so the app supports
 * dark and light without per-screen `if (isDark)` branches.
 *
 * Palette: one teal accent (#00C896) on near-black, matching the brief in
 * docs/tallyshot-memory/PROJECT.md and the promo reel. Amber survives only
 * as the semantic warning colour, never as brand.
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
  cta: string;               // teal — primary action button
  ctaText: string;           // text colour on the CTA

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
  background: '#06080A',
  surface: '#111819',
  surfaceElevated: '#1B2425',
  surfaceMuted: '#0C1112',
  border: 'rgba(255,255,255,0.1)',

  textPrimary: '#F2F5F4',
  textMuted: '#A1ABA8',
  textSubtle: '#6E7A77',
  textInverse: '#03140E',

  accent: '#00C896',         // teal — TallyShot brand
  cta: '#00C896',            // teal — TallyShot brand
  ctaText: '#03140E',

  success: '#34c759',
  successBg: 'rgba(52,199,89,0.14)',
  warning: '#f59e0b',
  warningBg: 'rgba(245,158,11,0.14)',
  danger: '#ff3b30',
  dangerBg: 'rgba(255,59,48,0.14)',

  needsReview: '#f59e0b',
  needsReviewBg: 'rgba(245,158,11,0.14)',
  deductible: '#34c759',
  deductibleBg: 'rgba(52,199,89,0.14)',
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

  accent: '#00866A',         // deep teal (4.5:1 on white, WCAG AA)
  cta: '#00C896',
  ctaText: '#03140E',

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
