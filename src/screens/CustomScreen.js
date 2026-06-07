// Custom game setup: choose how many cards to study and which taxon groups to
// include. Groups and their counts are derived from the loaded deck.

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import GroupIcon from '../components/GroupIcon';
import ScreenHeader from '../components/ScreenHeader';
import { colors, groupKey, groupLabel, groupIcon } from '../theme';

const STEP = 4;
const PRESETS = [8, 16, 32];
const FLAG_ON = '#E0A800';

export default function CustomScreen({
  deck,
  onStart,
  onBack,
  title = 'Custom game',
  flags,
}) {
  const isFlagged = (c) => !!(flags && flags.has(String(c.taxonId)));

  // Optionally restrict the whole picker to flagged species.
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  // How many distinct flagged species exist in this deck (for the toggle label).
  const flaggedCount = useMemo(() => {
    const seen = new Set();
    for (const c of deck) if (isFlagged(c)) seen.add(String(c.taxonId));
    return seen.size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, flags]);

  // The deck the picker operates on (all cards, or only flagged ones).
  const baseDeck = useMemo(
    () => (flaggedOnly ? deck.filter(isFlagged) : deck),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck, flaggedOnly, flags]
  );

  // Tally available cards per group, most common first.
  const groups = useMemo(() => {
    const counts = new Map();
    for (const c of baseDeck) {
      const k = groupKey(c.iconic);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        count,
        label: groupLabel(key),
        icon: groupIcon(key === 'Other' ? null : key),
      }))
      .sort((a, b) => b.count - a.count);
  }, [baseDeck]);

  // Selected group keys (default: all groups selected).
  const [selected, setSelected] = useState(() => new Set(groups.map((g) => g.key)));

  const available = useMemo(
    () =>
      groups.reduce((sum, g) => (selected.has(g.key) ? sum + g.count : sum), 0),
    [groups, selected]
  );

  const [count, setCount] = useState(Math.min(16, deck.length) || 1);

  // Keep the requested count within what the current selection can offer.
  useEffect(() => {
    setCount((c) => Math.max(1, Math.min(c, available || 1)));
  }, [available]);

  const toggleGroup = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clamp = (n) => Math.max(1, Math.min(n, available));
  const canStart = available > 0;

  return (
    <View style={styles.flex}>
      <ScreenHeader title={title} onBack={onBack} />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {flaggedCount > 0 && (
          <Pressable
            testID="custom-flagged"
            onPress={() => setFlaggedOnly((v) => !v)}
            style={[styles.flagToggle, flaggedOnly && styles.flagToggleOn]}
          >
            <Icon
              name={flaggedOnly ? 'flag' : 'flag-outline'}
              size={16}
              color={flaggedOnly ? FLAG_ON : colors.muted}
            />
            <Text
              style={[styles.flagToggleText, flaggedOnly && styles.flagToggleTextOn]}
            >
              Flagged only ({flaggedCount})
            </Text>
          </Pressable>
        )}

        <Text style={styles.label}>Groups</Text>
        <View style={styles.chips}>
          {groups.map((g) => {
            const on = selected.has(g.key);
            return (
              <Pressable
                key={g.key}
                testID={`custom-group-${g.key}`}
                onPress={() => toggleGroup(g.key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <GroupIcon
                  name={g.icon}
                  size={16}
                  color={on ? colors.primaryDark : colors.muted}
                />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {g.label} ({g.count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { marginTop: 28 }]}>Number of cards</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setCount((c) => clamp(c - STEP))}
          >
            <Icon name="minus" size={24} color={colors.primaryDark} />
          </Pressable>
          <View style={styles.countBox}>
            <Text style={styles.countNum}>{Math.min(count, available)}</Text>
            <Text style={styles.countOf}>of {available} available</Text>
          </View>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setCount((c) => clamp(c + STEP))}
          >
            <Icon name="plus" size={24} color={colors.primaryDark} />
          </Pressable>
        </View>

        <View style={styles.presets}>
          {PRESETS.filter((p) => p <= available).map((p) => (
            <Pressable
              key={p}
              style={styles.preset}
              onPress={() => setCount(p)}
            >
              <Text style={styles.presetText}>{p}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.preset} onPress={() => setCount(available)}>
            <Text style={styles.presetText}>Max</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="custom-start"
          style={[styles.start, !canStart && styles.startDisabled]}
          disabled={!canStart}
          onPress={() =>
            onStart([...selected], Math.min(count, available), flaggedOnly)
          }
        >
          {canStart && <Icon name="play" size={18} color={colors.onDark} />}
          <Text style={styles.startText}>
            {canStart
              ? `Start • ${Math.min(count, available)} cards`
              : 'Select a group'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, paddingTop: 16 },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  flagToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: 22,
  },
  flagToggleOn: { borderBottomColor: FLAG_ON },
  flagToggleText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  flagToggleTextOn: { color: '#7A5B00' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  chipOn: { borderBottomColor: colors.primary },
  chipText: { fontSize: 14.5, fontWeight: '600', color: colors.muted },
  chipTextOn: { color: colors.primaryDark },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  stepBtn: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBox: { flex: 1, alignItems: 'center' },
  countNum: { fontSize: 44, fontWeight: '900', color: colors.text },
  countOf: { fontSize: 13, color: colors.muted, marginTop: 2 },
  presets: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  preset: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.faint,
  },
  presetText: { fontSize: 15, fontWeight: '700', color: colors.text },
  footer: { padding: 20 },
  start: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
  },
  startDisabled: { backgroundColor: '#C2CDB0' },
  startText: { color: colors.onDark, fontSize: 18, fontWeight: '800' },
});
