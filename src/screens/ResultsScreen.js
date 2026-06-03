// End-of-round summary with score, and options to revisit missed cards,
// replay the whole deck, or switch user.

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import { colors } from '../theme';

// Monotone icon + message keyed off performance.
function grade(pct) {
  if (pct >= 90) return { icon: 'award', msg: 'Outstanding!' };
  if (pct >= 70) return { icon: 'thumbs-up', msg: 'Great job!' };
  if (pct >= 50) return { icon: 'trending-up', msg: 'Nice work — keep going!' };
  return { icon: 'target', msg: 'Keep practicing!' };
}

function streakGrade(streak) {
  if (streak >= 30) return { icon: 'award', msg: 'On fire!' };
  if (streak >= 15) return { icon: 'zap', msg: 'Blazing streak!' };
  if (streak >= 5) return { icon: 'thumbs-up', msg: 'Nice run!' };
  return { icon: 'target', msg: 'Keep practicing!' };
}

export default function ResultsScreen({
  mode,
  total,
  correct,
  missed,
  lifetime,
  onRevisitMissed,
  onPlayAgain,
  onMenu,
}) {
  const speedrun = mode === 'speedrun';
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const { icon, msg } = speedrun ? streakGrade(correct) : grade(pct);
  const lifetimePct =
    lifetime && lifetime.answered > 0
      ? Math.round((lifetime.correct / lifetime.answered) * 100)
      : null;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.badge}>
        <Icon name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={styles.msg}>{msg}</Text>

      <View style={styles.scoreCard}>
        {speedrun ? (
          <>
            <Text style={styles.pct}>{correct}</Text>
            <Text style={styles.scoreDetail}>
              cards before {missed.length} misses
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.pct}>{pct}%</Text>
            <Text style={styles.scoreDetail}>
              {correct} of {total} correct
            </Text>
          </>
        )}
      </View>

      {missed.length > 0 && (
        <Pressable style={styles.primaryButton} onPress={onRevisitMissed}>
          <Icon name="rotate-ccw" size={18} color={colors.onDark} />
          <Text style={styles.primaryText}>
            Revisit missed ({missed.length})
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.secondaryButton} onPress={onPlayAgain}>
        <Icon name="refresh-cw" size={18} color={colors.text} />
        <Text style={styles.secondaryText}>Play again</Text>
      </Pressable>

      <Pressable style={styles.linkButton} onPress={onMenu}>
        <Text style={styles.linkText}>Main menu</Text>
      </Pressable>

      {missed.length > 0 && (
        <View style={styles.missedList}>
          <Text style={styles.missedHeading}>Species you missed</Text>
          {missed.map((c, i) => (
            <Text key={`${c.id}-${i}`} style={styles.missedItem}>
              {c.common || c.scientific}
              {c.common ? (
                <Text style={styles.missedSci}> · {c.scientific}</Text>
              ) : null}
            </Text>
          ))}
        </View>
      )}

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
  container: { padding: 24, paddingTop: 56, alignItems: 'center' },
  badge: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msg: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginTop: 16,
    letterSpacing: -0.3,
  },
  scoreCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginVertical: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pct: { fontSize: 56, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  scoreDetail: { fontSize: 16, color: colors.muted, marginTop: 4 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 12,
  },
  primaryText: { color: colors.onDark, fontSize: 17, fontWeight: '800' },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    width: '100%',
    marginBottom: 12,
  },
  secondaryText: { color: colors.text, fontSize: 17, fontWeight: '800' },
  linkButton: { paddingVertical: 10 },
  linkText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  missedList: {
    alignSelf: 'stretch',
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  missedHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  missedItem: { fontSize: 16, color: colors.text, marginVertical: 4 },
  missedSci: { fontStyle: 'italic', color: colors.muted, fontSize: 14 },
  lifetime: {
    color: colors.muted,
    marginTop: 24,
    fontSize: 14,
  },
});
