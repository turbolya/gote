// A quiet "you're offline" strip. Shown at the top of the menu when the device
// has no connection, so the disabled Nearby / update affordances have context.
// Amber (a caution, not an error) — nothing is broken, some features just wait.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from './Icon';
import { useTheme, useThemedStyles } from '../theme';

export default function OfflineBanner({ style, message }) {
  const { accents } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.bar, style]}>
      <Icon name="cloud-offline-outline" size={15} color={accents.amber.fg} />
      <Text style={styles.text}>
        {message || 'You’re offline — modes that need a connection are paused.'}
      </Text>
    </View>
  );
}

const makeStyles = (colors, accents) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: accents.amber.bg,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: 16,
    },
    text: {
      flex: 1,
      color: accents.amber.fg,
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 18,
    },
  });
