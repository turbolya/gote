// Spaced-repetition input: the confusion signal as a first-class scheduler
// input. Sampled rounds (Custom / Flash) are biased so the player's unresolved
// mix-ups — and their look-alike partner, interleaved — resurface on their own,
// easing off as a pair gets fixed. No storage, no React (reads the confusion
// matrix + "verify the fix" recovery streaks), so scripts/test-schedule.js can
// exercise it directly.
//
// Pedagogy (see gote-launch/TASKS.md): the *blocked* contrast is the A/B duel;
// here we *interleave* the pair back into a mixed round to consolidate — so a
// due pair is pulled in, then shuffled among fresh cards rather than drilled
// back-to-back.

import { topConfusionPairs, pairKey, CONFUSION_HINT_MIN } from './confusions.js';
import { verifyStreak } from './verify.js';
import { speciesKey } from './mastery.js';

// The shared tally key ('' for an unusable card, so Map/Set lookups stay
// string-typed). Must match the key confusions are recorded under, or the
// spaced-repetition bias silently never finds the pairs it should resurface.
const keyOf = (c) => speciesKey(c) || '';

// Fisher–Yates with an injectable RNG (deterministic in tests).
function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// How overdue a pair is for re-testing: the confusion count drives it up, the
// current recovery streak damps it down (a pair you've since gotten right a few
// times stops nagging — the recency-weighting the spec calls for). 0 = not due.
export function pairPriority(count, streak) {
  const c = Number(count) || 0;
  const s = Math.max(0, Number(streak) || 0);
  return c > 0 ? c / (1 + s) : 0;
}

// The player's mix-up pairs ranked by SR priority (most overdue first). Each
// entry carries the pairKey + both species keys so the deck builder can pull
// both members in. This is the confusion signal, as the scheduler consumes it.
export function dueConfusionPairs(confusions, wins, { min = CONFUSION_HINT_MIN } = {}) {
  return topConfusionPairs(confusions, { min, limit: 100 })
    .map((p) => {
      const pk = pairKey(p.a, p.b);
      const streak = verifyStreak(wins, pk);
      return { a: p.a, b: p.b, pairKey: pk, count: p.count, streak, priority: pairPriority(p.count, streak) };
    })
    .filter((p) => p.priority > 0)
    .sort(
      (x, y) =>
        y.priority - x.priority ||
        (x.pairKey < y.pairKey ? -1 : x.pairKey > y.pairKey ? 1 : 0)
    );
}

// Build a round of up to `size` cards from `pool`, biased so unresolved mix-ups
// resurface: up to `reserveFraction` of the round is reserved for the most-
// overdue pairs (both members when present in the pool), the rest is filled at
// random, and the whole thing is shuffled so the pair sits *inside* a mixed
// round. Degrades to a plain random sample when there are no due pairs, so new
// players (and pools without the confused species) are unaffected.
export function scheduleDeck(
  pool,
  { confusions = {}, wins = {}, size, min = CONFUSION_HINT_MIN, reserveFraction = 0.4, rng = Math.random } = {}
) {
  const cards = Array.isArray(pool) ? pool.slice() : [];
  const n = Math.max(0, Math.floor(Number(size)) || 0);
  // Pool fits in the round (or a degenerate size): nothing to prioritise.
  if (n <= 0 || cards.length <= n) return shuffle(cards, rng);

  // First card seen per species — the one a due pair pulls in.
  const byKey = new Map();
  for (const c of cards) {
    const k = keyOf(c);
    if (k && !byKey.has(k)) byKey.set(k, c);
  }

  // Chosen CARDS, not chosen species. Keying the round by species collapsed
  // every observation of a species into one slot, so with "one card per
  // species" turned off a pool of 30 photos of 8 species dealt an 8-card round
  // when 20 were asked for — and the setting did nothing at all here.
  const chosen = [];
  const taken = new Set(); // the card objects already dealt
  const take = (c) => {
    if (!c || taken.has(c) || chosen.length >= n) return;
    taken.add(c);
    chosen.push(c);
  };
  const reserve = Math.max(0, Math.min(n, Math.floor(n * reserveFraction)));
  // Reserve slots for the most-overdue pairs — both members when the pool has
  // them, so the pair is re-tested together.
  for (const p of dueConfusionPairs(confusions, wins, { min })) {
    if (chosen.length >= reserve) break;
    for (const key of [p.a, p.b]) take(byKey.get(String(key)));
  }

  // Fill the remainder with a random sample of everything else.
  for (const c of shuffle(cards, rng)) {
    if (chosen.length >= n) break;
    take(c);
  }

  return shuffle(chosen, rng);
}
