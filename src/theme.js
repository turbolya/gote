// Shared colors and small helpers used across the app.
//
// Design language: clean, modern, near-monotone. A single restrained green
// accent over neutral grays; no colorful icons or emoji (we use Feather line
// icons via src/components/Icon.js instead).

export const colors = {
  primary: '#5C8A1B',      // muted iNaturalist green (accent)
  primaryDark: '#3F6212',
  accent: '#3B82F6',
  bg: '#FAFAF8',           // soft off-white
  card: '#FFFFFF',
  text: '#1A1D1A',         // near-black
  muted: '#8A8F86',        // neutral gray for secondary text
  faint: '#F0F1ED',        // subtle fills / pressed states
  correct: '#3F9D52',
  wrong: '#D9534F',
  border: '#E7E8E3',
  shadow: '#000000',
  onDark: '#FFFFFF',       // text/icons over photo backdrops
};

// Soft tinted accents for icon tiles (a saturated foreground glyph on a pale
// fill). Gives the menu and settings rows a modern, lively-but-restrained feel
// without resorting to colorful icons everywhere. `bg` = tile fill, `fg` = glyph.
export const accents = {
  green: { fg: '#3F6212', bg: '#E9F1DB' },
  blue: { fg: '#1D4ED8', bg: '#E2EAFF' },
  violet: { fg: '#6D28D9', bg: '#EEE7FE' },
  amber: { fg: '#B45309', bg: '#FBEFD5' },
  teal: { fg: '#0F766E', bg: '#D8F0ED' },
  indigo: { fg: '#4338CA', bg: '#E6E7FB' },
  rose: { fg: '#BE123C', bg: '#FCE3E9' },
  slate: { fg: '#475569', bg: '#EEF1F5' },
};

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

// Icon name for an iNaturalist "iconic taxon". These are MaterialCommunityIcons
// glyph names (real nature icons), rendered via <GroupIcon> — NOT Feather. A few
// groups lack a dedicated glyph (amphibians, algae), so they reuse the nearest
// sensible one.
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
    case 'Amphibia': return 'turtle';     // no frog glyph; turtle is closest
    case 'Animalia': return 'paw';
    case 'Chromista': return 'waves';     // algae & kin — no dedicated glyph
    case 'Protozoa': return 'bacteria';
    default: return 'help-circle';
  }
}
