// A photo that shows the gote spinner while it downloads.
//
// One place owns the spinner asset so every screen animates the same newt, and
// so the GIF is decoded ONCE per launch (see SpinnerWarmup below) rather than
// on first use — a cold decode is why the very first card of a round used to
// sit on a black screen with no spinner at all.
//
// Deliberately NOT used for thumbnails (Lexicon rows, per-species tables, the
// detail photo strip): those are small, load fast, and a spinner in a 40pt box
// reads as noise rather than feedback.

import React, { useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';

// The single source of truth for the spinner artwork. StudyScreen imports this
// too — it keeps its own persistent overlay because its photo layer remounts
// per card, but the asset must stay the same one so it shares the decode.
export const SPINNER_GIF = require('../../assets/gote-spinner.gif');

// The newt animation is 119 frames at 144x144 — lovely, but several megabytes
// once decoded, and that first decode is not instant. It used to mean the very
// first card of a round sat on a plain black screen with no feedback at all
// while the GIF was still being prepared.
//
// So the spinner is two-stage: a native ActivityIndicator draws immediately
// (zero decode), and the newt takes over the moment it's ready. Once the GIF
// has loaded ANYWHERE it stays ready for the rest of the launch — tracked
// module-wide so later spinners skip straight to the newt with no flicker.
let gifReady = false;

/**
 * @param scrim  draw a dark chip behind the newt. The artwork is white, which
 *               is invisible on the near-white placeholder fills photos sit on
 *               in the light theme — screens with their own dark backdrop
 *               (study, fullscreen viewer) leave this off.
 */
export function Spinner({ size = 44, color = '#FFFFFF', scrim = false }) {
  const [ready, setReady] = useState(gifReady);
  return (
    <View
      style={[
        { width: size, height: size },
        styles.center,
        scrim && [styles.scrim, { borderRadius: size / 2 }],
      ]}
    >
      {!ready && <ActivityIndicator color={color} />}
      <Image
        source={SPINNER_GIF}
        // Kept mounted (just hidden) before it's ready, so it actually loads —
        // it's the onLoad below that flips this over to the newt.
        style={ready ? { width: size, height: size } : styles.hiddenSpinner}
        resizeMode="contain"
        onLoad={() => {
          gifReady = true;
          setReady(true);
        }}
      />
    </View>
  );
}

// Start decoding the GIF up front. Mounted once on the menu (the launchpad for
// every round), so the newt is usually ready before a photo ever asks for it.
// Invisible and unmeasured: absolutely positioned with zero opacity, so it
// can't affect any layout.
export function SpinnerWarmup() {
  return (
    <Image
      source={SPINNER_GIF}
      style={styles.warmup}
      resizeMode="contain"
      pointerEvents="none"
      accessible={false}
    />
  );
}
// NB: the warm-up deliberately does NOT set `gifReady`. Its onLoad fires long
// before an invisible copy can actually paint frames, and trusting it made the
// first spinner skip the ActivityIndicator and then render a GIF that was still
// decoding — so nothing at all appeared, which is the bug this all exists to
// fix. Only a real, visible Spinner's onLoad may flip the flag.

/**
 * An <Image> with a centred spinner until it has loaded.
 *
 * `style` sizes/positions the wrapper (as it would the image), and the image
 * fills it — so call sites can swap <Image> for <LoadingImage> in place.
 *
 * @param spinnerSize  px; shrink it for smaller frames so it never crowds them
 */
export default function LoadingImage({
  source,
  style,
  imageStyle,
  resizeMode = 'cover',
  spinnerSize = 44,
  onLoad,
  onError,
  ...rest
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    // overflow:hidden so a borderRadius passed in `style` still clips the photo.
    <View style={[style, styles.wrap]}>
      <Image
        source={source}
        style={[StyleSheet.absoluteFill, imageStyle]}
        resizeMode={resizeMode}
        onLoad={(e) => {
          setLoaded(true);
          if (onLoad) onLoad(e);
        }}
        // A failed load hides the spinner too — otherwise a broken photo spins
        // forever, which reads as "still working" when nothing is coming.
        onError={(e) => {
          setFailed(true);
          if (onError) onError(e);
        }}
        {...rest}
      />
      {!loaded && !failed && (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {/* scrim: these photos sit on pale placeholder fills in the light
              theme, where the white newt would otherwise vanish. */}
          <Spinner size={spinnerSize} scrim />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  warmup: { position: 'absolute', width: 56, height: 56, opacity: 0 },
  // Loading but not yet drawable: out of flow and invisible, so the
  // ActivityIndicator beside it is what the player sees.
  hiddenSpinner: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.38)' },
});
