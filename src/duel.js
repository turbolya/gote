// Pure logic for the A/B duel drill — a focused two-choice mini-round pitting
// only the two look-alikes of a confused pair against each other, repeated until
// the player splits them reliably. No storage, no React, no photos: just which
// species to show next and when the drill is "won", so scripts/test-duel.js can
// exercise it directly. The React shell (src/screens/DuelScreen.js) owns photos,
// layout and timing.
//
// Pedagogy: a *blocked* drill on the exact contrast is the remediation for a
// systematic confusion (see gote-launch/TASKS.md). We keep it short and end it
// the moment the contrast is mastered, so it never turns into busywork.

// Correct answers in a row that count as "you can now tell them apart". With two
// choices, guessing gives 50% — a streak of 6 by luck is ~1.5%, so this is a
// real signal, not noise. Minimum length of a won drill is therefore 6.
export const DUEL_MASTERY_STREAK = 6;

// Hard cap so a struggling player's drill always ends (with encouragement, not
// mastery) rather than running forever.
export const DUEL_MAX_QUESTIONS = 20;

// Which species to show next ('a' | 'b'). Balanced ~50/50 via `rand`, but never
// three of the same in a row — otherwise the player can stop reading and just
// keep tapping the same name. `recent` is the list of targets shown so far.
export function nextTarget(recent, rand = Math.random) {
  const list = Array.isArray(recent) ? recent : [];
  const n = list.length;
  const last = list[n - 1];
  const prev = list[n - 2];
  // Two of the same already — force the other so runs never reach three.
  if (last && last === prev) return last === 'a' ? 'b' : 'a';
  return rand() < 0.5 ? 'a' : 'b';
}

// The current run of correct answers, counting back from the most recent.
// `answers` is an array of booleans (true = correct).
export function duelStreak(answers) {
  const a = Array.isArray(answers) ? answers : [];
  let s = 0;
  for (let i = a.length - 1; i >= 0; i--) {
    if (a[i]) s++;
    else break;
  }
  return s;
}

// Mastered once the current streak reaches the bar.
export function isMastered(answers, streak = DUEL_MASTERY_STREAK) {
  return duelStreak(answers) >= streak;
}

// The drill is over when the pair is mastered OR the question cap is hit.
export function duelDone(
  answers,
  { streak = DUEL_MASTERY_STREAK, max = DUEL_MAX_QUESTIONS } = {}
) {
  const a = Array.isArray(answers) ? answers : [];
  return isMastered(a, streak) || a.length >= max;
}

// End-of-drill summary for the result screen.
export function duelSummary(
  answers,
  { streak = DUEL_MASTERY_STREAK, max = DUEL_MAX_QUESTIONS } = {}
) {
  const a = Array.isArray(answers) ? answers : [];
  const total = a.length;
  const correct = a.filter(Boolean).length;
  return {
    total,
    correct,
    streak: duelStreak(a),
    mastered: isMastered(a, streak),
    goal: streak,
    max,
  };
}
