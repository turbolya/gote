// A gentle support popup shown on a small fraction of launches: invites an
// App Store review and offers a "Buy me a coffee" (Ko-fi) donation.
//
// Kept small on purpose, in what it says and in what it puts on screen. It
// interrupts someone who came to play, so it gets one sentence, one line of
// small print about the money, and no furniture: the two things it asks for are
// links inside that sentence rather than a row of stars and a filled button,
// which between them took more room than the message and read as a demand.
//
// Every way out is one people reach for: the ✕, a tap anywhere outside the
// card, and the system back gesture on Android (onRequestClose). A popup nobody
// asked for should be trivially dismissable.
//
// Links are configured in src/constants.js; when one isn't set yet (e.g. the
// App Store listing), we explain that rather than open a dead URL.

import React from 'react';
import { Modal, View, Text, Pressable, Image, Linking, Alert, StyleSheet } from 'react-native';
import Icon from './Icon';
import { useColors, useThemedStyles } from '../theme';
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const rate = () => {
    onClose();
    openUrl(
      APP_STORE_REVIEW_URL,
      'You’ll be able to rate gote once it’s live on the App Store. Thanks for the support!'
    );
  };
  const donate = () => {
    onClose();
    openUrl(KOFI_URL, 'The donation page isn’t set up yet — thank you, though!');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Tapping the dim closes it — the first thing anyone tries on a popup. */}
      <Pressable style={styles.backdrop} onPress={onClose} testID="support-backdrop">
        {/* Claims the touch so a press inside the card never reaches the
            backdrop's dismiss. A View rather than a Pressable: there is nothing
            to press here, only something not to fall through. */}
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Pressable
            style={styles.close}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="support-close"
          >
            <Icon name="close" size={20} color={colors.muted} />
          </Pressable>

          <View style={styles.titleRow}>
            <Image
              source={require('../../assets/gote.png')}
              style={styles.titleNewt}
              resizeMode="contain"
            />
            <Text style={styles.title}>
              Enjoying <Text style={styles.titleBrand}>gote</Text>?
            </Text>
          </View>

          {/* The two asks ARE the two words. Nested Text keeps them inside the
              sentence, so this reads as a line of prose rather than as a form
              with buttons to get past. */}
          <Text style={styles.body}>
            Consider leaving a{' '}
            <Text
              style={styles.link}
              onPress={rate}
              accessibilityRole="link"
              testID="support-review"
            >
              review
            </Text>
            , or buying me a{' '}
            <Text
              style={styles.link}
              onPress={donate}
              accessibilityRole="link"
              testID="support-kofi"
            >
              coffee
            </Text>
            .
          </Text>

          <Text style={styles.kofiNote}>
            gote is free, but developing it costs money. A small donation helps
            it keep growing.
          </Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors) => StyleSheet.create({
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
    paddingTop: 30, // room for the ✕ sitting above the title
    alignItems: 'center',
  },
  // Header: the teal-tinted newt mark in front of the title (gote.png is a
  // white silhouette, recoloured to the brand teal via tintColor).
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleNewt: { width: 34, height: 34, tintColor: colors.primary },
  title: { fontSize: 21, fontWeight: '900', color: colors.text },
  // Fredoka renders smaller than the system face at the same point size, so the
  // wordmark is bumped up to read level with "Enjoying"; teal to match the brand.
  titleBrand: { fontFamily: 'Fredoka', fontSize: 25, color: colors.primary },
  body: {
    fontSize: 14.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 18,
  },
  // The asks, inside the sentence. Underlined as well as coloured: colour alone
  // is not a link to someone who cannot see it as a colour.
  link: {
    color: colors.primary,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  kofiNote: {
    fontSize: 11.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  // Top-right, clear of the title row, which is centred and short enough not to
  // reach it.
  close: { position: 'absolute', top: 10, right: 10, padding: 8 },
});
