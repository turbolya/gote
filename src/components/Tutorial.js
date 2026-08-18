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
//   • The backdrop never swallows touches. The point of the spotlight is that
//     the user taps the real control through it, and someone who wants to go
//     somewhere else entirely must not be trapped by a tutorial.
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
const POLL_MS = 120;

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
  const [size, setSize] = useState(null); // measured bubble
  const fade = useRef(new Animated.Value(0)).current;
  // Which step we have already scrolled for. Once on arrival, not continuously:
  // the user must stay free to scroll away again. Keyed by step rather than by
  // anchor, because two steps can point at the same row.
  const scrolledFor = useRef(null);

  // Re-measure the current target. Cleared between steps so a stale rect from
  // the previous step can never be drawn under the new one's bubble.
  useEffect(() => {
    setRect(null);
    scrolledFor.current = null;
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
        setRect((prev) =>
          prev && prev.x === x && prev.y === y && prev.width === width && prev.height === height
            ? prev
            : { x, y, width, height }
        );
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

  // A fresh step measures over a frame or two; fading in covers the reflow that
  // would otherwise read as the bubble jumping into place.
  useEffect(() => {
    setSize(null);
    fade.setValue(0);
  }, [stepId, fade]);
  // Only the bubble's own height is unknown; once it has laid out, the
  // placement is final and can be faded in.
  const ready = current.mode === 'step' && !!size;
  useEffect(() => {
    if (ready) Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [ready, fade]);

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

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="tutorial-overlay">
      {/* The dim, with the target punched out of it. pointerEvents none on the
          wrapper as well as the Svg: the whole point is that the highlighted
          control is still tappable through the hole. */}
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
