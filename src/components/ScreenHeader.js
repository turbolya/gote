// A standard sub-screen header: a rounded back button on the left, a centered
// title, and a spacer keeping the title centered. Used by the Lexicon, Stats,
// Custom and Nearby screens (previously duplicated in each).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from './Icon';
import { useColors, useThemedStyles } from '../theme';

// `backTestID` exists because some of these headers sit on an OVERLAY over a
// screen that has its own header — the compare page over Statistics, say — and
// two 'screen-back' buttons in one hierarchy are one ambiguous match, which a
// test cannot tap and a screen reader cannot tell apart either.
export default function ScreenHeader({ title, onBack, backTestID = 'screen-back' }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.topBar}>
      <Pressable
        testID={backTestID}
        onPress={onBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      >
        <Icon name="chevron-left" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.heading}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
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
