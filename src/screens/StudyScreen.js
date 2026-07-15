// The quiz screen. Two grading styles:
//   • self-grade (default): flip the card, then tap "I knew it" / "Missed it".
//   • multiple choice (choiceMode): pick the right name from 5 options (the
//     answer + 4 alternatives); the app grades it for you. Used by the "All
//     cards" and "Nearby species" modes.
//
// The screen background is a blurred, darkened version of the current card's
// photo, so the whole screen subtly takes on the colors of what you're looking
// at. All chrome is light over that dark backdrop.

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  Platform,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import PhotoViewer from '../components/PhotoViewer';
import ObservationMap from '../components/ObservationMap';
import PieTimer from '../components/PieTimer';
import { Appear, Pop } from '../components/anim';
import { shuffle, fetchTaxonPhotos, toLargePhoto } from '../api';
import { prefetchUpcoming } from '../prefetch';
import { pickSimilarDistractors } from '../quiz';
import { colors } from '../theme';
import { SPEEDRUN_LIVES, SPEEDRUN_VIEW_MS } from '../constants';
import { IS_E2E } from '../e2e/testMode';

const NUM_CHOICES = 5;
const ON_DARK = '#FFFFFF';
const ON_DARK_DIM = 'rgba(255,255,255,0.78)';
const DOUBLE_TAP_MS = 280;

// Dark gradient behind the chrome — darker than before so white UI stays
// readable even over bright/washed-out photos. Strong at the edge, fading to
// transparent toward the photo center.
const TOP_GRADIENT = ['rgba(0,0,0,0.75)', 'rgba(0,0,0,0)'];
const BOTTOM_GRADIENT = ['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)'];
const cardName = (c) => (c ? c.common || c.scientific : '');

export default function StudyScreen({
  deck,
  index,
  loopNonce = 0,
  correctCount,
  roundLabel,
  speedrun = false,
  lives = SPEEDRUN_LIVES,
  choiceMode = false,
  choicePool = [],
  flags,
  onToggleFlag,
  onGrade,
  onQuit,
}) {
  const insets = useSafeAreaInsets();
  const [flipped, setFlipped] = useState(false);
  // Multiple-choice phase: 'front' (photo) -> 'choosing' -> 'answered'.
  const [phase, setPhase] = useState('front');
  const [picked, setPicked] = useState(null);
  const card = deck[index];
  const answer = cardName(card);
  const flagged = !!(card && flags && flags.has(String(card.taxonId)));

  // Reset flip/phase *during render* (not in an effect) whenever the displayed
  // card changes, so a fresh card never shows the previous card's revealed
  // state for a frame. Keyed on card identity, plus `loopNonce` so a Speedrun
  // reshuffle onto the same (e.g. single-card) deck still counts as a new card.
  const shownKey = `${loopNonce}:${index}:${card ? card.id : ''}`;
  const [prevKey, setPrevKey] = useState(shownKey);
  if (prevKey !== shownKey) {
    setPrevKey(shownKey);
    setFlipped(false);
    setPhase('front');
    setPicked(null);
  }

  // Build the multiple-choice options: the correct name plus taxonomically
  // similar distractors (same genus → family → order → …, widening only as
  // needed). De-duplicated by display name so two options never read alike.
  const choices = useMemo(() => {
    if (!choiceMode || !card) return [];
    const distractorCards = pickSimilarDistractors(
      card,
      choicePool,
      NUM_CHOICES * 3 // over-fetch, then trim after de-duping by name
    );
    const names = [];
    const usedNames = new Set([answer]);
    for (const c of distractorCards) {
      const n = cardName(c);
      if (usedNames.has(n)) continue;
      usedNames.add(n);
      names.push(n);
      if (names.length >= NUM_CHOICES - 1) break;
    }
    return shuffle([answer, ...names]);
  }, [choiceMode, card, choicePool, answer]);

  const progress = (index + 1) / deck.length;

  // While viewing the current card, warm the native image cache with the next
  // few cards so transitions are instant and the bytes are reused next time.
  useEffect(() => {
    prefetchUpcoming(deck, index, 3);
  }, [deck, index]);

  const pick = (name) => {
    if (phase === 'answered') return;
    setPicked(name);
    setPhase('answered');
  };

  // --- fullscreen self-grade photo state ---
  const [gallery, setGallery] = useState(card ? [card.image] : []);
  const [fetched, setFetched] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [imgError, setImgError] = useState(false);
  // Whether the main photo has finished loading — the Speedrun countdown only
  // starts once the picture is actually on screen (a failed load counts too, so
  // a broken image can't stall the round).
  const [imgLoaded, setImgLoaded] = useState(false);
  const [viewer, setViewer] = useState(null); // { photos, startIndex } | null
  const [mapOpen, setMapOpen] = useState(false); // observation-location map modal
  const lastTapRef = useRef(0);

  // Press-and-hold the bare photo to "peek": the answer overlay (choices /
  // species name / grade buttons) slides up and out while held, then slides back
  // on release — so the panel never permanently hides the picture behind it.
  // Only the uncovered parts of the image trigger it: the buttons are Pressables
  // that capture their own touches, so this never fires on (or disables) them.
  const peekAnim = useRef(new Animated.Value(0)).current; // 0 = shown, 1 = hidden
  const setPeek = (hidden) => {
    Animated.timing(peekAnim, {
      toValue: hidden ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  // Reset the photo state when the displayed card changes (same render-time
  // guard as flip/phase above, keyed on card identity).
  const [photoKey, setPhotoKey] = useState(shownKey);
  if (photoKey !== shownKey) {
    setPhotoKey(shownKey);
    setGallery(card ? [card.image] : []);
    setFetched(false);
    setLoadingMore(false);
    setImgError(false);
    setImgLoaded(false);
    setViewer(null);
    setMapOpen(false);
  }

  // Speedrun: once the photo is ready, count down SPEEDRUN_VIEW_MS, then reveal
  // the choices automatically. A broken image (imgError) counts as "ready" so a
  // failed load can't freeze the round. Disabled in E2E so tests drive the pace.
  const photoReady = imgLoaded || imgError;
  const speedrunTiming =
    speedrun && choiceMode && phase === 'front' && photoReady && !IS_E2E;
  // While guessing in Speedrun, the photo is hidden — it only "flashed" for the
  // countdown — so the choices test recall. It returns once the answer is shown.
  const hidePhoto = speedrun && phase === 'choosing';

  // Open the fullscreen zoom viewer on the current photo (used by double-tap).
  const openZoom = () => {
    setViewer({ photos: gallery.map(toLargePhoto), startIndex: 0 });
  };

  // Tapping the photo never reveals/flips the card — that's only done by the
  // "Reveal answer" button. (Tapping/flipping here was being triggered by
  // swipes, toggling the name on and off.) A double-tap still zooms.
  const onPhotoTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      openZoom();
    } else {
      lastTapRef.current = now;
    }
  };

  // Fetch curated photos once, then open the swipeable viewer.
  const showMorePhotos = async () => {
    if (loadingMore) return;
    if (fetched) {
      setViewer({ photos: gallery.map(toLargePhoto), startIndex: 0 });
      return;
    }
    setLoadingMore(true);
    const extra = await fetchTaxonPhotos(card.taxonId);
    const merged = [...new Set([card.image, ...extra])];
    setGallery(merged);
    setFetched(true);
    setLoadingMore(false);
    setViewer({ photos: merged.map(toLargePhoto), startIndex: 0 });
  };

  // Chrome is always white over a dark gradient, so it stays legible on light
  // AND dark photos (no per-image adaptation).
  const on = ON_DARK;
  const onDim = ON_DARK_DIM;
  const trackBg = 'rgba(255,255,255,0.3)';

  // Photo responds only to double-tap (zoom) in both modes; revealing the
  // answer is done via the button, never by tapping/swiping the photo.
  const onPhotoPress = onPhotoTap;

  // Photo credit shown bottom-right (small print). Strip the leading "(c) " /
  // "(C) " since we render a © icon before it.
  const attribution = card && card.attribution
    ? card.attribution.replace(/^\(c\)\s*/i, '')
    : null;

  // Whether this observation has coordinates for the map pin (older cached cards
  // downloaded before this feature won't, and obscured/private ones may not).
  // The map (react-native-maps) needs a Google Maps key on Android, so the pin
  // is iOS-only for now.
  const hasGeo =
    !!card &&
    Number.isFinite(card.lat) &&
    Number.isFinite(card.lng) &&
    Platform.OS !== 'android';

  // Shared fullscreen scaffold: photo fills the screen, top gradient holds the
  // exit/progress/score chrome. Bottom content differs per mode.
  const answered = phase === 'answered';
  const gotIt = picked === answer;

  return (
    <View style={styles.fsRoot} testID="study-screen">
      {/* E2E only: exposes the current card's answer (via accessibilityLabel,
          not visible text) so tests can tap the correct choice deterministically. */}
      {IS_E2E && !!answer && (
        <View
          testID="e2e-answer"
          accessibilityLabel={answer}
          style={styles.e2eHidden}
          pointerEvents="none"
        />
      )}
      {/* Fullscreen photo. A blurred, darkened copy fills the whole screen
          (covering letterbox bars for wide/tall photos), with the full image
          shown on top in "contain" mode so no features are cropped off. */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onPhotoPress}
        // Press-and-hold any bare part of the photo to peek: the answer overlay
        // slides away while held (see centerArea), then returns on release.
        onPressIn={() => setPeek(true)}
        onPressOut={() => setPeek(false)}
      >
        {card && !imgError ? (
          // Keyed on the card so each new photo fades + settles in.
          <Appear
            key={shownKey}
            style={StyleSheet.absoluteFill}
            offset={0}
            scaleFrom={1.04}
            duration={300}
            pointerEvents="none"
          >
            <Image
              source={{ uri: card.image }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              blurRadius={30}
            />
            <View style={styles.fsBackdropScrim} />
            <Image
              source={{ uri: card.image }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            {/* Speedrun: cover the photo while guessing so it only "flashed". */}
            {hidePhoto && (
              <View style={[StyleSheet.absoluteFill, styles.hiddenPhoto]}>
                <Icon name="eye-off-outline" size={40} color="rgba(255,255,255,0.45)" />
              </View>
            )}
          </Appear>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fsFallback]}>
            <Icon name="image" size={48} color="rgba(255,255,255,0.5)" />
          </View>
        )}
      </Pressable>

      {/* Top gradient + chrome */}
      <LinearGradient
        colors={TOP_GRADIENT}
        style={[styles.topGrad, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.sideLeft}>
            <Pressable testID="study-end" onPress={onQuit} hitSlop={12} style={styles.endBtn}>
              <Icon name="x" size={18} color={onDim} />
              <Text style={[styles.quit, { color: onDim }]}>End</Text>
            </Pressable>
          </View>

          {speedrun ? (
            <View style={styles.centerStat}>
              <Icon name="zap" size={15} color={on} />
              <Text style={[styles.counter, { color: on }]}>{correctCount}</Text>
            </View>
          ) : (
            <Text style={[styles.counter, { color: on }]}>
              {index + 1} / {deck.length}
            </Text>
          )}

          <View style={styles.sideRight}>
            {card && onToggleFlag && (
              <Pressable
                testID="study-flag"
                onPress={() => onToggleFlag(card.taxonId)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={flagged ? 'Unflag species' : 'Flag species'}
                style={styles.flagBtn}
              >
                <Icon
                  name={flagged ? 'flag' : 'flag-outline'}
                  size={20}
                  color={on}
                />
              </Pressable>
            )}
            {speedrun ? (
              <Pop trigger={lives} scale={1.35} style={styles.lives}>
                {Array.from({ length: SPEEDRUN_LIVES }).map((_, i) => (
                  <Icon
                    key={i}
                    name="heart"
                    size={16}
                    color={i < lives ? on : onDim}
                    style={styles.heart}
                  />
                ))}
              </Pop>
            ) : (
              <View style={styles.centerStat}>
                <Icon name="star" size={15} color={on} />
                <Text style={[styles.score, { color: on }]}>{correctCount}</Text>
              </View>
            )}
          </View>
        </View>

        {!speedrun && (
          <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%`, backgroundColor: on },
              ]}
            />
          </View>
        )}
      </LinearGradient>

      {/* Speedrun countdown: small pie in the top-right corner. Keyed on the
          card so it remounts (and restarts) for each new photo. */}
      {speedrunTiming && (
        <View
          style={[styles.pieCorner, { top: insets.top + 56 }]}
          pointerEvents="none"
        >
          <PieTimer
            key={shownKey}
            size={36}
            duration={SPEEDRUN_VIEW_MS}
            color={ON_DARK}
            onComplete={() => setPhase('choosing')}
          />
        </View>
      )}

      {/* Active answer UI is CENTERED — away from the bottom button you just
          tapped — so a choice/grade button never lands under your finger.
          Slides up + fades out while the bare photo is held (peek). */}
      <Animated.View
        style={[
          styles.centerArea,
          { paddingTop: insets.top + 70, paddingBottom: insets.bottom + 84 },
          {
            opacity: peekAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              {
                translateY: peekAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -80],
                }),
              },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        {choiceMode
          ? phase !== 'front' && (
              <Appear style={styles.centerPanel} offset={14} scaleFrom={0.96} duration={300}>
                <Pop trigger={answered}>
                  <View style={styles.promptRow}>
                    {answered && (
                      <Icon
                        name={gotIt ? 'check-circle' : 'x-circle'}
                        size={16}
                        color={gotIt ? colors.correct : colors.wrong}
                      />
                    )}
                    <Text testID="study-prompt" style={[styles.prompt, { color: on }]} numberOfLines={1}>
                      {answered
                        ? gotIt
                          ? 'Correct!'
                          : `It was ${answer}`
                        : 'Which species is this?'}
                    </Text>
                  </View>
                </Pop>

                {choices.map((name, i) => {
                  const isAnswer = name === answer;
                  const isPicked = name === picked;
                  const showCorrect = answered && isAnswer;
                  const showWrong = answered && isPicked && !isAnswer;
                  return (
                    <Appear key={name} delay={i * 45} offset={8} duration={260}>
                      <Pressable
                        testID={`study-choice-${name}`}
                        disabled={answered}
                        onPress={() => pick(name)}
                        style={[
                          styles.choice,
                          showCorrect && styles.choiceCorrect,
                          showWrong && styles.choiceWrong,
                        ]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            { color: on },
                            (showCorrect || showWrong) && styles.choiceTextOn,
                          ]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                      </Pressable>
                    </Appear>
                  );
                })}

                {answered && (
                  <Appear offset={6} duration={240}>
                    <Pressable testID="study-next" style={styles.nextBtn} onPress={() => onGrade(gotIt)}>
                      <Text style={styles.nextText}>Next card</Text>
                      <Icon name="arrow-right" size={18} color={colors.onDark} />
                    </Pressable>
                  </Appear>
                )}
              </Appear>
            )
          : flipped && (
              // Self-grade reveal: the answer cross-dissolves + scales in over
              // the photo (press-and-hold the photo to peek back at it).
              <Appear style={styles.centerPanel} offset={0} scaleFrom={0.94} duration={300}>
                <Text
                  style={[
                    styles.speciesName,
                    { color: on },
                    !card.common && styles.speciesNameOnly,
                  ]}
                  numberOfLines={2}
                >
                  {card.common || card.scientific}
                </Text>
                {!!card.common && (
                  <Text style={[styles.speciesSci, { color: onDim }]} numberOfLines={1}>
                    {card.scientific}
                  </Text>
                )}
                <View style={styles.gradeRow}>
                  <Pressable
                    testID="study-grade-missed"
                    style={[styles.gradeButton, styles.missed]}
                    onPress={() => onGrade(false)}
                  >
                    <Icon name="x" size={20} color={ON_DARK} />
                    <Text style={styles.gradeText}>Missed it</Text>
                  </Pressable>
                  <Pressable
                    testID="study-grade-knew"
                    style={[styles.gradeButton, styles.knew]}
                    onPress={() => onGrade(true)}
                  >
                    <Icon name="check" size={20} color={ON_DARK} />
                    <Text style={styles.gradeText}>I knew it</Text>
                  </Pressable>
                </View>
              </Appear>
            )}
      </Animated.View>

      {/* Bottom gradient: only the Show/Reveal button (front state) + photo
          controls. The answer UI itself is centered, above. */}
      <LinearGradient
        colors={BOTTOM_GRADIENT}
        style={[styles.bottomGrad, { paddingBottom: insets.bottom + 10 }]}
        pointerEvents="box-none"
      >
        {choiceMode
          ? phase === 'front' && (
              <Pressable
                testID="study-reveal"
                style={[styles.revealBtn, { borderColor: on }]}
                onPress={() => setPhase('choosing')}
              >
                <Text style={[styles.revealText, { color: on }]}>Show choices</Text>
              </Pressable>
            )
          : !flipped && (
              <Pressable
                testID="study-reveal"
                style={[styles.revealBtn, { borderColor: on }]}
                onPress={() => setFlipped(true)}
              >
                <Text style={[styles.revealText, { color: on }]}>Reveal answer</Text>
              </Pressable>
            )}

        {/* Bottom corners: more-photos (BL) + photo attribution/license (BR) */}
        <View style={styles.cornerRow} pointerEvents="box-none">
          <Pressable
            onPress={showMorePhotos}
            disabled={loadingMore}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More photos of this species"
            style={styles.cornerBtn}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={on} />
            ) : (
              <Icon name="grid" size={20} color={on} />
            )}
          </Pressable>
          <View style={styles.bottomRight} pointerEvents="box-none">
            {!!attribution && (
              <View style={styles.attribution}>
                <Text style={[styles.attributionText, { color: onDim }]} numberOfLines={1}>
                  © {attribution}
                </Text>
              </View>
            )}
            {/* Map pin: opens a map showing where this observation was recorded.
                Only shown when the observation has (public/obscured) coords. */}
            {hasGeo && (
              <Pressable
                testID="study-location"
                onPress={() => setMapOpen(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Show observation location on a map"
                style={styles.locationBtn}
              >
                <Icon name="map-pin" size={20} color={on} />
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>

      <PhotoViewer
        visible={!!viewer}
        photos={viewer ? viewer.photos : []}
        title={
          (choiceMode ? answered : flipped)
            ? card.common || card.scientific
            : null
        }
        startIndex={viewer ? viewer.startIndex : 0}
        onClose={() => setViewer(null)}
      />

      {hasGeo && (
        <ObservationMap
          visible={mapOpen}
          lat={card.lat}
          lng={card.lng}
          placeGuess={card.placeGuess}
          // Hide the species name until the answer is revealed — otherwise the
          // map would give away what the player is supposed to guess.
          title={(choiceMode ? answered : flipped) ? card.common || card.scientific : null}
          onClose={() => setMapOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fsRoot: { flex: 1, backgroundColor: '#000' },
  e2eHidden: { position: 'absolute', top: 0, left: 0, width: 1, height: 1, opacity: 0.01 },
  fsBackdropScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  flagBtn: { alignItems: 'center', justifyContent: 'center' },
  fsFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1D1A' },
  // Speedrun: opaque cover over the photo while guessing (the photo only flashed).
  hiddenPhoto: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#13160F' },
  // Speedrun countdown pie, floated in the top-right corner.
  pieCorner: { position: 'absolute', right: 18, zIndex: 6 },

  // top gradient + chrome
  topGrad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sideLeft: { flex: 1, alignItems: 'flex-start' },
  sideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  endBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  quit: { fontSize: 16, fontWeight: '600' },
  centerStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counter: { fontSize: 16, fontWeight: '700' },
  score: { fontSize: 16, fontWeight: '800' },
  lives: { flexDirection: 'row', alignItems: 'center' },
  heart: { marginLeft: 3 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: 999 },

  // Centered answer overlay (choices / grade buttons).
  centerArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  centerPanel: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },

  // bottom gradient + chrome
  bottomGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  cornerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  cornerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  attribution: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  attributionText: { flexShrink: 1, fontSize: 11 },
  locationBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  // reveal / show-choices outline button
  revealBtn: {
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  revealText: { fontSize: 17, fontWeight: '800' },

  // self-grade
  speciesName: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  speciesNameOnly: { marginBottom: 14 },
  speciesSci: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 14,
  },
  gradeRow: { flexDirection: 'row', gap: 12 },
  gradeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 15,
  },
  missed: { backgroundColor: colors.wrong },
  knew: { backgroundColor: colors.correct },
  gradeText: { color: ON_DARK, fontSize: 17, fontWeight: '800' },

  // multiple choice (compact, no scroll)
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  prompt: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  choice: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  choiceCorrect: { backgroundColor: colors.correct, borderColor: colors.correct },
  choiceWrong: { backgroundColor: colors.wrong, borderColor: colors.wrong },
  choiceText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  choiceTextOn: { color: ON_DARK },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 4,
  },
  nextText: { color: colors.onDark, fontSize: 17, fontWeight: '800' },
});
