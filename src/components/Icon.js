// Thin wrapper over Feather (monotone line icons) so the rest of the app has a
// single, consistent icon API and we never sprinkle emoji around.
//
//   <Icon name="settings" size={22} color={colors.text} />
//
// Browse names at https://feathericons.com — all monotone, all one stroke
// weight, which is exactly the look we want.

import React from 'react';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';

export default function Icon({ name, size = 22, color = colors.text, style }) {
  return <Feather name={name} size={size} color={color} style={style} />;
}
