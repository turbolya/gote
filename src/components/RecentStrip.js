// The film strip at the top of the menu: the ten most recent observations in
// the deck, as photos under one line of fine print saying what the row is, and
// a last frame of three dots that opens the Lexicon newest first — the same
// list, carried on past where the strip stops.
//
// No names or dates on the frames. It is there to be recognised rather than read
// — you already know what you photographed last week — and a caption under each
// frame would both crowd a 96pt square and give away the answer to the game the
// rest of the menu is for. Tapping one opens the card that does name it
// (ObservationPopup).
//
// Horizontal scroll rather than a grid or a wrap, because the row is meant to
// read as "the latest few, most recent first" — an order, not a set.

import React from 'react';
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import { useColors, useThemedStyles } from '../theme';

// Matches the thumbnails elsewhere in the app (Lexicon rows, the detail strip):
// plain Image, no spinner. A spinner in a small square reads as noise, and the
// placeholder fill below is enough to stop the row jumping while photos land.
// The menu's side margin, which the strip bleeds into (see `strip` below).
const GUTTER = 20;

// A hex colour at zero alpha. The fade has to end in the page colour made
// transparent, not in 'transparent' — that is transparent BLACK, and a
// gradient into it goes grey on its way through the light theme.
const clear = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 'rgba(0,0,0,0)';
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},0)`;
};

export default function RecentStrip({ cards = [], onSelect, onMore }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  if (!cards.length) return null;

  return (
    <View style={styles.wrap}>
      {/* One line of fine print for the row as a whole — what it is, not what
          is in it. Lives here rather than on the menu so it goes when the
          strip does: a label over nothing is worse than no label. */}
      <Text style={styles.label} accessibilityRole="header" testID="recent-label">
        Recent observations
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}
        testID="recent-strip"
      >
        {cards.map((c) => (
          <Pressable
            key={c.id || c.taxonId}
            onPress={() => onSelect && onSelect(c)}
            testID={`recent-photo-${c.taxonId}`}
            accessibilityRole="imagebutton"
            // The photo carries no visible label, so it needs a spoken one — and
            // this is the one place a name is not a spoiler, since a screen
            // reader user is not being asked to identify it from the picture.
            accessibilityLabel={c.common || c.scientific || 'Recent observation'}
            style={({ pressed }) => [styles.frame, pressed && styles.framePressed]}
          >
            <Image source={{ uri: c.image }} style={styles.photo} resizeMode="cover" />
          </Pressable>
        ))}
        {/* Same size and shape as a photo, so it reads as the next frame on
            the roll rather than a button bolted on the end. */}
        {onMore && (
          <Pressable
            onPress={onMore}
            testID="recent-more"
            accessibilityRole="button"
            accessibilityLabel="All observations, most recent first"
            style={({ pressed }) => [styles.frame, styles.more, pressed && styles.framePressed]}
          >
            <Icon name="ellipsis-horizontal" size={28} color={colors.muted} />
          </Pressable>
        )}
      </ScrollView>
      {/* The row bleeds to the screen edges so a half-visible frame says
          "scrollable", but in the margins it read as spilling past the cards
          below it. So it fades into the page across each margin: solid page at
          the screen edge, fully clear by the card's edge. The left fade covers
          nothing until the row is scrolled — the first frame starts at the
          margin. Touches pass through, so the row still scrolls and every
          frame is still tappable underneath. */}
      <LinearGradient
        pointerEvents="none"
        colors={[colors.bg, clear(colors.bg)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fade, styles.fadeLeft]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[clear(colors.bg), colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fade, styles.fadeRight]}
      />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  // Negative margins let the row bleed to both screen edges while the menu's
  // own 20pt padding still positions the first frame — so a half-visible frame
  // at the right edge says "scrollable" without a scrollbar saying it.
  wrap: { marginTop: 14 },
  // The app's fine-print voice — the same small tracked capitals as the
  // tutorial's step counter — so it reads as a caption, not a section heading.
  // The menu dropped its section headings on purpose; this must not bring one
  // back.
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
  },
  strip: { marginHorizontal: -GUTTER },
  stripContent: { paddingHorizontal: GUTTER, gap: 10 },
  // Over the strip only (not the caption): the frames are 96pt tall and sit at
  // the bottom of `wrap`.
  fade: { position: 'absolute', bottom: 0, height: 96, width: GUTTER },
  fadeLeft: { left: -GUTTER },
  fadeRight: { right: -GUTTER },
  frame: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    // Shows through until the photo lands, so the row has its full height from
    // the first frame and the menu below it never jumps.
    backgroundColor: colors.faint,
  },
  framePressed: { opacity: 0.65 },
  more: { alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
});
