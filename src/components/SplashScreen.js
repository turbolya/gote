// Branded launch splash: the gote newt logo (white on transparent, from
// assets/gote.png) centered over the brand-teal background. Shown on top of the
// app at startup, then fades out via `onDone`.

import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Logo footprint; the source is 651×798, so "contain" keeps it inside this box.
//
// 200 is not a free choice: it must equal `imageWidth` in app.json's
// expo-splash-screen config, because the NATIVE splash underneath draws the
// same artwork in a 200×200 box with the same aspect fit. Match them and the
// handover from the native splash to this one is invisible; let them drift and
// the logo visibly jumps size at launch (it did — the native side was on the
// plugin's 100pt default, so a small newt appeared before this big one).
const ART = 200;

export default function SplashScreen({ onDone, onLayout }) {
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
    <Animated.View
      style={[styles.root, { opacity }]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      <Image
        source={require('../../assets/gote.png')}
        style={styles.logo}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  logo: { width: ART, height: ART },
});
