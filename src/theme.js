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

// Monotone Feather icon name for an iNaturalist "iconic taxon". Feather has no
// per-species glyphs, so these are tasteful stand-ins from the same line set —
// keeping everything visually consistent and uncolored.
export function groupIcon(iconic) {
  switch (iconic) {
    case 'Plantae': return 'feather';
    case 'Aves': return 'twitter';        // bird silhouette
    case 'Insecta': return 'git-commit';  // segmented body
    case 'Arachnida': return 'git-merge';
    case 'Fungi': return 'umbrella';      // cap shape
    case 'Mollusca': return 'disc';
    case 'Actinopterygii': return 'navigation'; // fish-ish dart
    case 'Mammalia':
    case 'Reptilia':
    case 'Amphibia':
    case 'Animalia': return 'crosshair';
    case 'Chromista':
    case 'Protozoa': return 'aperture';
    default: return 'help-circle';
  }
}
