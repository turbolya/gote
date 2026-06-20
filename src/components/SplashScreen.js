// Branded launch splash: the gote newt logo (white on transparent, from
// assets/gote.png) centered over the brand-teal background. Shown on top of the
// app at startup, then fades out via `onDone`.

import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
// Logo footprint; the source is 651×798, so "contain" keeps it inside this box.
const ART = Math.min(SCREEN_W * 0.5, 220);

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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  logo: { width: ART, height: ART },
});
