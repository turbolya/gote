// "Did you know?" notice promoting the Apple Watch companion. iPhone-only: the
// watch pairs only with an iPhone, so this is hidden on iPad and Android (it
// self-gates, so callers can render it unconditionally).
//
// Two uses:
//   • Main menu — dismissible (pass onDismiss); a persisted flag keeps it hidden
//     once the user taps the ✕.
//   • Settings — always shown (omit onDismiss), so the tip is always
//     rediscoverable there even after it's been dismissed on the menu.

import React from 'react';
import { View, Text, Pressable, Platform, StyleSheet } from 'react-native';
import Icon from './Icon';
import { useTheme, useThemedStyles } from '../theme';
import { animateNextLayout } from './anim';

// The Apple Watch companion only pairs with an iPhone.
const IS_IPHONE = Platform.OS === 'ios' && !Platform.isPad;

export default function WatchTip({ dismissed = false, onDismiss }) {
  const { colors, accents } = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (!IS_IPHONE || dismissed) return null;

  return (
    <View style={styles.card} testID="watch-tip">
      <Icon name="watch-outline" size={26} color={colors.primary} style={styles.icon} />
      <View style={styles.body}>
        <Text style={styles.title}>Did you know?</Text>
        <Text style={styles.text}>
          gote has an Apple Watch app — play a quick photo quiz on your wrist,
          and add lifetime-accuracy and streak complications to your watch face.
        </Text>
      </View>
      {onDismiss && (
        <Pressable
          testID="watch-tip-dismiss"
          onPress={() => {
            animateNextLayout();
            onDismiss();
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Hide this tip"
          style={styles.close}
        >
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.faint,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  icon: { width: 28, textAlign: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  text: { fontSize: 13.5, lineHeight: 19, color: colors.text },
  // The ✕ sits top-right so the (multi-line) body reads full-width beside it.
  close: { alignSelf: 'flex-start', padding: 2, marginTop: -2, marginRight: -4 },
});
