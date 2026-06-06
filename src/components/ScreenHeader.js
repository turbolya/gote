// A standard sub-screen header: a rounded back button on the left, a centered
// title, and a spacer keeping the title centered. Used by the Lexicon, Stats,
// Custom and Nearby screens (previously duplicated in each).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from './Icon';
import { colors } from '../theme';

export default function ScreenHeader({ title, onBack }) {
  return (
    <View style={styles.topBar}>
      <Pressable
        testID="screen-back"
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <Icon name="chevron-left" size={22} color={colors.text} />
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: { opacity: 0.6 },
  spacer: { width: 40 },
  heading: { fontSize: 18, fontWeight: '800', color: colors.text },
});
