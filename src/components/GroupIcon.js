// Icon for an iNaturalist taxon group, using MaterialCommunityIcons — which has
// real nature glyphs (leaf, mushroom, turtle, paw, bird, fish, bee, spider, …)
// that Feather lacks. Pair with theme.groupIcon(iconicTaxon) for the name.
//
//   <GroupIcon name={groupIcon('Plantae')} size={18} color={colors.primary} />

import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function GroupIcon({ name, size = 22, color = colors.text, style }) {
  return (
    <MaterialCommunityIcons name={name} size={size} color={color} style={style} />
  );
}
