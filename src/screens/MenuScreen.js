// Main menu: pick a game mode (or open settings). Shown once a user's deck of
// observations has loaded.

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import { colors } from '../theme';
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

  const modes = [
    {
      key: 'all',
      icon: 'layers',
      title: 'All cards',
      sub: `Quiz on all ${deckCount} species`,
    },
    {
      key: 'pick',
      icon: 'grid',
      title: 'Pick the right one',
      sub: 'Match the name to the right photo',
    },
    {
      key: 'custom',
      icon: 'sliders',
      title: 'Custom game',
      sub: 'Choose how many cards and which groups',
    },
    {
      key: 'speedrun',
      icon: 'trending-up',
      title: 'Speedrun',
      sub: `Endless cards — survive ${SPEEDRUN_LIVES} misses`,
    },
  ];

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.title}>Gote</Text>
          <Text style={styles.subtitle}>
            {username} · {deckCount} cards
          </Text>
        </View>
      </View>

      {modes.map((m) => (
        <Pressable
          key={m.key}
          style={styles.modeCard}
          onPress={() => onSelectMode(m.key)}
        >
          <View style={styles.modeIcon}>
            <Icon name={m.icon} size={22} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.modeTitle}>{m.title}</Text>
            <Text style={styles.modeSub}>{m.sub}</Text>
          </View>
          <Icon name="chevron-right" size={22} color={colors.muted} />
        </Pressable>
      ))}

      <View style={styles.divider} />

      <Pressable style={styles.modeCard} onPress={onLexicon}>
        <View style={styles.modeIcon}>
          <Icon name="book-open" size={22} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.modeTitle}>Lexicon</Text>
          <Text style={styles.modeSub}>Browse all your species</Text>
        </View>
        <Icon name="chevron-right" size={22} color={colors.muted} />
      </Pressable>

      <View style={styles.linkRow}>
        <Pressable style={styles.linkBtn} onPress={onStats}>
          <Icon name="bar-chart-2" size={18} color={colors.muted} />
          <Text style={styles.linkText}>Statistics</Text>
        </Pressable>
        <Pressable style={styles.linkBtn} onPress={onSettings}>
          <Icon name="settings" size={18} color={colors.muted} />
          <Text style={styles.linkText}>Settings</Text>
        </Pressable>
      </View>

      {lifetimePct !== null && (
        <Text style={styles.lifetime}>
          Lifetime accuracy {lifetimePct}% · {lifetime.correct}/
          {lifetime.answered}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, paddingTop: 36, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 4 },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  modeSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 6, marginHorizontal: 4 },
  linkRow: { flexDirection: 'row', marginTop: 10 },
  linkBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  linkText: { fontSize: 16, fontWeight: '700', color: colors.muted },
  lifetime: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 14,
    fontSize: 14,
  },
});
