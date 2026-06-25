// Pure gesture-decision helpers, kept free of React Native so they can be unit
// tested in plain Node. The screen components wire these into PanResponders.

// Thresholds (exported so tests and components agree on the same numbers).
export const FLICK_DY = 110; // px of upward travel that commits a flick
export const FLICK_VY = 0.6; // or this upward flick velocity

// Should an upward drag be claimed as a flick?
export function isUpwardFlick(dx, dy) {
  return dy < -24 && Math.abs(dy) > Math.abs(dx) * 2;
}

// Decide the outcome of releasing an upward flick in the photo viewer.
// Returns 'grid' (back to grid), 'close' (close viewer), or 'cancel'.
export function flickOutcome({ dy, vy }, viewer) {
  const committed = dy < -FLICK_DY || vy < -FLICK_VY;
  if (!committed) return "cancel";
  if (viewer && viewer.mode === "zoom" && viewer.fromGrid) return "grid";
  return "close";
}

// Swipe-right-from-the-left-edge to go back (the iOS-style back gesture). It's
// an EDGE swipe so it never fights horizontal content in the page body (sliders,
// maps, horizontal scrollers): the touch must start near the left edge.
export const SWIPE_EDGE = 28; // px from the left edge the gesture must start in
export const SWIPE_CLAIM_DX = 14; // px of rightward travel before we claim it
export const SWIPE_COMMIT_DX = 80; // px of travel that commits the back
export const SWIPE_COMMIT_VX = 0.35; // or this rightward fling velocity

// Should a move be claimed as a back-swipe? Must start at the left edge and be a
// clear rightward, horizontal-dominant drag (so vertical scrolling is unaffected).
export function isBackSwipe({ x0, dx, dy }) {
  return (
    x0 <= SWIPE_EDGE &&
    dx > SWIPE_CLAIM_DX &&
    Math.abs(dx) > Math.abs(dy) * 1.5
  );
}

// On release, does the swipe commit the back navigation (enough travel or a
// quick rightward fling)?
export function backSwipeCommitted({ dx, vx }) {
  return dx > SWIPE_COMMIT_DX || vx > SWIPE_COMMIT_VX;
}
