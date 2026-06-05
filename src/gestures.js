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
