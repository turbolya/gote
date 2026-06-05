// Icon for an iNaturalist taxon group. Most glyphs come from
// MaterialCommunityIcons (leaf, mushroom, turtle, paw, bird, fish, bee, spider,
// …), but a few live in another family — e.g. the frog (amphibians) is only in
// FontAwesome5. theme.groupIcon() returns either a plain MCI name string or a
// descriptor { lib, name, solid? }; we render the right family here.
//
//   <GroupIcon name={groupIcon('Amphibia')} size={18} color={colors.primary} />

import React from 'react';
import { MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../theme';

export default function GroupIcon({ name, size = 22, color = colors.text, style }) {
  // A bare string means MaterialCommunityIcons; an object selects another family.
  const desc = typeof name === 'string' ? { lib: 'mci', name } : name || {};

  if (desc.lib === 'fa5') {
    return (
      <FontAwesome5
        name={desc.name}
        size={size}
        color={color}
        style={style}
        solid={!!desc.solid}
      />
    );
  }

  return (
    <MaterialCommunityIcons name={desc.name} size={size} color={color} style={style} />
  );
}
