// "Verify the fix": once a pair is a systematic mix-up (confusions.js
// nemesisPartners), gote seeds the old look-alike back in as a distractor when
// one of the two comes up, then counts consecutive correct answers on that pair.
// A clean run is proof the confusion is fixed — and motivating to show ("you
// used to mix these up — now you're N in a row"). No storage, no React, so
// scripts/test-verify.js can exercise it directly.
//
// Streaks are keyed by confusions.js pairKey and reset the moment the pair is
// missed again (recorded alongside the confusion, in App.recordConfusion), so
// the counter only ever reflects an unbroken recovery run.

// Show the recovery callout once the run reaches this. With the old look-alike
// on screen every time, this is a real re-test, not incidental exposure.
export const VERIFY_STREAK_MIN = 3;

// Current unbroken run of correct answers on a pair (0 if none/missed since).
export function verifyStreak(wins, pairKey) {
  const w = wins && typeof wins === 'object' ? wins : {};
  const n = Number(w[pairKey]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// A correct answer on the pair: extend the run by one (returns a new map).
export function recordVerifyWin(wins, pairKey) {
  const w = { ...(wins && typeof wins === 'object' ? wins : {}) };
  if (!pairKey) return w;
  w[pairKey] = verifyStreak(w, pairKey) + 1;
  return w;
}

// A miss on the pair: the fix isn't holding — drop the run (returns a new map).
export function recordVerifyMiss(wins, pairKey) {
  const w = { ...(wins && typeof wins === 'object' ? wins : {}) };
  if (pairKey && pairKey in w) delete w[pairKey];
  return w;
}

// Whether a run is long enough to celebrate.
export function shouldCelebrateVerify(streak, min = VERIFY_STREAK_MIN) {
  return Number(streak) >= min;
}
