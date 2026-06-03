// A standard sub-screen header: a "‹ Menu" back button on the left, a centered
// title, and a spacer keeping the title centered. Used by the Lexicon, Stats,
// and Custom screens (previously duplicated in each).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from './Icon';
import { colors } from '../theme';

export default function ScreenHeader({ title, onBack, backLabel = 'Menu' }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
        <Icon name="chevron-left" size={22} color={colors.text} />
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <Text style={styles.heading}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 72 },
  backText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  spacer: { width: 72 },
  heading: { fontSize: 18, fontWeight: '800', color: colors.text },
});
