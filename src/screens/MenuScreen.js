// Main menu: pick a game mode (or open Lexicon / Stats / Settings). Shown once a
// user's deck of observations has loaded.
//
// Design: a green gradient hero card up top (account + lifetime accuracy, with a
// background chart of recent games' accuracy), then clean minimal sections —
// flat lists with hairline dividers and accent-coloured icons.

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { useTheme, useThemedStyles } from '../theme';
import { SPEEDRUN_LIVES } from '../constants';

// The hero gradient is the brand green in both themes (white text reads well on
// it either way), so it's intentionally not theme-dependent.
const HERO_GRADIENT = ['#5C8A1B', '#3F6212'];

// Background accuracy-chart geometry.
const BAR_W = 7;
const BAR_GAP = 4;

// A subtle chart of recent games' accuracy behind the hero: one vertical bar per
// game (oldest → newest, left → right), each a white gradient (more opaque on
// top, fading down). Only the newest bars that fit show. `topOffset` caps the
// bars' top edge just below the title/username block.
function AccuracyBars({ data = [], topOffset = 0 }) {
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  if (!data.length) return null;
  const maxBars =
    width > 0 ? Math.max(1, Math.floor((width + BAR_GAP) / (BAR_W + BAR_GAP))) : 0;
  const bars = maxBars > 0 ? data.slice(-maxBars) : [];
  return (
    <View
      style={[styles.chart, { top: topOffset }]}
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {bars.map((pct, i) => (
        <LinearGradient
          key={i}
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.2)']}
          style={[styles.bar, { height: `${Math.max(3, pct)}%` }]}
        />
      ))}
    </View>
  );
}

export default function MenuScreen({
  username,
  deckCount,
  lifetime,
  history = [],
  onSelectMode,
  onLexicon,
  onStats,
  onSettings,
}) {
  const { colors, accents } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const lifetimePct =
    lifetime && lifetime.answered > 0
      ? Math.round((lifetime.correct / lifetime.answered) * 100)
      : null;

  // Where a 100% bar should top out: just below the title/username block.
  const [barsTop, setBarsTop] = useState(0);

  const playModes = [
    { key: 'all', icon: 'albums-outline', accent: accents.green, title: 'By name', sub: 'See a photo, choose its name' },
    { key: 'pick', icon: 'apps-outline', accent: accents.blue, title: 'By picture', sub: 'See a name, choose its photo' },
    { key: 'speedrun', icon: 'flash', accent: accents.amber, title: 'Speedrun', sub: `Endless cards — survive ${SPEEDRUN_LIVES} misses` },
    { key: 'nearby', icon: 'compass-outline', accent: accents.teal, title: 'Nearby species', sub: 'Learn species typical to a place' },
    { key: 'custom', icon: 'options-outline', accent: accents.violet, title: 'Custom game', sub: 'Choose how many cards and which groups' },
  ];

  const Row = ({ icon, accent, title, sub, onPress, testID, first }) => (
    <Pressable
      testID={testID}
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <Icon name={icon} size={24} color={accent.fg} style={styles.rowIcon} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <ScrollView
      testID="menu-scroll"
      style={styles.flex}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero card */}
      <LinearGradient
        colors={HERO_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Background: a faint chart of recent games' accuracy. */}
        <AccuracyBars data={history} topOffset={barsTop} />

        <View
          style={styles.heroTop}
          onLayout={(e) =>
            setBarsTop(e.nativeEvent.layout.y + e.nativeEvent.layout.height + 4)
          }
        >
          <View style={styles.flex}>
            <Text style={styles.heroTitle}>Gote</Text>
            <Text style={styles.heroSub}>
              {username} · {deckCount} cards
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <Icon name="feather" size={22} color={colors.onDark} />
          </View>
        </View>

        {lifetimePct !== null && (
          <View style={styles.statPill}>
            <Icon name="bar-chart-2" size={15} color={colors.onDark} />
            <Text style={styles.statPillText}>
              {lifetimePct}% lifetime accuracy · {lifetime.correct}/
              {lifetime.answered}
            </Text>
          </View>
        )}
      </LinearGradient>

      <Text style={styles.section}>Play</Text>
      <View style={styles.group}>
        {playModes.map(({ key, ...rest }, i) => (
          <Row key={key} {...rest} first={i === 0} testID={`mode-${key}`} onPress={() => onSelectMode(key)} />
        ))}
      </View>

      <Text style={styles.section}>Learn</Text>
      <View style={styles.group}>
        <Row first testID="mode-flash" icon="documents-outline" accent={accents.indigo} title="Flash cards" sub="Reveal the answer, then grade yourself" onPress={() => onSelectMode('flash')} />
        <Row testID="open-lexicon" icon="library-outline" accent={accents.teal} title="Lexicon" sub="Browse all your species" onPress={onLexicon} />
      </View>

      <Text style={styles.section}>Settings</Text>
      <View style={styles.group}>
        <Row first testID="open-stats" icon="stats-chart-outline" accent={accents.rose} title="Statistics" sub="Accuracy, best-known and most-missed" onPress={onStats} />
        <Row testID="open-settings" icon="settings-outline" accent={accents.slate} title="Settings" sub="Account, language and study options" onPress={onSettings} />
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingTop: 24, paddingBottom: 44 },

  // Hero card
  hero: {
    borderRadius: 26,
    padding: 22,
    marginBottom: 22,
    overflow: 'hidden', // clip the background bars to the rounded card
  },
  chart: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  bar: { width: BAR_W, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroTitle: { fontSize: 36, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' },
  heroBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  statPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Minimal sections
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 4,
    marginLeft: 2,
  },
  group: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 15 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { opacity: 0.5 },
  rowIcon: { width: 28, textAlign: 'center' },
  rowTitle: { fontSize: 16.5, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 1 },
});
