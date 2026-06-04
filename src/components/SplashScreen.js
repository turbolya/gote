// Branded launch splash: a stylized newt over the iNaturalist-green background
// with the "göte" wordmark. Drawn with react-native-svg (vector, crisp at any
// size). Shown on top of the app at startup, then fades out via `onDone`.

import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import { colors } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const ART = Math.min(SCREEN_W * 0.5, 220);

// A simple, friendly newt silhouette: curved body + tail, four legs, a head
// with an eye and a couple of crest dots. Viewbox 0..100.
function Newt({ size, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* tail + body: one flowing stroke-like filled path */}
      <Path
        d="M14 70
           C 8 64, 10 56, 18 56
           C 26 56, 28 64, 36 62
           C 46 59, 52 50, 64 49
           C 78 48, 88 53, 90 44
           C 92 36, 84 33, 78 38
           C 84 40, 80 45, 74 43
           C 64 40, 58 47, 48 50
           C 40 52, 34 50, 30 48
           C 20 44, 12 50, 12 60
           C 12 66, 13 69, 14 70 Z"
        fill={color}
      />
      {/* rounded belly to give the body weight */}
      <Ellipse cx="40" cy="55" rx="20" ry="9" fill={color} />
      {/* head */}
      <Ellipse cx="74" cy="42" rx="12" ry="9" fill={color} />
      {/* legs */}
      <Path d="M30 62 l-5 12 4 1 6-11 Z" fill={color} />
      <Path d="M44 60 l2 13 4-1 -2-12 Z" fill={color} />
      <Path d="M58 55 l6 11 3-3 -5-10 Z" fill={color} />
      <Path d="M24 56 l-8 8 2 3 9-7 Z" fill={color} />
      {/* eye (background color punched out) */}
      <Circle cx="78" cy="40" r="2.4" fill={colors.primary} />
      {/* crest dots along the back */}
      <Circle cx="36" cy="46" r="1.8" fill={colors.primary} />
      <Circle cx="46" cy="46" r="1.8" fill={colors.primary} />
      <Circle cx="56" cy="46" r="1.8" fill={colors.primary} />
    </Svg>
  );
}

export default function SplashScreen({ onDone }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }).start(({ finished }) => finished && onDone && onDone());
    }, 1100);
    return () => clearTimeout(t);
  }, [opacity, onDone]);

  return (
    <Animated.View style={[styles.root, { opacity }]} pointerEvents="none">
      <Newt size={ART} color={colors.onDark} />
      <Text style={styles.word}>göte</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  word: {
    marginTop: 20,
    fontSize: 52,
    fontWeight: '900',
    color: colors.onDark,
    letterSpacing: 1,
  },
});
