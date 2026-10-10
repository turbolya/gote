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

import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';

// The single source of truth for the spinner artwork. StudyScreen imports this
// too — it keeps its own persistent overlay because its photo layer remounts
// per card, but the asset must stay the same one so it shares the decode.
export const SPINNER_GIF = require('../../assets/gote-spinner.gif');

// The same animation in the brand teal, for spinners that sit on the app's own
// background rather than on a photo — a white newt is invisible there in the
// light theme. It has to be a separate ASSET because iOS cannot tint an
// animated image: Image's tintColor templates one CGImage, and a GIF is a stack
// of them, so the tint silently does nothing. Regenerate it from the white one
// with scripts/tint-gif.swift.
export const SPINNER_GIF_TEAL = require('../../assets/gote-spinner-teal.gif');

// First frame of each GIF as a plain PNG (a few KB). The animated GIF takes a
// moment to decode, so the spinner shows this still the instant it mounts and
// lets the GIF take over once it can draw. Both start on the same frame, so the
// hand-over is invisible. Regenerate with the GIFs (frame 0 of each).
const SPINNER_STILL = require('../../assets/gote-spinner-still.png');
const SPINNER_STILL_TEAL = require('../../assets/gote-spinner-teal-still.png');

// The newt animation is 119 frames at 144x144 — lovely, but several megabytes
// once decoded, and that first decode is not instant. Waiting for it used to
// mean a plain black screen, and then a system spinner, before the newt turned
// up. The newt is a local asset, so it should be there at once.
//
// So the spinner is two-stage, and both stages are the newt: a still of the
// first frame (a tiny PNG, no decode to speak of) draws immediately, and the
// animated GIF takes over once THIS spinner's GIF has loaded. That is tracked
// per instance on purpose. A module-wide "the GIF has loaded somewhere" flag
// looks like a saving, but a GIF that loaded in one view has not necessarily
// painted in another one mounted a moment later — the later spinners skipped
// the still and showed an empty circle (four photo tiles, one newt).

/**
 * @param scrim  draw a dark chip behind the newt. The artwork is white, which
 *               is invisible on the near-white placeholder fills photos sit on
 *               in the light theme — screens with their own dark backdrop
 *               (study, fullscreen viewer) leave this off.
 * @param teal   use the brand-teal artwork instead of the white one. For
 *               spinners on the app's own background, where white is invisible
 *               in the light theme. Fixed at mount — nothing flips it.
 */
export function Spinner({ size = 44, scrim = false, teal = false }) {
  const [ready, setReady] = useState(false);
  // The still stays under the GIF for a beat after it loads: the GIF's onLoad
  // can fire a frame before it paints, and the artwork is transparent, so
  // dropping the still at once could flash an empty spinner. It must go in the
  // end, though — the GIF moves on from frame 0 and the still would show
  // through as a ghost.
  const [stillShown, setStillShown] = useState(true);
  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => setStillShown(false), 200);
    return () => clearTimeout(t);
  }, [ready]);
  const box = { width: size, height: size };
  return (
    <View
      style={[
        box,
        styles.center,
        scrim && [styles.scrim, { borderRadius: size / 2 }],
      ]}
    >
      {stillShown && (
        <Image
          source={teal ? SPINNER_STILL_TEAL : SPINNER_STILL}
          style={box}
          resizeMode="contain"
        />
      )}
      <Image
        source={teal ? SPINNER_GIF_TEAL : SPINNER_GIF}
        // Kept mounted (just hidden) before it's ready, so it actually loads —
        // it's the onLoad below that brings it in over the still.
        style={ready ? [styles.gifOver, box] : styles.hiddenSpinner}
        resizeMode="contain"
        onLoad={() => setReady(true)}
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
// NB: nothing here is allowed to mark a Spinner ready. An invisible copy's
// onLoad fires long before it can paint frames, and trusting it (or any other
// view's load) made a spinner show a GIF that was still decoding — so nothing
// at all appeared. Each Spinner waits for its own GIF, with the still showing.

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
  // Loading but not yet drawable: out of flow and invisible, so the still
  // beneath it is what the player sees.
  gifOver: { position: 'absolute' },
  hiddenSpinner: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.38)' },
});
