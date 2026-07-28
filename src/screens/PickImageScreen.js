// "Pick the right one" game: a species NAME is shown at the top, and four photos
// below — one a curated photo of that species, three from similar species.
// Tapping a tile (anywhere but the corner buttons) reveals the answer and grades
// the pick. Each tile has two corner buttons: zoom this photo, and browse other
// curated photos of that species. After answering, every tile's species name is
// shown.
//
// Each round's images are fetched per-card (curated photo of the target +
// similar-species photos), so the parent prepares the round async and passes
// `round` in; this screen just renders and handles the tap.

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import PhotoViewer from '../components/PhotoViewer';
import { useColors, useThemedStyles } from '../theme';
import { fetchTaxonPhotos } from '../api';
import { pairKey, CONFUSION_HINT_MIN } from '../confusions';
import { IS_E2E } from '../e2e/testMode';


export default function PickImageScreen({
  round, // { name, options:[{taxonId, photo, name, correct}] } | null while loading
  index,
  total,
  correctCount,
  loading,
  error,
  flagged = false,
  onToggleFlag,
  onPick, // (wasCorrect, chosenOption) => void
  onNext,
  onQuit,
  onConfusionCount, // (correctKey, chosenKey) => count, for the callout
  onCompare, // open the side-by-side comparison for a pair
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState(null); // taxonId of the tapped tile
  const answered = picked != null;

  // Fullscreen viewer state: { photos, title, loading, startIndex } or null.
  const [viewer, setViewer] = useState(null);

  // Reset selection + viewer when a new round arrives.
  useEffect(() => {
    setPicked(null);
    setViewer(null);
  }, [round]);

  const pick = (opt) => {
    if (answered) return;
    setPicked(opt.taxonId);
    // Pass the tapped tile too, so a wrong pick can be logged as a confusion
    // (the round's species vs. the look-alike the player chose).
    onPick(opt.correct, opt);
  };

  // Corner button: zoom just this tile's photo.
  const zoomPhoto = (opt) => {
    setViewer({ photos: [opt.photo], title: answered ? opt.name : null, loading: false, startIndex: 0 });
  };

  // Corner button: browse iNat's other curated photos of this species.
  // `browseSeq` ids each request so a slow fetch for one tile can't fill a
  // viewer that has since been closed or reopened for a different tile.
  const browseSeq = useRef(0);
  const browseOther = async (opt) => {
    const seq = ++browseSeq.current;
    setViewer({ photos: [], title: answered ? opt.name : null, loading: true, startIndex: 0 });
    const photos = await fetchTaxonPhotos(opt.taxonId);
    setViewer((v) =>
      browseSeq.current === seq && v && v.loading
        ? { ...v, photos, loading: false }
        : v
    );
  };

  const gotIt =
    answered && round && round.options.find((o) => o.taxonId === picked)?.correct;

  // Just-in-time callout on a wrong pick for a pair the player keeps mixing up.
  // The pick is already recorded (onPick fires on tap, before this render), so
  // the count includes it — no +1, unlike the choice-mode screen.
  const chosenOpt = answered && !gotIt && round ? round.options.find((o) => o.taxonId === picked) : null;
  const correctOpt = answered && !gotIt && round ? round.options.find((o) => o.correct) : null;
  const confusionHint =
    chosenOpt && correctOpt && onConfusionCount
      ? (() => {
          const ck = String(correctOpt.taxonId);
          const chk = String(chosenOpt.taxonId);
          if ((onConfusionCount(ck, chk) || 0) < CONFUSION_HINT_MIN) return null;
          return {
            pairKey: pairKey(ck, chk),
            count: onConfusionCount(ck, chk),
            a: { name: correctOpt.name, sci: null, image: correctOpt.photo },
            b: { name: chosenOpt.name, sci: null, image: chosenOpt.photo },
          };
        })()
      : null;

  return (
    <View
      testID="pick-screen"
      style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}
    >
      {/* E2E only: exposes the correct tile's taxonId so tests can tap it. */}
      {IS_E2E && round && (
        <View
          testID="e2e-pick-answer"
          accessibilityLabel={String(round.options.find((o) => o.correct)?.taxonId)}
          style={styles.e2eHidden}
          pointerEvents="none"
        />
      )}
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable testID="pick-end" onPress={onQuit} hitSlop={12} style={styles.endBtn}>
          <Icon name="x" size={18} color={colors.muted} />
          <Text style={styles.quit}>End</Text>
        </Pressable>
        <Text style={styles.counter}>
          {index + 1} / {total}
        </Text>
        <View style={styles.rightGroup}>
          {onToggleFlag && (
            <Pressable
              testID="pick-flag"
              onPress={onToggleFlag}
              hitSlop={10}
              disabled={!round}
              accessibilityRole="button"
              accessibilityLabel={flagged ? 'Unflag species' : 'Flag species'}
              style={styles.flagBtn}
            >
              <Icon
                name={flagged ? 'flag' : 'flag-outline'}
                size={18}
                color={flagged ? colors.flag : colors.muted}
              />
            </Pressable>
          )}
          <View style={styles.scoreStat}>
            <Icon name="star" size={15} color={colors.primaryDark} />
            <Text style={styles.score}>{correctCount}</Text>
          </View>
        </View>
      </View>

      {/* Prompt */}
      <Text style={styles.label}>Which one is</Text>
      <Text style={styles.name}>{round ? round.name : '…'}</Text>

      {/* Body */}
      {loading || !round ? (
        <View style={styles.center}>
          {error ? (
            <>
              <Icon name="alert-triangle" size={28} color={colors.muted} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable testID="pick-skip" style={styles.skipBtn} onPress={onNext}>
                <Text style={styles.skipText}>Skip</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Finding look-alikes…</Text>
            </>
          )}
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {round.options.map((opt) => {
              const isPicked = opt.taxonId === picked;
              const reveal = answered && (opt.correct || isPicked);
              return (
                <View key={opt.taxonId} style={styles.tileWrap}>
                  <Pressable
                    testID={`pick-tile-${opt.taxonId}`}
                    style={styles.tile}
                    disabled={answered}
                    onPress={() => pick(opt)}
                  >
                    <Image
                      source={{ uri: opt.photo }}
                      style={styles.tileImg}
                      resizeMode="cover"
                    />
                    {reveal && (
                      <View
                        style={[
                          styles.tileOverlay,
                          opt.correct ? styles.tileCorrect : styles.tileWrong,
                        ]}
                      >
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: opt.correct ? colors.correct : colors.wrong },
                          ]}
                        >
                          <Icon
                            name={opt.correct ? 'check' : 'x'}
                            size={26}
                            color={colors.onDark}
                          />
                        </View>
                      </View>
                    )}

                    {/* Corner buttons — outside the pick target. Tapping these
                        opens a viewer rather than selecting the tile. */}
                    <Pressable
                      style={[styles.corner, styles.cornerTL]}
                      hitSlop={6}
                      onPress={() => zoomPhoto(opt)}
                    >
                      <Icon name="maximize-2" size={15} color={colors.onDark} />
                    </Pressable>
                    <Pressable
                      style={[styles.corner, styles.cornerTR]}
                      hitSlop={6}
                      onPress={() => browseOther(opt)}
                    >
                      <Icon name="grid" size={15} color={colors.onDark} />
                    </Pressable>
                  </Pressable>

                  {/* Species name, revealed after answering. */}
                  {answered && (
                    <Text
                      style={[
                        styles.tileName,
                        opt.correct && styles.tileNameCorrect,
                      ]}
                      numberOfLines={2}
                    >
                      {opt.name}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Feedback + next */}
          <View style={styles.footer}>
            {answered ? (
              <>
                <View style={styles.feedbackRow}>
                  <Icon
                    name={gotIt ? 'check-circle' : 'x-circle'}
                    size={18}
                    color={gotIt ? colors.correct : colors.wrong}
                  />
                  <Text
                    style={[
                      styles.feedback,
                      { color: gotIt ? colors.correct : colors.wrong },
                    ]}
                  >
                    {gotIt ? 'Correct!' : 'Not quite'}
                  </Text>
                </View>
                {confusionHint && onCompare && (
                  <Pressable
                    testID="pick-confusion-hint"
                    style={styles.confusionHint}
                    onPress={() => onCompare(confusionHint)}
                  >
                    <Icon name="repeat" size={15} color={colors.wrong} />
                    <Text style={styles.confusionHintText} numberOfLines={2}>
                      You keep mixing these up — see them side by side
                    </Text>
                    <Icon name="chevron-right" size={16} color={colors.wrong} />
                  </Pressable>
                )}
                <Pressable testID="pick-next" style={styles.nextBtn} onPress={onNext}>
                  <Text style={styles.nextText}>Next</Text>
                  <Icon name="arrow-right" size={18} color={colors.onPrimary} />
                </Pressable>
              </>
            ) : (
              <Text style={styles.hint}>Tap the matching photo</Text>
            )}
          </View>
        </>
      )}

      <PhotoViewer
        visible={!!viewer}
        photos={viewer ? viewer.photos : []}
        title={viewer ? viewer.title : null}
        loading={viewer ? viewer.loading : false}
        startIndex={viewer ? viewer.startIndex : 0}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  e2eHidden: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0.01 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  endBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, width: 80 },
  quit: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  counter: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rightGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, width: 80, justifyContent: 'flex-end' },
  flagBtn: { alignItems: 'center', justifyContent: 'center' },
  scoreStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  score: { color: colors.text, fontSize: 16, fontWeight: '800' },

  label: { textAlign: 'center', color: colors.muted, fontSize: 15, fontWeight: '600' },
  name: {
    textAlign: 'center',
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 20,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { color: colors.muted, fontSize: 15 },
  errorText: { color: colors.muted, fontSize: 15, textAlign: 'center', paddingHorizontal: 20 },

  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'center',
  },
  tileWrap: { width: '48.5%', marginBottom: 14 },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.faint,
  },
  tileImg: { width: '100%', height: '100%' },
  tileOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileCorrect: { borderWidth: 4, borderColor: colors.correct, backgroundColor: 'rgba(63,157,82,0.25)' },
  tileWrong: { borderWidth: 4, borderColor: colors.wrong, backgroundColor: 'rgba(217,83,79,0.25)' },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerTL: { top: 8, left: 8 },
  cornerTR: { top: 8, right: 8 },
  tileName: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
  },
  tileNameCorrect: { color: colors.correct, fontWeight: '800' },

  footer: { minHeight: 90, justifyContent: 'center' },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 15, fontWeight: '600' },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  feedback: { fontSize: 18, fontWeight: '800' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
  },
  confusionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.wrong,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  confusionHintText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  nextText: { color: colors.onPrimary, fontSize: 17, fontWeight: '800' },
  skipBtn: { paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.faint },
  skipText: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
