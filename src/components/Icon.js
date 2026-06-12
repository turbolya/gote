// App-wide UI icon, rendered with Ionicons — a modern, rounded, iOS-native icon
// set that reads far better than the old hairline Feather glyphs. The rest of
// the app still calls icons by their familiar Feather-style names; we translate
// each to its Ionicons equivalent here so a single swap modernizes every screen
// at once (and no call site needs to change).
//
//   <Icon name="settings" size={22} color={colors.text} />
//
// Nature/taxon glyphs (leaf, mushroom, turtle, …) live in <GroupIcon> instead,
// which uses MaterialCommunityIcons. Browse Ionicons at https://ionic.io/ionicons.

import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../theme';

// Feather name (used throughout the app) → Ionicons name.
const MAP = {
  'alert-triangle': 'warning-outline',
  'arrow-right': 'arrow-forward',
  'bar-chart-2': 'stats-chart-outline',
  'book-open': 'book-outline',
  check: 'checkmark',
  'chevron-down': 'chevron-down',
  'chevron-left': 'chevron-back',
  'chevron-right': 'chevron-forward',
  'external-link': 'open-outline',
  feather: 'leaf-outline',
  'file-text': 'document-text-outline',
  github: 'logo-github',
  grid: 'grid-outline',
  heart: 'heart',
  image: 'image-outline',
  info: 'information-circle-outline',
  mail: 'mail-outline',
  'map-pin': 'location-outline',
  'maximize-2': 'expand-outline',
  minus: 'remove',
  navigation: 'navigate-outline',
  plus: 'add',
  'refresh-cw': 'refresh',
  'rotate-ccw': 'reload-outline',
  search: 'search-outline',
  settings: 'settings-outline',
  star: 'star',
  x: 'close',
  zap: 'flash-outline',
  // Names used via variables/ternaries elsewhere (results grades, answer marks).
  'check-circle': 'checkmark-circle',
  'x-circle': 'close-circle',
  award: 'trophy',
  target: 'flag',
  // Ionicons has no plain "circle" — map Feather's to the outline ellipse
  // (otherwise it renders as a missing-glyph "?" box).
  circle: 'ellipse-outline',
};

export default function Icon({ name, size = 22, color, style }) {
  const colors = useColors();
  // Allow passing an Ionicons name straight through (anything not in the map).
  const ion = MAP[name] || name;
  return <Ionicons name={ion} size={size} color={color ?? colors.text} style={style} />;
}
