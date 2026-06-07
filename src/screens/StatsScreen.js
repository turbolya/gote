// Statistics page: lifetime summary plus the species you miss most and know
// best, derived from the per-species tallies in storage.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { colors } from '../theme';

const TOP_N = 8;

function Leaderboard({ title, icon, iconColor, rows, countKey, countColor }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.board}>
      <View style={styles.boardTitleRow}>
        <Icon name={icon} size={18} color={iconColor} />
        <Text style={styles.boardTitle}>{title}</Text>
      </View>
      {rows.map((s, i) => {
        const total = s.known + s.missed;
        return (
          <View key={s.key} style={styles.row}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {s.sci} · seen {total}×
              </Text>
            </View>
            <Text style={[styles.count, { color: countColor }]}>
              {s[countKey]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function StatsScreen({ species, lifetime, onBack, onReset }) {
  const list = useMemo(
    () =>
      Object.entries(species || {}).map(([key, s]) => ({ key, ...s })),
    [species]
  );

  const mostMissed = useMemo(
    () =>
      list
        .filter((s) => s.missed > 0)
        .sort((a, b) => b.missed - a.missed || b.known + b.missed - (a.known + a.missed))
        .slice(0, TOP_N),
    [list]
  );

  const mostKnown = useMemo(
    () =>
      list
        .filter((s) => s.known > 0)
        .sort((a, b) => b.known - a.known)
        .slice(0, TOP_N),
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
            Play a few rounds and your most-missed and best-known species will
            show up here.
          </Text>
        ) : (
          <>
            <Leaderboard
              title="Most missed"
              icon="alert-circle"
              iconColor={colors.wrong}
              rows={mostMissed}
              countKey="missed"
              countColor={colors.wrong}
            />
            <Leaderboard
              title="Best known"
              icon="check-circle"
              iconColor={colors.correct}
              rows={mostKnown}
              countKey="known"
              countColor={colors.correct}
            />

            <Pressable testID="stats-reset" style={styles.resetButton} onPress={confirmReset}>
              <Text style={styles.resetText}>Reset statistics</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  summary: {
    flexDirection: 'row',
    paddingVertical: 20,
    marginBottom: 24,
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
  board: {
    marginBottom: 22,
  },
  boardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  boardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rank: {
    width: 22,
    fontSize: 15,
    fontWeight: '800',
    color: colors.muted,
    textAlign: 'center',
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, fontStyle: 'italic', color: colors.muted, marginTop: 1 },
  count: { fontSize: 20, fontWeight: '900', minWidth: 28, textAlign: 'right' },
  resetButton: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  resetText: { color: colors.wrong, fontSize: 15, fontWeight: '700' },
});
