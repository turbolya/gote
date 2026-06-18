// Statistics page: a lifetime summary plus a per-species breakdown — every
// species you've been quizzed on, with a thumbnail and two bars (correct /
// incorrect), sortable by success rate or by correct/incorrect counts.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { useColors, useThemedStyles } from '../theme';

// Sort modes for the per-species list.
const SORTS = [
  { key: 'pct', label: 'Success %' },
  { key: 'correct', label: 'Correct' },
  { key: 'incorrect', label: 'Incorrect' },
];

const knownOf = (s) => s.known || 0;
const missedOf = (s) => s.missed || 0;
const totalOf = (s) => knownOf(s) + missedOf(s);
const successOf = (s) => (totalOf(s) > 0 ? knownOf(s) / totalOf(s) : 0);

// One species row: thumbnail, name, and two scaled bars (correct / incorrect).
// Bars are scaled to `maxCount` (the largest single count across the list) so
// their lengths are comparable from row to row; nonzero bars keep a minimum
// width so they stay visible.
function CardStatRow({ item, maxCount }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const known = knownOf(item);
  const missed = missedOf(item);
  const total = known + missed;
  const pct = total > 0 ? Math.round((known / total) * 100) : 0;
  const width = (n) => (n > 0 ? `${Math.max(4, (n / maxCount) * 100)}%` : 0);

  return (
    <View style={styles.cardRow} testID={`stats-card-${item.key}`}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Icon name="image" size={20} color={colors.muted} />
        </View>
      )}
      <View style={styles.flex}>
        <View style={styles.cardTop}>
          <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardPct}>{pct}%</Text>
        </View>
        {!!item.sci && (
          <Text style={styles.cardSci} numberOfLines={1}>{item.sci}</Text>
        )}

        <View style={styles.barLine}>
          <Icon name="check" size={12} color={colors.correct} style={styles.barIcon} />
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: colors.correct, width: width(known) }]} />
          </View>
          <Text style={[styles.barCount, { color: colors.correct }]}>{known}</Text>
        </View>
        <View style={styles.barLine}>
          <Icon name="x" size={12} color={colors.wrong} style={styles.barIcon} />
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { backgroundColor: colors.wrong, width: width(missed) }]} />
          </View>
          <Text style={[styles.barCount, { color: colors.wrong }]}>{missed}</Text>
        </View>
      </View>
    </View>
  );
}

export default function StatsScreen({ species, cards = [], lifetime, onBack, onReset }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [sort, setSort] = useState('pct');

  // taxonId / scientific → thumbnail, from the current deck. Used as a fallback
  // for older stats entries saved before thumbnails were recorded.
  const imageByKey = useMemo(() => {
    const m = {};
    for (const c of cards) {
      const k = c.taxonId != null ? String(c.taxonId) : c.scientific;
      if (k && c.image && !m[k]) m[k] = c.image;
    }
    return m;
  }, [cards]);

  const list = useMemo(
    () =>
      Object.entries(species || {}).map(([key, s]) => ({
        key,
        ...s,
        image: s.image || imageByKey[key] || null,
      })),
    [species, imageByKey]
  );

  const sorted = useMemo(() => {
    const arr = [...list];
    if (sort === 'correct') {
      arr.sort((a, b) => knownOf(b) - knownOf(a) || totalOf(b) - totalOf(a));
    } else if (sort === 'incorrect') {
      arr.sort((a, b) => missedOf(b) - missedOf(a) || totalOf(b) - totalOf(a));
    } else {
      arr.sort((a, b) => successOf(b) - successOf(a) || totalOf(b) - totalOf(a));
    }
    return arr;
  }, [list, sort]);

  const maxCount = useMemo(
    () => Math.max(1, ...list.map((s) => Math.max(knownOf(s), missedOf(s)))),
    [list]
  );

  const lifetimePct =
    lifetime && lifetime.answered > 0
      ? Math.round((lifetime.correct / lifetime.answered) * 100)
      : null;

  const empty = list.length === 0;

  const confirmReset = () => {
    Alert.alert(
      'Reset statistics?',
      'This permanently clears your lifetime score and all per-species tallies.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: onReset },
      ]
    );
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Statistics" onBack={onBack} />

      <ScrollView
        testID="stats-scroll"
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>
              {lifetimePct !== null ? `${lifetimePct}%` : '—'}
            </Text>
            <Text style={styles.summaryLabel}>Accuracy</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{lifetime ? lifetime.answered : 0}</Text>
            <Text style={styles.summaryLabel}>Cards answered</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{list.length}</Text>
            <Text style={styles.summaryLabel}>Species seen</Text>
          </View>
        </View>

        {empty ? (
          <Text style={styles.emptyText}>
            Play a few rounds and a per-species breakdown — how often you get each
            one right or wrong — will show up here.
          </Text>
        ) : (
          <>
            <Text style={styles.boardTitle}>By species</Text>

            {/* Sort options */}
            <View style={styles.sortRow}>
              {SORTS.map((s) => {
                const on = sort === s.key;
                return (
                  <Pressable
                    key={s.key}
                    testID={`stats-sort-${s.key}`}
                    onPress={() => setSort(s.key)}
                    style={[styles.sortChip, on && styles.sortChipOn]}
                  >
                    <Text style={[styles.sortText, on && styles.sortTextOn]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {sorted.map((item) => (
              <CardStatRow key={item.key} item={item} maxCount={maxCount} />
            ))}

            <Pressable testID="stats-reset" style={styles.resetButton} onPress={confirmReset}>
              <Text style={styles.resetText}>Reset statistics</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  summary: {
    flexDirection: 'row',
    paddingVertical: 20,
    marginBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 30, fontWeight: '900', color: colors.text },
  summaryLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 40,
    paddingHorizontal: 20,
  },

  boardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  // Sort segmented chips
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sortChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  sortText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  sortTextOn: { color: colors.onDark },

  // Per-species row
  cardRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.faint,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { flex: 1, fontSize: 15.5, fontWeight: '700', color: colors.text },
  cardPct: { fontSize: 14, fontWeight: '800', color: colors.muted },
  cardSci: { fontSize: 12.5, fontStyle: 'italic', color: colors.muted, marginTop: 1, marginBottom: 6 },

  barLine: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  barIcon: { width: 13, textAlign: 'center' },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.faint,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  barCount: { width: 26, textAlign: 'right', fontSize: 12.5, fontWeight: '800' },

  resetButton: { alignItems: 'center', paddingVertical: 14, marginTop: 18 },
  resetText: { color: colors.wrong, fontSize: 15, fontWeight: '700' },
});
