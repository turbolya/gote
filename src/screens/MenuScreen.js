// Main menu: pick a game mode (or open Lexicon / Stats / Settings). Shown once a
// user's deck of observations has loaded.
//
// Design: a gradient hero with the account + lifetime accuracy, then game modes
// as cards — each with its own softly-tinted icon tile (Ionicons) for a modern,
// lively-but-restrained look.

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { colors, accents } from '../theme';
import { SPEEDRUN_LIVES } from '../constants';

export default function MenuScreen({
  username,
  deckCount,
  lifetime,
  onSelectMode,
  onLexicon,
  onStats,
  onSettings,
}) {
  const lifetimePct =
    lifetime && lifetime.answered > 0
      ? Math.round((lifetime.correct / lifetime.answered) * 100)
      : null;

  // Each mode carries an Ionicons glyph and its own accent so the list reads as
  // a set of distinct activities rather than one monotone column.
  const modes = [
    {
      key: 'all',
      icon: 'albums-outline',
      accent: accents.green,
      title: 'All cards',
      sub: `Quiz on all ${deckCount} species`,
    },
    {
      key: 'pick',
      icon: 'apps-outline',
      accent: accents.blue,
      title: 'Pick the right one',
      sub: 'Match the name to the right photo',
    },
    {
      key: 'custom',
      icon: 'options-outline',
      accent: accents.violet,
      title: 'Custom game',
      sub: 'Choose how many cards and which groups',
    },
    {
      key: 'speedrun',
      icon: 'flash',
      accent: accents.amber,
      title: 'Speedrun',
      sub: `Endless cards — survive ${SPEEDRUN_LIVES} misses`,
    },
    {
      key: 'nearby',
      icon: 'compass-outline',
      accent: accents.teal,
      title: 'Nearby species',
      sub: 'Learn species typical to a place',
    },
  ];

  const Row = ({ icon, accent, title, sub, onPress }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={[styles.iconTile, { backgroundColor: accent.bg }]}>
        <Icon name={icon} size={24} color={accent.fg} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
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
      {modes.map((m) => (
        <Row key={m.key} {...m} onPress={() => onSelectMode(m.key)} />
      ))}

      <Text style={styles.section}>Explore</Text>
      <Row
        icon="library-outline"
        accent={accents.indigo}
        title="Lexicon"
        sub="Browse all your species"
        onPress={onLexicon}
      />
      <Row
        icon="stats-chart-outline"
        accent={accents.rose}
        title="Statistics"
        sub="Accuracy, best-known and most-missed"
        onPress={onStats}
      />
      <Row
        icon="settings-outline"
        accent={accents.slate}
        title="Settings"
        sub="Account, language and study options"
        onPress={onSettings}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingTop: 24, paddingBottom: 40 },

  hero: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 24,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.onDark,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
    fontWeight: '600',
  },
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
  statPillText: { color: colors.onDark, fontSize: 13, fontWeight: '700' },

  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.faint, transform: [{ scale: 0.985 }] },
  iconTile: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 13.5, color: colors.muted, marginTop: 2 },
});
