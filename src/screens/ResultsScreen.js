// End-of-round summary with score, and options to revisit missed cards,
// replay the deck, or return to the main menu. The main-menu action is the
// emphasized one: a prominent button plus an X in the top corner.

import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import { useTheme, useThemedStyles } from '../theme';
import { Appear, AnimatedNumber, AnimatedBar } from '../components/anim';


// Tinted action buttons — teal for "Play again", amber for "Revisit missed".
// These use the theme's `accents`, which carry a light AND dark pair for each
// hue; they were hardcoded pastels before, which stayed pale in dark mode and
// glowed against the dark background.

// Ionicons name + message keyed off performance.
function grade(pct) {
  if (pct >= 90) return { icon: 'trophy', msg: 'Outstanding!' };
  if (pct >= 70) return { icon: 'thumbs-up', msg: 'Great job!' };
  if (pct >= 50) return { icon: 'trending-up', msg: 'Nice work — keep going!' };
  return { icon: 'school-outline', msg: 'Keep practicing!' };
}

function streakGrade(streak) {
  if (streak >= 30) return { icon: 'flame', msg: 'On fire!' };
  if (streak >= 15) return { icon: 'flash', msg: 'Blazing streak!' };
  if (streak >= 5) return { icon: 'thumbs-up', msg: 'Nice run!' };
  return { icon: 'school-outline', msg: 'Keep practicing!' };
}

export default function ResultsScreen({
  mode,
  total,
  correct,
  missed,
  lifetime,
  streak,
  onRevisitMissed,
  onPlayAgain,
  onMenu,
  onSelectMissed,
  flags,
  onToggleFlag,
}) {
  const { colors, accents } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const speedrun = mode === 'speedrun';
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const { icon, msg } = speedrun ? streakGrade(correct) : grade(pct);
  const lifetimePct =
    lifetime && lifetime.answered > 0
      ? Math.round((lifetime.correct / lifetime.answered) * 100)
      : null;

  return (
    <View style={styles.flex} testID="results-screen">
      {/* Top bar: an X that returns to the main menu. */}
      <View style={styles.topBar}>
        <Pressable
          testID="results-close"
          onPress={onMenu}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close, back to menu"
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
        >
          <Icon name="x" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Appear scaleFrom={0.6} offset={0} duration={380}>
          <View style={styles.badge}>
            <Icon name={icon} size={36} color={colors.primary} />
          </View>
        </Appear>
        <Appear delay={90} offset={8}>
          <Text style={styles.msg}>{msg}</Text>
        </Appear>

        <Appear delay={160} offset={10} style={styles.scoreCardWrap}>
          <View style={styles.scoreCard}>
            {speedrun ? (
              <>
                <AnimatedNumber value={correct} style={styles.pct} />
                <Text style={styles.scoreDetail}>
                  cards before {missed.length} misses
                </Text>
              </>
            ) : (
              <>
                <AnimatedNumber value={pct} style={styles.pct} format={(n) => `${n}%`} />
                <Text style={styles.scoreDetail}>
                  {correct} of {total} correct
                </Text>
                <View style={styles.scoreBarTrack}>
                  <AnimatedBar pct={pct} style={styles.scoreBarFill} />
                </View>
              </>
            )}
          </View>
        </Appear>

        {streak && streak.count > 0 && (
          <Appear delay={210} offset={8} style={styles.stretch}>
            <View style={styles.streakRow}>
              <Icon name="flame" size={18} color={colors.primary} />
              <Text style={styles.streakText}>{streak.count}-day streak</Text>
            </View>
          </Appear>
        )}

        {missed.length > 0 && (
          <Appear delay={240} offset={12} style={styles.stretch}>
            <Pressable
              testID="results-revisit"
              style={[styles.actionButton, styles.revisitBtn]}
              onPress={onRevisitMissed}
            >
              <Icon name="eye-outline" size={20} color={accents.amber.fg} />
              <Text style={[styles.actionText, { color: accents.amber.fg }]}>
                Revisit missed ({missed.length})
              </Text>
            </Pressable>
          </Appear>
        )}

        <Appear delay={300} offset={12} style={styles.stretch}>
          <Pressable
            testID="results-playagain"
            style={[styles.actionButton, styles.playAgainBtn]}
            onPress={onPlayAgain}
          >
            <Icon name="play" size={18} color={accents.teal.fg} />
            <Text style={[styles.actionText, { color: accents.teal.fg }]}>Play again</Text>
          </Pressable>
        </Appear>

        {/* Emphasized primary action. */}
        <Appear delay={360} offset={12} style={styles.stretch}>
          <Pressable
            testID="results-menu"
            style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
            onPress={onMenu}
          >
            <Icon name="home" size={20} color={colors.onDark} />
            <Text style={styles.menuText}>Main menu</Text>
          </Pressable>
        </Appear>

        {missed.length > 0 && (
          <View style={styles.missedList}>
            <Text style={styles.missedHeading}>Species you missed</Text>
            <Text style={styles.missedHint}>
              Tap a species to learn more, or flag it to study later
            </Text>
            {missed.map((c, i) => {
              const flagged = !!(flags && flags.has(String(c.taxonId)));
              return (
                <Appear
                  key={`${c.id}-${i}`}
                  delay={420 + Math.min(i, 10) * 45}
                  offset={10}
                  style={styles.stretch}
                >
                <Pressable
                  testID={`results-missed-${c.taxonId}`}
                  onPress={() => onSelectMissed && onSelectMissed(c)}
                  style={({ pressed }) => [
                    styles.missedRow,
                    i > 0 && styles.missedRowBorder,
                    pressed && styles.missedRowPressed,
                  ]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.missedItem}>
                      {c.common || c.scientific}
                    </Text>
                    {!!c.common && (
                      <Text style={styles.missedSci}>{c.scientific}</Text>
                    )}
                  </View>
                  {onToggleFlag && (
                    <Pressable
                      onPress={() => onToggleFlag(c.taxonId)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={flagged ? 'Unflag species' : 'Flag species'}
                      style={styles.flagBtn}
                    >
                      <Icon
                        name={flagged ? 'flag' : 'flag-outline'}
                        size={20}
                        color={flagged ? colors.flag : colors.muted}
                      />
                    </Pressable>
                  )}
                  <Icon name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
                </Appear>
              );
            })}
          </View>
        )}

        {lifetimePct !== null && (
          <Text style={styles.lifetime}>
            Lifetime accuracy {lifetimePct}% · {lifetime.correct}/
            {lifetime.answered}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors, accents) => StyleSheet.create({
  flex: { flex: 1 },
  // Animated-wrapper helper: keep full-width children (buttons / rows / score
  // card) stretching across the centered container.
  stretch: { alignSelf: 'stretch' },
  scoreCardWrap: { alignSelf: 'stretch' },
  // Daily-streak line under the score.
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 18,
  },
  streakText: { fontSize: 15, fontWeight: '800', color: colors.text },
  // Thin accuracy bar under the score that fills to the round's percentage.
  scoreBarTrack: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.faint,
    overflow: 'hidden',
    marginTop: 16,
    marginHorizontal: 24,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  container: { padding: 20, paddingTop: 8, alignItems: 'center' },
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
    alignSelf: 'stretch',
    paddingVertical: 24,
    alignItems: 'center',
    marginVertical: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pct: { fontSize: 56, fontWeight: '900', color: colors.text, letterSpacing: -1 },
  scoreDetail: { fontSize: 16, color: colors.muted, marginTop: 4 },

  // Secondary actions: revisit missed (light orange), play again (light green).
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 15,
    width: '100%',
    marginBottom: 12,
  },
  actionText: { fontSize: 17, fontWeight: '800' },
  revisitBtn: { backgroundColor: accents.amber.bg, borderColor: accents.amber.bg },
  playAgainBtn: { backgroundColor: accents.teal.bg, borderColor: accents.teal.bg },

  // Emphasized primary action: main menu.
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    width: '100%',
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  menuText: { color: colors.onDark, fontSize: 18, fontWeight: '900' },

  missedList: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  missedHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
  },
  missedHint: { fontSize: 12, color: colors.muted, marginTop: 2, marginBottom: 4 },
  missedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  missedRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  missedRowPressed: { opacity: 0.55 },
  flagBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  missedItem: { fontSize: 16, color: colors.text, fontWeight: '600' },
  missedSci: { fontStyle: 'italic', color: colors.muted, fontSize: 14, marginTop: 1 },
  lifetime: {
    color: colors.muted,
    marginTop: 24,
    fontSize: 14,
  },
});
