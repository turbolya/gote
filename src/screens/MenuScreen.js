// Main menu: pick a game mode (or open Lexicon / Stats / Settings). Shown once a
// user's deck of observations has loaded.
//
// Design: "Minimal" — a flat header (name · account, with lifetime accuracy and a
// subtle recent-games sparkline), then sections as clean lists separated by
// hairline dividers, with mono accent-coloured icons (no tiles).

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import { useTheme, useThemedStyles } from '../theme';
import { SPEEDRUN_LIVES } from '../constants';

// Recent-accuracy sparkline geometry.
const BAR_W = 6;
const BAR_GAP = 3;

// A subtle chart of recent games' accuracy: one thin bar per game (oldest →
// newest, left → right). Only the newest bars that fit are shown.
function AccuracyBars({ data = [] }) {
  const [width, setWidth] = useState(0);
  const styles = useThemedStyles(makeStyles);
  if (!data.length) return null;
  const maxBars =
    width > 0 ? Math.max(1, Math.floor((width + BAR_GAP) / (BAR_W + BAR_GAP))) : 0;
  const bars = maxBars > 0 ? data.slice(-maxBars) : [];
  return (
    <View
      style={styles.chart}
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {bars.map((pct, i) => (
        <View key={i} style={[styles.bar, { height: `${Math.max(4, pct)}%` }]} />
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

  const playModes = [
    { key: 'all', icon: 'albums-outline', accent: accents.green, title: 'By name', sub: 'See a photo, choose its name' },
    { key: 'pick', icon: 'apps-outline', accent: accents.blue, title: 'By picture', sub: 'See a name, choose its photo' },
    { key: 'speedrun', icon: 'flash', accent: accents.amber, title: 'Speedrun', sub: `Endless cards — survive ${SPEEDRUN_LIVES} misses` },
    { key: 'nearby', icon: 'compass-outline', accent: accents.teal, title: 'Nearby species', sub: 'Learn species typical to a place' },
    { key: 'custom', icon: 'options-outline', accent: accents.violet, title: 'Custom game', sub: 'Choose how many cards and which groups' },
  ];

  // One flat row; rows in a group are separated by a hairline (first has none).
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>Gote</Text>
          <Text style={styles.account}>{username} · {deckCount} cards</Text>
        </View>
        {lifetimePct !== null && (
          <View style={styles.acc}>
            <Text style={styles.accNum}>{lifetimePct}%</Text>
            <Text style={styles.accLabel}>accuracy</Text>
          </View>
        )}
      </View>
      {history.length > 0 && <AccuracyBars data={history} />}

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
  container: { padding: 22, paddingTop: 28, paddingBottom: 44 },

  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: { fontSize: 38, fontWeight: '900', color: colors.text, letterSpacing: -0.6 },
  account: { fontSize: 14.5, color: colors.muted, marginTop: 3, fontWeight: '600' },
  acc: { alignItems: 'flex-end' },
  accNum: { fontSize: 30, fontWeight: '900', color: colors.primaryDark, lineHeight: 32 },
  accLabel: { fontSize: 11.5, color: colors.muted },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
    height: 34,
    marginTop: 14,
  },
  bar: { width: BAR_W, backgroundColor: 'rgba(92,138,27,0.28)', borderTopLeftRadius: 2, borderTopRightRadius: 2 },

  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 26,
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
