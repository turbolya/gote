// A gentle support popup shown on a small fraction of launches: invites an
// App Store rating and offers a "Buy me a coffee" (Ko-fi) donation.
//
// Both links are placeholders until the App Store listing / Ko-fi account exist
// (see src/constants.js + TASKS.md); when a link isn't set yet, we explain that
// rather than open a dead URL.

import React from 'react';
import { Modal, View, Text, Pressable, Linking, Alert, StyleSheet } from 'react-native';
import Icon from './Icon';
import { colors } from '../theme';
import { KOFI_URL, APP_STORE_REVIEW_URL } from '../constants';

async function openUrl(url, comingSoonMsg) {
  if (!url) {
    Alert.alert('Coming soon', comingSoonMsg);
    return;
  }
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else throw new Error('cannot open');
  } catch {
    Alert.alert('Couldn’t open the link', url);
  }
}

export default function SupportModal({ visible, onClose }) {
  const rate = () => {
    onClose();
    openUrl(
      APP_STORE_REVIEW_URL,
      'You’ll be able to rate Gote once it’s live on the App Store. Thanks for the support!'
    );
  };
  const donate = () => {
    onClose();
    openUrl(KOFI_URL, 'The donation page isn’t set up yet — thank you, though!');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.logo}>
            <Icon name="feather" size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>Enjoying Gote?</Text>
          <Text style={styles.body}>
            If it’s helping you learn species, a quick rating means a lot — and
            keeps Gote free for everyone.
          </Text>

          <View style={styles.stars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Pressable key={i} onPress={rate} hitSlop={6} testID={`support-star-${i}`}>
                <Icon name="star" size={34} color="#F5B301" style={styles.star} />
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.kofi} onPress={donate} testID="support-kofi">
            <Icon name="cafe-outline" size={18} color={colors.onDark} />
            <Text style={styles.kofiText}>Buy me a coffee</Text>
          </Pressable>

          <Pressable style={styles.later} onPress={onClose} testID="support-later">
            <Text style={styles.laterText}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 999,
    backgroundColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 21, fontWeight: '900', color: colors.text, marginTop: 14 },
  body: {
    fontSize: 14.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  stars: { flexDirection: 'row', gap: 6, marginTop: 18, marginBottom: 4 },
  star: {},
  kofi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    width: '100%',
    marginTop: 18,
  },
  kofiText: { color: colors.onDark, fontSize: 16, fontWeight: '800' },
  later: { paddingVertical: 12, marginTop: 4 },
  laterText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
});
