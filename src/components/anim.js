// Small shared animation helpers, so motion feels consistent across the app.
//
//   <Appear>            mount entrance: fade + slide up (+ optional scale),
//                       with an optional `delay` for staggering siblings.
//   <Pop trigger={x}>   a quick scale "pop" whenever `trigger` changes (skips
//                       the initial mount) — good for grade feedback / counters.
//   <AnimatedNumber>    a number that counts up to `value`.
//   animateNextLayout() smooth reflow for the next layout change (list re-sort).
//
// All of these collapse to a plain, un-animated render under E2E so detox never
// races a fade/slide (which would make visibility-based taps flaky).

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  Text,
  View,
} from 'react-native';
import { IS_E2E } from '../e2e/testMode';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Animate the next state-driven layout change (e.g. a list re-sorting/filtering).
export function animateNextLayout(duration = 240) {
  if (IS_E2E) return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      duration,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    )
  );
}

// Mount entrance: fade in while sliding up `offset`px (and optionally scaling up
// from `scaleFrom`). `delay` staggers siblings.
export function Appear({
  children,
  delay = 0,
  offset = 12,
  duration = 320,
  scaleFrom,
  style,
  pointerEvents,
}) {
  const t = useRef(new Animated.Value(IS_E2E ? 1 : 0)).current;
  useEffect(() => {
    if (IS_E2E) return;
    const a = Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (IS_E2E) {
    return (
      <View style={style} pointerEvents={pointerEvents}>
        {children}
      </View>
    );
  }

  const transform = [
    { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
  ];
  if (scaleFrom != null) {
    transform.push({
      scale: t.interpolate({ inputRange: [0, 1], outputRange: [scaleFrom, 1] }),
    });
  }
  return (
    <Animated.View style={[style, { opacity: t, transform }]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

// A quick scale "pop" each time `trigger` changes value (skipping first mount).
export function Pop({ trigger, children, style, scale = 1.12, pointerEvents }) {
  const t = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (IS_E2E) return;
    t.setValue(0);
    Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.spring(t, { toValue: 0, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = t.interpolate({ inputRange: [0, 1], outputRange: [1, scale] });
  return (
    <Animated.View style={[style, { transform: [{ scale: s }] }]} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}

// A number that counts up to `value` on change.
export function AnimatedNumber({ value, duration = 700, style, format = (n) => String(n), testID }) {
  const [display, setDisplay] = useState(IS_E2E ? value : 0);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (IS_E2E) {
      setDisplay(value);
      return;
    }
    t.setValue(0);
    const id = t.addListener(({ value: v }) => setDisplay(v));
    const a = Animated.timing(t, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => {
      a.stop();
      t.removeListener(id);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Text style={style} testID={testID}>
      {format(Math.round(display))}
    </Text>
  );
}

// A bar whose width animates from 0 to `pct`% on mount (non-native — width isn't
// supported by the native driver). Used for the stats count bars growing in.
export function AnimatedBar({ pct, style }) {
  const t = useRef(new Animated.Value(IS_E2E ? 1 : 0)).current;
  useEffect(() => {
    if (IS_E2E) return;
    const a = Animated.timing(t, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const width = t.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct}%`] });
  return <Animated.View style={[style, { width }]} />;
}
