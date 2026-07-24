// Shared colors, theming (light / dark / follow-system) and small helpers.
//
// Components read the ACTIVE palette via `useTheme()` (or `useColors()`), and
// build their StyleSheets from it with a `makeStyles(colors[, accents])` factory
// so they re-style when the theme changes. The static `colors` / `accents`
// exports remain (light) as a fallback for any non-themed use.

import { createContext, useContext, useMemo } from 'react';

// Colour choices are contrast-checked against WCAG AA — see scripts/test-contrast.js,
// which fails the build if any pairing regresses. Text needs 4.5:1 (3:1 when it's
// ≥18px, or ≥14px bold); icons and other non-text UI need 3:1.
export const lightColors = {
  primary: '#008AAC', // brand teal
  primaryDark: '#036178',
  accent: '#3B82F6',
  bg: '#FAFAF8', // soft off-white
  card: '#FFFFFF',
  text: '#1A1D1A', // near-black
  // Secondary text. Darkened from #8A8F86, which only reached 2.9:1 on `faint`
  // and failed AA everywhere it was used (subtitles, hints, captions).
  muted: '#667063',
  faint: '#F0F1ED', // subtle fills / pressed states
  // Also used for the small bold tallies on Statistics, so these clear 4.5:1
  // rather than only the 3:1 that the bars alone would need.
  correct: '#2F7A3E',
  wrong: '#C4403C',
  border: '#E7E8E3',
  shadow: '#000000',
  onDark: '#FFFFFF', // text/icons over photo backdrops
  // Label on a `primary` fill. White on the light teal is 4.01:1 — fine for the
  // large bold button text it's used for, short of AA for anything smaller.
  onPrimary: '#FFFFFF',
  // "Flagged" amber. The bright #E0A800 sits at 2.1:1 on light — invisible by
  // the 3:1 non-text bar — so light mode gets a deeper gold.
  flag: '#9A7000',
  // Flag shown OVER a photo (paired with `onDark`). Photos are dark backdrops
  // in both themes, so this stays the bright amber regardless of scheme.
  flagOnDark: '#E0A800',
};

export const darkColors = {
  primary: '#34C2E0', // brighter teal so it reads on dark
  primaryDark: '#82D9EA', // used as an accent/heading colour on dark
  accent: '#7CA2F0',
  bg: '#121412',
  card: '#1C1F1B',
  text: '#ECEEEA',
  muted: '#9AA096',
  faint: '#262A23', // subtle fills / pressed states
  correct: '#5BBE6A',
  wrong: '#E5736F',
  border: '#30342C',
  shadow: '#000000',
  onDark: '#FFFFFF', // photos are dark backdrops in both themes
  // The dark palette's `primary` is a bright cyan, so a white label on it is
  // only 2.1:1 — worse than light mode. A near-black label gives 8.8:1.
  onPrimary: '#12140F',
  flag: '#E0A800', // reads well on dark (8.6:1); light mode uses a deeper gold
  flagOnDark: '#E0A800', // over photos — same in both schemes
};

// Tinted accents. With the Minimal design these are mainly used as `fg` (the
// icon colour); `bg` is kept for any tinted-tile use. Dark variants brighten the
// foregrounds so icons stay legible on dark surfaces.
export const accentsLight = {
  green: { fg: '#3F6212', bg: '#E9F1DB' },
  blue: { fg: '#1D4ED8', bg: '#E2EAFF' },
  violet: { fg: '#6D28D9', bg: '#EEE7FE' },
  amber: { fg: '#B45309', bg: '#FBEFD5' },
  teal: { fg: '#0F766E', bg: '#D8F0ED' },
  indigo: { fg: '#4338CA', bg: '#E6E7FB' },
  rose: { fg: '#BE123C', bg: '#FCE3E9' },
  slate: { fg: '#475569', bg: '#EEF1F5' },
};

export const accentsDark = {
  green: { fg: '#9CCC5A', bg: '#26321A' },
  blue: { fg: '#8FB0F4', bg: '#1B2440' },
  violet: { fg: '#B79BF2', bg: '#271F40' },
  amber: { fg: '#E0A23C', bg: '#332514' },
  teal: { fg: '#56C3BB', bg: '#16302D' },
  indigo: { fg: '#9AA0F0', bg: '#222448' },
  rose: { fg: '#E78AA0', bg: '#3A1C26' },
  slate: { fg: '#9FB0C2', bg: '#22272E' },
};

// Light is the default/fallback for any static import.
export const colors = lightColors;
export const accents = accentsLight;

// The three user-selectable theme modes.
export const THEME_MODES = ['light', 'dark', 'system'];

// Resolve a mode + the OS scheme into a concrete 'light' | 'dark' scheme.
export function resolveScheme(mode, systemScheme) {
  if (mode === 'light' || mode === 'dark') return mode;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

// Full theme object for a given scheme.
export function themeFor(scheme) {
  return scheme === 'dark'
    ? { scheme: 'dark', colors: darkColors, accents: accentsDark }
    : { scheme: 'light', colors: lightColors, accents: accentsLight };
}

const ThemeContext = createContext(themeFor('light'));
export const ThemeProvider = ThemeContext.Provider;

export function useTheme() {
  return useContext(ThemeContext);
}
export function useColors() {
  return useContext(ThemeContext).colors;
}
export function useAccents() {
  return useContext(ThemeContext).accents;
}

// Build a StyleSheet from the active palette, memoized per theme. Usage:
//   const makeStyles = (colors, accents) => StyleSheet.create({ ... });
//   const styles = useThemedStyles(makeStyles);
export function useThemedStyles(factory) {
  const { colors: c, accents: a } = useContext(ThemeContext);
  return useMemo(() => factory(c, a), [factory, c, a]);
}

// Friendly group names for iNaturalist "iconic taxa" — used by the custom-game
// filter. (iNat groups everything into these broad categories; finer splits
// like "flowers vs trees" aren't available from the basic observation data.)
export const GROUP_LABELS = {
  Plantae: 'Plants',
  Animalia: 'Other animals',
  Aves: 'Birds',
  Reptilia: 'Reptiles',
  Amphibia: 'Amphibians',
  Actinopterygii: 'Fish',
  Mammalia: 'Mammals',
  Insecta: 'Insects',
  Arachnida: 'Arachnids',
  Mollusca: 'Mollusks',
  Fungi: 'Fungi',
  Chromista: 'Algae & kin',
  Protozoa: 'Protozoans',
};

// Normalize a card's iconic taxon into a stable group key (never null).
export function groupKey(iconic) {
  return iconic || 'Other';
}

export function groupLabel(key) {
  return GROUP_LABELS[key] || 'Other';
}

// Icon for an iNaturalist "iconic taxon", rendered via <GroupIcon> — NOT Feather.
// Most are MaterialCommunityIcons glyph names (returned as plain strings); a few
// come from another family and are returned as a descriptor object
// { lib, name, solid? } (e.g. the frog lives in FontAwesome5, not MCI). Groups
// with no dedicated glyph anywhere reuse the nearest sensible one.
export function groupIcon(iconic) {
  switch (iconic) {
    case 'Plantae': return 'leaf';
    case 'Aves': return 'bird';
    case 'Insecta': return 'bee';
    case 'Arachnida': return 'spider';
    case 'Fungi': return 'mushroom';
    case 'Mollusca': return 'snail';
    case 'Actinopterygii': return 'fish';
    case 'Mammalia': return 'paw';
    case 'Reptilia': return 'turtle';
    case 'Amphibia': return { lib: 'fa5', name: 'frog', solid: true };
    case 'Animalia': return 'paw';
    case 'Chromista': return 'waves';     // algae & kin — no dedicated glyph
    case 'Protozoa': return 'bacteria';
    default: return 'help-circle';
  }
}
