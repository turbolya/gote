// A/B duel drill — a focused two-choice mini-round pitting only the two
// look-alikes of a confused pair against each other, repeated until the player
// splits them reliably. Opened from the side-by-side comparison ("Drill this
// pair"), which is itself reached from the "Species you mix up" list and the
// just-in-time callout during play.
//
// Each question shows one photo of one of the two species and asks which it is;
// the two name buttons swap order every time so the player can't stop reading.
// Photos rotate through each species' curated set so it trains the species, not
// one memorised image. The pure sequencing/mastery logic lives in src/duel.js
// (unit-tested); this file owns photos, layout and timing.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { useColors, useThemedStyles } from '../theme';
import { fetchTaxonPhotos } from '../api';
import {
  nextTarget,
  duelStreak,
  duelDone,
  duelSummary,
  DUEL_MASTERY_STREAK,
} from '../duel';

// A dot per correct-in-a-row needed; the first `filled` are lit.
function StreakDots({ filled, goal, colors }) {
  const dots = [];
  for (let i = 0; i < goal; i++) {
    dots.push(
      <View
        key={i}
        style={{
          width: 9,
          height: 9,
          borderRadius: 5,
          marginHorizontal: 3,
          backgroundColor: i < filled ? colors.correct : colors.border,
        }}
      />
    );
  }
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{dots}</View>;
}

export default function DuelScreen({ pair, note = '', onClose }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  // Curated photo pools per side. Seeded with the one thumbnail we already have
  // so the drill is instant and works offline; replaced with the full set once
  // fetched.
  const fallbackA = pair && pair.a && pair.a.image ? [pair.a.image] : [];
  const fallbackB = pair && pair.b && pair.b.image ? [pair.b.image] : [];
  const [photos, setPhotos] = useState({ a: fallbackA, b: fallbackB });
  // Start the drill the instant we already have a thumbnail for each side — we
  // always do, coming from the confusion list — so it's immediate and works
  // offline; the fuller curated set swaps in when the background fetch resolves.
  // Only show the spinner if a side has no photo to show yet.
  const [loading, setLoading] = useState(!(fallbackA.length && fallbackB.length));

  const targetsRef = useRef([]); // history for nextTarget (not rendered)
  const timer = useRef(null);
  const [answers, setAnswers] = useState([]); // booleans, one per question
  const [question, setQuestion] = useState(null); // { target, swap, uri }
  const [picked, setPicked] = useState(null); // 'a' | 'b' | null
  const [phase, setPhase] = useState('playing'); // 'playing' | 'done'

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  // Fetch each species' curated photos once. Keep the fallback thumbnail on any
  // failure so the drill still runs.
  useEffect(() => {
    if (!pair) return;
    let alive = true;
    (async () => {
      try {
        const [pa, pb] = await Promise.all([
          pair.aKey ? fetchTaxonPhotos(pair.aKey, 8) : Promise.resolve([]),
          pair.bKey ? fetchTaxonPhotos(pair.bKey, 8) : Promise.resolve([]),
        ]);
        if (!alive) return;
        setPhotos({
          a: pa && pa.length ? pa : fallbackA,
          b: pb && pb.length ? pb : fallbackB,
        });
      } catch {
        /* keep the fallbacks */
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newQuestion = useCallback(() => {
    const target = nextTarget(targetsRef.current);
    targetsRef.current = [...targetsRef.current, target];
    const pool = target === 'a' ? photos.a : photos.b;
    const uri = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    setQuestion({ target, swap: Math.random() < 0.5, uri });
    setPicked(null);
  }, [photos]);

  // Start the first question the moment photos have settled.
  useEffect(() => {
    if (!loading && !question) newQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const advance = useCallback(
    (answersNow) => {
      clearTimer();
      if (duelDone(answersNow)) setPhase('done');
      else newQuestion();
    },
    [newQuestion]
  );

  const pick = (choice) => {
    if (picked || phase !== 'playing' || !question) return;
    const correct = choice === question.target;
    const next = [...answers, correct];
    setPicked(choice);
    setAnswers(next);
    // A correct answer flows on by itself; a miss waits for a tap so the
    // correction (and the player's own tell) has a moment to land.
    if (correct) {
      timer.current = setTimeout(() => advance(next), 650);
    }
  };

  const reset = () => {
    clearTimer();
    targetsRef.current = [];
    setAnswers([]);
    setPicked(null);
    setPhase('playing');
    setQuestion(null); // the loading effect's guard re-seeds via newQuestion
    // photos are already loaded; kick a fresh question directly.
    setTimeout(() => newQuestion(), 0);
  };

  if (!pair) return null;

  const nameA = pair.a ? pair.a.name : 'A';
  const nameB = pair.b ? pair.b.name : 'B';
  const streak = duelStreak(answers);
  const answered = picked != null;
  const gotIt = answered && question && picked === question.target;

  // --- done ---
  if (phase === 'done') {
    const s = duelSummary(answers);
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Duel" onBack={onClose} />
        <View style={styles.doneWrap}>
          <View
            style={[
              styles.doneBadge,
              { backgroundColor: s.mastered ? colors.correct : colors.primary },
            ]}
          >
            <Icon name={s.mastered ? 'award' : 'trending-up'} size={40} color={colors.onDark} />
          </View>
          <Text testID="duel-done-title" style={styles.doneTitle}>
            {s.mastered ? 'You’ve got it!' : 'Good progress'}
          </Text>
          <Text style={styles.doneMsg}>
            {s.mastered
              ? `${s.streak} in a row — you can tell ${nameA} from ${nameB}.`
              : `${s.correct} of ${s.total} correct. A few more reps and it’ll stick.`}
          </Text>

          <Pressable
            testID="duel-again"
            style={[styles.btn, s.mastered ? styles.btnGhost : styles.btnPrimary]}
            onPress={reset}
          >
            <Text style={[styles.btnText, s.mastered ? styles.btnGhostText : styles.btnPrimaryText]}>
              Drill again
            </Text>
          </Pressable>
          <Pressable
            testID="duel-close"
            style={[styles.btn, s.mastered ? styles.btnPrimary : styles.btnGhost]}
            onPress={onClose}
          >
            <Text style={[styles.btnText, s.mastered ? styles.btnPrimaryText : styles.btnGhostText]}>
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // --- loading ---
  if (loading && !question) {
    return (
      <View style={styles.flex}>
        <ScreenHeader title="Duel" onBack={onClose} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Setting up the drill…</Text>
        </View>
      </View>
    );
  }

  // --- playing ---
  const order = question && question.swap ? ['b', 'a'] : ['a', 'b'];
  const nameFor = (side) => (side === 'a' ? nameA : nameB);

  return (
    <View style={styles.flex} testID="duel-screen">
      <ScreenHeader title="Duel" onBack={onClose} />

      <View style={styles.streakRow}>
        <StreakDots filled={streak} goal={DUEL_MASTERY_STREAK} colors={colors} />
        <Text style={styles.streakLabel}>
          {streak >= DUEL_MASTERY_STREAK
            ? 'Nailed it!'
            : `${streak}/${DUEL_MASTERY_STREAK} in a row`}
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.prompt}>Which one is this?</Text>

        <View style={styles.photoWrap}>
          {question && question.uri ? (
            <Image source={{ uri: question.uri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Icon name="image" size={32} color={colors.muted} />
            </View>
          )}
        </View>

        <View style={styles.choices}>
          {order.map((side) => {
            const isPicked = picked === side;
            const isCorrect = question && side === question.target;
            const reveal = answered && (isCorrect || isPicked);
            return (
              <Pressable
                key={side}
                testID={`duel-choice-${side}`}
                disabled={answered}
                onPress={() => pick(side)}
                style={[
                  styles.choice,
                  reveal && isCorrect && styles.choiceCorrect,
                  reveal && !isCorrect && styles.choiceWrong,
                ]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    reveal && (isCorrect || isPicked) && styles.choiceTextReveal,
                  ]}
                  numberOfLines={2}
                >
                  {nameFor(side)}
                </Text>
                {reveal && (
                  <Icon
                    name={isCorrect ? 'check-circle' : 'x-circle'}
                    size={20}
                    color={isCorrect ? colors.correct : colors.wrong}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Correction: on a miss, name the right one and resurface the tell. */}
        {answered && !gotIt && (
          <View style={styles.correction}>
            <Text style={styles.correctionText}>
              That was <Text style={styles.correctionName}>{nameFor(question.target)}</Text>.
            </Text>
            {!!note && (
              <Text style={styles.tell} numberOfLines={3}>
                Your tell: {note}
              </Text>
            )}
            <Pressable testID="duel-continue" style={styles.continueBtn} onPress={() => advance(answers)}>
              <Text style={styles.continueText}>Continue</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loadingText: { marginTop: 14, color: colors.muted, fontSize: 15 },

    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    streakLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },

    body: { flex: 1, paddingHorizontal: 20 },
    prompt: {
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '700',
      color: colors.muted,
      marginBottom: 12,
    },

    photoWrap: { alignItems: 'center' },
    photo: {
      width: '100%',
      aspectRatio: 1,
      maxHeight: 340,
      borderRadius: 20,
      backgroundColor: colors.border,
    },
    photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },

    choices: { marginTop: 18, gap: 12 },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 58,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
      paddingHorizontal: 16,
    },
    choiceCorrect: { borderColor: colors.correct, backgroundColor: colors.correct + '18' },
    choiceWrong: { borderColor: colors.wrong, backgroundColor: colors.wrong + '18' },
    choiceText: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
    choiceTextReveal: { color: colors.text },

    correction: { marginTop: 16, alignItems: 'center' },
    correctionText: { fontSize: 15, color: colors.text },
    correctionName: { fontWeight: '800', color: colors.primaryDark },
    tell: {
      marginTop: 8,
      fontSize: 14,
      fontStyle: 'italic',
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 20,
    },
    continueBtn: {
      marginTop: 16,
      alignSelf: 'stretch',
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueText: { color: colors.onPrimary, fontSize: 17, fontWeight: '800' },

    doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
    doneBadge: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    doneTitle: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: 10 },
    doneMsg: {
      fontSize: 15,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 28,
    },
    btn: {
      alignSelf: 'stretch',
      minHeight: 54,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    btnText: { fontSize: 17, fontWeight: '800' },
    btnPrimary: { backgroundColor: colors.primary },
    btnPrimaryText: { color: colors.onPrimary },
    btnGhost: { borderWidth: 2, borderColor: colors.border, backgroundColor: 'transparent' },
    btnGhostText: { color: colors.text },
  });
