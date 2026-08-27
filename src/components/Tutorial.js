// The tutorial's on-screen half: a dimmed backdrop with a hole cut around the
// thing being described, and a bubble beside it.
//
// Three pieces, all in one file because they only make sense together:
//   TutorialProvider — holds the anchor registry and advances on navigation
//   useAnchorRef     — how a screen offers an element as a target
//   TutorialOverlay  — the drawing, rendered once per root in App.js
//
// Everything about WHAT to show lives in src/tutorial.js and src/tutorialtext.js.
// This file measures, animates and draws — nothing here decides the tour.
//
// Two deliberate properties:
//   • A step is MODAL. Everything except the spotlight is sealed off, so the
//     step cannot be side-stepped by tapping something else or by scrolling the
//     page out from under it. The hole stays live — tapping the real control is
//     how an action step advances — and Exit sits in the bubble, so sealing the
//     screen never traps anyone.
//     This replaced a pass-everything backdrop. That version kept the user free
//     to wander, but it also let them get lost behind a tour that was still
//     pointing at a screen they had left. `waiting` (a slim, deliberately
//     UNSEALED bar) is the honest way to be non-blocking: it only appears once
//     the user is somewhere the tour is not.
//   • The bubble is placed from a MEASURED anchor and a MEASURED bubble, so it
//     lands correctly on a 320pt phone and on an iPad without a special case.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Animated,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { useTheme, useThemedStyles } from '../theme';
import {
  view as tutorialView,
  placeBubble,
  spotlight,
  blockers,
  bubbleWidth,
  onScreen,
  advance,
  doneState,
  scrollDelta,
  ARROW,
} from '../tutorial';
import { UI_TEXT } from '../tutorialtext';

// How often an active step re-measures its target.
//
// The anchor moves for reasons this overlay cannot subscribe to: a list
// scrolling, the menu's hero collapsing, the keyboard pushing a field up. One
// measureInWindow on one node, only while a coach mark is up, is cheaper than
// wiring scroll handlers through every screen — and it cannot be defeated by a
// screen that moves its content some new way later.
//
// Roughly a frame, not a leisurely tick, because the hole in the dim is also
// the only live part of the screen. Whatever lag this leaves is a stretch where
// the spotlight is drawn where the target USED TO BE and the seal covers where
// it now is — so a tap on the thing the step is asking for gets swallowed. That
// window opens every time the tour scrolls a target into view, which is exactly
// when the user is most likely to reach for it.
const POLL_MS = 32;

const DIM = 'rgba(0,0,0,0.66)';

const TutorialContext = createContext(null);

// --- provider ----------------------------------------------------------------

export function TutorialProvider({ screen, state, onChange, children }) {
  // Anchors are refs to live native nodes, so they belong in a ref: registering
  // one must not re-render the app, and a re-render must not lose them.
  const anchors = useRef(new Map());
  // The scrollable list on the screen currently up, if it offered itself (see
  // useTutorialScroller). One slot, not a map: only one screen is ever showing.
  const scroller = useRef(null);

  const register = useCallback((id, node) => {
    if (!id) return;
    if (node) anchors.current.set(id, node);
    else if (anchors.current.get(id) !== undefined) anchors.current.delete(id);
  }, []);

  // Advance on navigation. Read through a ref and depend on `screen` ALONE: one
  // arrival must satisfy at most one step. Depending on `state` too would chain
  // through any later steps waiting on the same screen, silently skipping them.
  const stateRef = useRef(state);
  stateRef.current = state;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  useEffect(() => {
    const next = onScreen(stateRef.current, screen);
    if (next !== stateRef.current) changeRef.current(next);
  }, [screen]);

  const value = useMemo(
    () => ({ screen, state, onChange, anchors, scroller, register }),
    [screen, state, onChange, register]
  );
  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

// A ref callback that offers this element to the tour as `id`.
//
//   <Pressable ref={useAnchorRef('mode-smart')} … />
//
// Safe with no id and safe outside a provider (the watch target and the e2e
// fixtures render screens without one), in both cases returning a ref that does
// nothing — a screen must never have to know whether a tour is running.
export function useAnchorRef(id) {
  const ctx = useContext(TutorialContext);
  const register = ctx && ctx.register;
  return useCallback(
    (node) => {
      if (register) register(id, node);
    },
    [register, id]
  );
}

// A screen's main scrollable list, offered to the tour so it can bring an
// off-screen target into view before pointing at it.
//
//   useTutorialScroller((dy) => ref.current.scrollTo({ y: offset.current + dy }));
//
// The screen supplies the scrolling because only it knows its own current
// offset; the tour supplies the "how far", from a measurement. As with
// useAnchorRef, this is inert outside a provider.
export function useTutorialScroller(scrollBy) {
  const ctx = useContext(TutorialContext);
  const latest = useRef(scrollBy);
  latest.current = scrollBy;
  useEffect(() => {
    if (!ctx) return undefined;
    const call = (dy) => {
      if (typeof latest.current === 'function') latest.current(dy);
    };
    ctx.scroller.current = call;
    return () => {
      // Only clear our own registration: a screen mounting before this one
      // unmounts must not have its scroller wiped by our cleanup.
      if (ctx.scroller.current === call) ctx.scroller.current = null;
    };
  }, [ctx]);
}

// --- overlay -----------------------------------------------------------------

export function TutorialOverlay() {
  const ctx = useContext(TutorialContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const screenSize = useWindowDimensions();

  const state = ctx && ctx.state;
  const current = ctx ? tutorialView(state, ctx.screen) : { mode: 'off' };
  const anchorId = current.mode === 'step' ? current.anchor : null;
  const stepId = current.mode === 'step' ? current.id : null;

  const [rect, setRect] = useState(null);
  // The bubble's own height, from its onLayout. Deliberately NOT cleared
  // between steps: the previous step's height is a good enough estimate to
  // place this one, and onLayout fires only when the layout actually CHANGES —
  // so clearing it would make every step depend on a callback that a bubble of
  // the same height is entitled to skip. Carried, `placed` can only be null
  // before the overlay's very first layout, which onLayout always delivers.
  const [size, setSize] = useState(null);
  const fade = useRef(new Animated.Value(0)).current;
  // Which step we have already scrolled for. Once on arrival, not continuously:
  // the user must stay free to scroll away again. Keyed by step rather than by
  // anchor, because two steps can point at the same row.
  const scrolledFor = useRef(null);
  // Whether the target is still travelling — see `sealed` below. Mirrored in a
  // ref so the measure loop can read it without being rebuilt on every change.
  const rectRef = useRef(null);
  const movingRef = useRef(false);
  const [moving, setMoving] = useState(false);

  // Re-measure the current target. Cleared between steps so a stale rect from
  // the previous step can never be drawn under the new one's bubble.
  useEffect(() => {
    setRect(null);
    rectRef.current = null;
    scrolledFor.current = null;
    movingRef.current = false;
    setMoving(false);
    if (!anchorId || !ctx) return undefined;
    let alive = true;
    const measure = () => {
      const node = ctx.anchors.current.get(anchorId);
      if (!node || typeof node.measureInWindow !== 'function') return;
      node.measureInWindow((x, y, width, height) => {
        if (!alive || !(width > 0)) return;
        // Bring it into view the first time this step is measured — the tour
        // points at rows that start below the fold on a first launch.
        if (scrolledFor.current !== stepId && ctx.scroller.current) {
          scrolledFor.current = stepId;
          const dy = scrollDelta({ x, y, width, height }, screenSize, insets);
          if (dy) ctx.scroller.current(dy);
        }
        const prev = rectRef.current;
        if (prev && prev.x === x && prev.y === y && prev.width === width && prev.height === height) {
          // Two identical measurements in a row: it has come to rest.
          if (movingRef.current) {
            movingRef.current = false;
            setMoving(false);
          }
          return;
        }
        rectRef.current = { x, y, width, height };
        if (!movingRef.current) {
          movingRef.current = true;
          setMoving(true);
        }
        setRect(rectRef.current);
      });
    };
    measure();
    const timer = setInterval(measure, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // ctx.screen matters: the same anchor id can be re-registered by a new
    // screen, and the old node would measure at a stale position.
  }, [anchorId, stepId, ctx && ctx.screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Each step fades in. Reset AND start in the same effect, keyed on the step,
  // so the two can never come apart — becoming visible is not conditional on
  // anything.
  //
  // It used to be: this effect cleared the fade, and a SECOND one started it
  // once the bubble had been measured. The start half therefore hung off
  // onLayout — which fires only when a layout actually changes, and a bubble
  // that lands at the same size and place as the one before it is entitled not
  // to change. Any step where that measurement did not arrive got the clear
  // without the start: dim, spotlight ring and bubble all left at opacity 0
  // with the step still current. A tour that is running and completely
  // invisible is the worst state this component has, so nothing that makes it
  // visible may depend on a measurement arriving.
  useEffect(() => {
    fade.setValue(0);
    const a = Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [stepId, fade]);

  const confirmExit = useCallback(() => {
    Alert.alert(UI_TEXT.confirmTitle, UI_TEXT.confirmBody, [
      { text: UI_TEXT.confirmKeep, style: 'cancel' },
      {
        text: UI_TEXT.confirmExit,
        style: 'destructive',
        onPress: () => ctx && ctx.onChange(doneState()),
      },
    ]);
  }, [ctx]);

  if (!ctx || current.mode === 'off') return null;

  // Waiting on a screen the user is not on: a slim bar, not a blocker.
  if (current.mode === 'waiting') {
    return (
      <View style={styles.waitWrap} pointerEvents="box-none">
        <View
          testID="tutorial-waiting"
          style={[styles.waitBar, { marginBottom: Math.max(insets.bottom, 10) }]}
        >
          <Icon name="school-outline" size={16} color={colors.onPrimary} />
          <Text style={styles.waitText} numberOfLines={2}>
            {current.text}
          </Text>
          <Pressable
            testID="tutorial-exit"
            onPress={confirmExit}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={UI_TEXT.exit}
            style={styles.waitClose}
          >
            <Icon name="close" size={16} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    );
  }

  const width = bubbleWidth(screenSize, insets);
  const spot = spotlight(rect, screenSize);
  const placed = size
    ? placeBubble({ anchor: rect, bubble: { width, height: size.height }, screen: screenSize, insets })
    : null;
  const { title, body } = current.text || {};

  // Seal the screen off around the spotlight — but only when the step has a way
  // forward that the seal leaves reachable. A step with a target keeps that
  // target tappable; a step with no target but a button is advanced from the
  // bubble. A step with NEITHER (a target that has scrolled away or not measured
  // yet, on a step whose only exit is tapping the real control) is left open on
  // purpose: sealing it would leave Exit as the only move.
  //
  // Gated on the bubble having a place to be, which is the invariant that
  // matters: BLOCKING WITHOUT VISIBLE INSTRUCTIONS IS NEVER CORRECT. Until the
  // overlay has laid out once there is no height to place a bubble from, and an
  // ungated seal would block the screen while nothing at all is drawn, which
  // reads as the app having frozen. Worst on a CTA step, where there is no
  // spotlight to hint at what is going on.
  //
  // Never while the target is still travelling, either. The hole is drawn from
  // the last measurement, so for those frames it sits where the target WAS and
  // the band covers where it now IS — and the one control the step is asking
  // the user to tap does nothing. That window opens every time the tour scrolls
  // a target into view, which is precisely when someone is reaching for it.
  const sealed = !!placed && !moving && (!!spot || !!current.cta);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="tutorial-overlay">
      {/* The dim, with the target punched out of it. Drawing only — it is the
          bands below, not this layer, that decide what can be touched. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} pointerEvents="none">
        <Svg width={screenSize.width} height={screenSize.height}>
          <Defs>
            <Mask id="tutorialHole" x="0" y="0" width={screenSize.width} height={screenSize.height}>
              <Rect x="0" y="0" width={screenSize.width} height={screenSize.height} fill="#fff" />
              {!!spot && (
                <Rect
                  x={spot.x}
                  y={spot.y}
                  width={spot.width}
                  height={spot.height}
                  rx={spot.radius}
                  ry={spot.radius}
                  fill="#000"
                />
              )}
            </Mask>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={screenSize.width}
            height={screenSize.height}
            fill={DIM}
            mask="url(#tutorialHole)"
          />
          {!!spot && (
            <Rect
              x={spot.x}
              y={spot.y}
              width={spot.width}
              height={spot.height}
              rx={spot.radius}
              ry={spot.radius}
              fill="none"
              stroke={colors.primary}
              strokeWidth={2}
            />
          )}
        </Svg>
      </Animated.View>

      {/* The seal. Separate views around the hole rather than one full-screen
          view with the spotlight cut out, because a cut-out exists only in the
          SVG mask — masks do not affect hit testing, so a single layer would
          block the very control the step is asking the user to tap.

          Claiming the responder on START blocks taps; claiming it on MOVE, and
          refusing to hand it back, blocks the drag a ScrollView underneath would
          otherwise read as a scroll. Rendered before the bubble so the bubble's
          own Exit/Next buttons stay above the seal. */}
      {sealed &&
        blockers(spot, screenSize).map((b) => (
          <View
            key={`${b.x}:${b.y}:${b.width}:${b.height}`}
            testID="tutorial-block"
            style={{ position: 'absolute', left: b.x, top: b.y, width: b.width, height: b.height }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
          />
        ))}

      <Animated.View
        testID="tutorial-bubble"
        onLayout={(e) => {
          const { height } = e.nativeEvent.layout;
          setSize((prev) => (prev && Math.abs(prev.height - height) < 1 ? prev : { height }));
        }}
        style={[
          styles.bubble,
          {
            width,
            left: placed ? placed.left : 0,
            top: placed ? placed.top : 0,
            // Laid out off-screen-ish until measured, rather than flashing at
            // the wrong place for a frame.
            opacity: placed ? fade : 0,
          },
        ]}
      >
        {!!placed && !!placed.arrow && (
          <View
            style={[
              styles.arrow,
              placed.arrow.dir === 'up'
                ? { top: -ARROW, borderBottomColor: colors.card }
                : { bottom: -ARROW, borderTopColor: colors.card },
              placed.arrow.dir === 'up' ? styles.arrowUp : styles.arrowDown,
              { left: placed.arrow.x - ARROW },
            ]}
          />
        )}

        <Text style={styles.progress} testID="tutorial-progress">
          {current.progress}
        </Text>
        <Text style={styles.title} testID="tutorial-title">
          {title}
        </Text>
        <Text style={styles.body} testID="tutorial-body">
          {body}
        </Text>

        <View style={styles.actions}>
          <Pressable
            testID="tutorial-exit"
            onPress={confirmExit}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.exitBtn, pressed && styles.pressed]}
          >
            <Text style={styles.exitText}>{UI_TEXT.exit}</Text>
          </Pressable>
          {!!current.cta && (
            <Pressable
              testID="tutorial-next"
              onPress={() => ctx.onChange(advance(state))}
              accessibilityRole="button"
              style={({ pressed }) => [styles.nextBtn, pressed && styles.pressed]}
            >
              <Text style={styles.nextText}>{current.cta}</Text>
              <Icon name="chevron-right" size={16} color={colors.onPrimary} />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    bubble: {
      position: 'absolute',
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    // A CSS-triangle, so it needs no extra asset and inherits the card colour.
    arrow: {
      position: 'absolute',
      width: 0,
      height: 0,
      borderLeftWidth: ARROW,
      borderRightWidth: ARROW,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
    },
    arrowUp: { borderBottomWidth: ARROW },
    arrowDown: { borderTopWidth: ARROW },
    progress: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      color: colors.muted,
      marginBottom: 4,
    },
    title: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 4 },
    body: { fontSize: 14.5, lineHeight: 20, color: colors.text },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 14,
      gap: 12,
    },
    exitBtn: { paddingVertical: 6, paddingRight: 6 },
    exitText: { fontSize: 13.5, fontWeight: '600', color: colors.muted },
    nextBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      backgroundColor: colors.primary,
      paddingVertical: 9,
      paddingLeft: 16,
      paddingRight: 10,
      borderRadius: 999,
    },
    nextText: { fontSize: 14.5, fontWeight: '700', color: colors.onPrimary },
    pressed: { opacity: 0.7 },
    waitWrap: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    waitBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      maxWidth: 420,
      backgroundColor: colors.primaryDark,
      borderRadius: 999,
      paddingVertical: 9,
      paddingLeft: 14,
      paddingRight: 8,
      shadowColor: colors.shadow,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    waitText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: colors.onPrimary },
    waitClose: { padding: 4 },
  });
