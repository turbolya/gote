// Wraps a screen so a swipe-right from the left edge navigates back. Uses an
// EDGE swipe (see gestures.js) so it never steals horizontal gestures from page
// content like the Nearby radius slider or map. Pass `onBack` (a no-op/disabled
// when null) — the gesture only commits when there's somewhere to go.
//
// onBack/enabled are read through refs so the parent can pass fresh handlers
// each render without rebuilding the PanResponder.

import React, { useRef } from 'react';
import { View, PanResponder, Platform } from 'react-native';
import { isBackSwipe, backSwipeCommitted } from '../gestures';
import { IS_E2E } from '../e2e/testMode';

export default function SwipeBackView({ onBack, enabled = true, style, children }) {
  const cbRef = useRef(onBack);
  cbRef.current = onBack;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const responder = useRef(
    PanResponder.create({
      // Don't claim taps; only decide on move so children handle touches normally.
      onMoveShouldSetPanResponder: (_evt, g) => {
        // Disabled under E2E so it can't interfere with Detox's synthetic drags.
        // And on Android, where the system's own edge-swipe back is the same
        // gesture from the same edge (App.js wires it to the same targets via
        // BackHandler) — two recognisers for one swipe would double-navigate.
        if (IS_E2E || Platform.OS === 'android' || !cbRef.current || !enabledRef.current) return false;
        return isBackSwipe(g);
      },
      onPanResponderRelease: (_evt, g) => {
        if (cbRef.current && enabledRef.current && backSwipeCommitted(g)) {
          cbRef.current();
        }
      },
    })
  ).current;

  return (
    <View style={style} {...responder.panHandlers}>
      {children}
    </View>
  );
}
