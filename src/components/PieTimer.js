// A small pie-style countdown indicator: a filled disc that depletes clockwise
// over `duration` ms, then fires `onComplete`. Used in Speedrun to show how long
// the photo stays up before the choices appear.
//
// Built with the classic SVG "fat stroke" trick: a circle whose stroke width is
// twice its path radius has its stroke reach all the way to the centre, so it
// reads as a solid pie wedge — and animating strokeDashoffset sweeps the wedge
// without recomputing an arc path every frame.

import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function PieTimer({
  size = 34,
  duration = 3000,
  color = '#FFFFFF',
  trackColor = 'rgba(255,255,255,0.25)',
  ringColor = 'rgba(255,255,255,0.9)',
  onComplete,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const center = size / 2;
  const r = size / 4; // wedge path radius; stroke (2r) spans the full disc
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false, // SVG props can't be driven natively
    });
    anim.start(({ finished }) => {
      if (finished && onComplete) onComplete();
    });
    return () => anim.stop();
    // Mount-once: the parent remounts this (via key) for each new card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 0 → full disc, circumference → empty: the wedge depletes as time runs out.
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circumference],
  });

  return (
    <View style={[styles.shadow, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle cx={center} cy={center} r={r} stroke={trackColor} strokeWidth={r * 2} fill="none" />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={r * 2}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </G>
        {/* Crisp outline so it still reads as a clock/pie once mostly depleted. */}
        <Circle cx={center} cy={center} r={center - 1} stroke={ringColor} strokeWidth={1.5} fill="none" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});
