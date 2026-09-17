// The card behind a film-strip photo: the same observation, bigger, with its
// name — and a way through to the full species page.
//
// A popup rather than a screen on purpose. Tapping a thumbnail is a glance
// ("which one was that?"), and a glance should not cost a navigation and a trip
// back. Everything here is reversible in one tap.
//
// Every way out is one people already reach for: the ✕, a tap anywhere outside
// the card, and the system back gesture on Android (onRequestClose) — the same
// three SupportModal offers, for the same reason.

import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Icon from './Icon';
import LoadingImage from './LoadingImage';
import { useColors, useThemedStyles } from '../theme';
import { formatAttribution } from '../api';

export default function ObservationPopup({ card, onClose, onMoreInfo }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  // The photo is big enough here to owe its photographer a name — the deck is
  // whoever's observations the app is pointed at, which is not necessarily the
  // person looking.
  const credit = card ? formatAttribution(card.attribution) : null;
  // Common name if there is one, scientific otherwise — and the scientific name
  // only repeats underneath when it is not already the title.
  const title = card ? card.common || card.scientific : '';
  const sub = card && card.common && card.scientific !== card.common ? card.scientific : null;

  return (
    <Modal
      visible={!!card}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="recent-popup"
    >
      <Pressable style={styles.backdrop} onPress={onClose} testID="recent-popup-backdrop">
        {/* Claims the touch so a press inside the card never reaches the
            backdrop's dismiss. A View, not a Pressable: there is nothing to
            press here, only something not to fall through. */}
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          {/* Keyed by the card so it REMOUNTS when a different thumbnail is
              tapped. LoadingImage tracks "loaded" in state: without this the
              flag stays true from the previous photo, so the new one arrives
              with no spinner and the old one is still on screen until it
              does — tap one frame, then another, and you briefly see the
              first again. */}
          <LoadingImage
            key={card ? card.id || card.taxonId : 'none'}
            source={card ? { uri: card.image } : null}
            style={styles.photo}
            resizeMode="cover"
          />

          <View style={[styles.body, !credit && styles.bodyLast]}>
            <View style={styles.names}>
              <Text style={styles.title} numberOfLines={2}>{title}</Text>
              {!!sub && <Text style={styles.sci} numberOfLines={1}>{sub}</Text>}
            </View>

            {/* Sits beside the name rather than under it: the name can run to
                two lines, and a button below would then move. */}
            <Pressable
              onPress={() => card && onMoreInfo && onMoreInfo(card)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="More about this species"
              testID="recent-popup-info"
              style={({ pressed }) => [styles.info, pressed && styles.infoPressed]}
            >
              <Icon name="info" size={24} color={colors.primary} />
            </Pressable>
          </View>

          {!!credit && (
            <Text style={styles.credit} numberOfLines={2}>{credit}</Text>
          )}

          {/* On the photo, which is why it carries a scrim — a bare glyph is
              invisible on a pale sky and lost in a dark one. */}
          <Pressable
            style={styles.close}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="recent-popup-close"
          >
            <Icon name="close" size={20} color="#FFFFFF" />
          </Pressable>
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
    // The photo runs to the card's edges, so the card clips it to the radius.
    overflow: 'hidden',
  },
  // Square: these are iNaturalist observation photos in every shape there is,
  // and a fixed aspect keeps the popup the same size whatever opens it.
  photo: { width: '100%', aspectRatio: 1, backgroundColor: colors.faint },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  // The credit normally closes the card; without one the name row has to.
  bodyLast: { paddingBottom: 16 },
  names: { flex: 1 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  sci: { fontSize: 13.5, color: colors.muted, fontStyle: 'italic', marginTop: 2 },
  info: { padding: 6 },
  infoPressed: { opacity: 0.5 },
  credit: {
    fontSize: 11,
    color: colors.muted,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 16,
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
