// Screenshot data seeder. Active ONLY in screenshot builds (EXPO_PUBLIC_SHOTS=1,
// see testMode.js) — never in the e2e or production bundles.
//
// The App Store screenshots are captured from the *live* app + real account, so
// a fresh install has no gameplay history: the menu hero is empty, the accuracy
// chart is blank, and Statistics shows "play a few rounds". This plants a
// realistic body of stats on first launch so the marketing shots look like a
// well-used account:
//   • a full, upward-trending per-game accuracy history  → busy hero chart
//   • a big-but-plausible lifetime score                 → "88% · 1100/1250"
//   • a per-species breakdown keyed to the REAL deck's   → real thumbnails, and
//     taxon ids                                            it passes the default
//                                                           "My observations" filter
//   • an active multi-day streak
//
// It's deterministic (fixed-seed PRNG) so every relaunch during a capture run
// shows identical numbers, and it persists to AsyncStorage so the normal restore
// path hydrates the same data on subsequent relaunches. A one-time marker keeps
// it from regenerating (and from clobbering the real round the test then plays).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveSpeciesStats, saveStats, saveHistory, saveStreak } from '../storage';

// Marker is per-username: the capture run briefly loads the default account
// before switching to the real one, and the per-species stats must key to the
// account actually shown (else the default "My observations" filter hides them).
// Keying the marker by username re-seeds when the account switches, but skips
// regenerating on a plain relaunch of the same account.
const MARKER = (username) => `@gote/shotsSeeded:${username || '?'}`;

// How many species to plant a breakdown for (capped so the list is long but the
// per-species thumbnails still all resolve from the deck).
const MAX_SPECIES = 40;
// How many past games to plant — comfortably more than fit the hero, so it
// downsamples the whole "lifetime" instead of showing a half-empty chart.
const GAMES = 90;

// Small deterministic PRNG (mulberry32) → stable numbers across relaunches.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Local calendar-day key (matches storage.js's dayKey format).
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Build a per-species tally map keyed by real deck taxon ids. Each species gets a
// plausible number of attempts and an accuracy drawn so most are strong but a few
// are weak (so the Statistics board shows both teal and red rows).
function buildSpecies(deckCards) {
  const cards = (deckCards || [])
    .filter((c) => c && c.taxonId != null)
    .slice(0, MAX_SPECIES);
  const species = {};
  let sumKnown = 0;
  let sumAttempts = 0;
  for (const c of cards) {
    const rand = rng(0x5eed ^ Number(c.taxonId));
    const attempts = 4 + Math.floor(rand() * 34); // 4..37 tries
    const r = rand();
    let acc;
    if (r < 0.15) acc = 0.2 + rand() * 0.35; // weak: 20–55%  → red rows
    else if (r < 0.35) acc = 0.55 + rand() * 0.2; // middling: 55–75%
    else acc = 0.78 + rand() * 0.22; // strong: 78–100%
    const known = Math.round(attempts * acc);
    const missed = attempts - known;
    species[String(c.taxonId)] = {
      name: c.common || c.scientific,
      sci: c.scientific || c.common || '',
      known,
      missed,
      image: c.image || null,
    };
    sumKnown += known;
    sumAttempts += missed + known;
  }
  return { species, sumKnown, sumAttempts };
}

// A rising accuracy history: an improving learner climbing from ~55% to ~92%
// with game-to-game noise, so the hero bars fill the width and the trend line
// slopes up.
function buildHistory() {
  const rand = rng(0xc0ffee);
  const out = [];
  for (let i = 0; i < GAMES; i++) {
    const t = GAMES > 1 ? i / (GAMES - 1) : 1;
    const base = 55 + t * 37; // 55 → 92
    const noise = (rand() - 0.5) * 18; // ±9
    out.push(Math.max(0, Math.min(100, Math.round(base + noise))));
  }
  return out;
}

// Seed realistic stats once per account. Returns the seeded values (to hydrate
// app state) or null if this account was already seeded on this install.
export async function seedScreenshotStats(deckCards, username) {
  const marker = MARKER(username);
  try {
    if (await AsyncStorage.getItem(marker)) return null; // already seeded
  } catch {
    /* fall through and seed */
  }

  const { species, sumKnown, sumAttempts } = buildSpecies(deckCards);
  const history = buildHistory();

  // Lifetime totals: the per-species attempts plus a chunk of extra volume for
  // "past decks / Nearby rounds" (species not in the current deck), so the hero
  // shows an impressive-but-believable answered count at a strong overall rate.
  const extra = 380 + Math.round(sumAttempts * 0.6);
  const answered = sumAttempts + extra;
  const correct = Math.min(answered, sumKnown + Math.round(extra * 0.9));
  const lifetime = { answered, correct };

  // Active streak: counted today (shows as a live "done" streak), with a longer
  // personal best behind it.
  const streak = { current: 12, longest: 21, lastActiveDay: todayKey() };

  await saveSpeciesStats(species);
  await saveStats(lifetime);
  await saveHistory(history);
  await saveStreak(streak);
  try {
    await AsyncStorage.setItem(marker, '1');
  } catch {
    /* best-effort */
  }

  return { species, lifetime, history, streak };
}
