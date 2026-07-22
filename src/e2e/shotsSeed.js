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

// A believable accuracy history: overall improvement, but genuinely uneven.
// A plain rising line + small independent noise reads as synthetic, and worse,
// independent noise AVERAGES OUT — so the trend line (a running average) comes
// out almost perfectly smooth. Four ingredients fix that:
//
//   • learning curve — quick early gains that flatten, not a straight ramp
//   • form (AR(1) walk) — multi-game slumps and hot streaks. Being CORRELATED
//     across games, this is what actually moves the running average, giving the
//     trend line visible ups and downs
//   • per-round jitter — small decks and luck swing an individual game a lot,
//     so the bars vary sharply
//   • occasional outliers — the odd disastrous round or near-perfect run
//
// The form walk is deliberately PERSISTENT (0.92 ⇒ slumps lasting ~12 games
// rather than ~5). The trend chart's y-axis is a fixed 0–100, so a running
// average that only wobbles by a fraction of a point is invisible; sustained
// slumps are what actually push it down a visible amount. These constants and
// seed were picked by sweeping for the best combination of a real dip in the
// trend line (~4 points), plenty of direction changes, and a clear overall
// rise (~19 points).
function buildHistory() {
  const rand = rng(0x5eed);
  const out = [];
  let form = 0;
  for (let i = 0; i < GAMES; i++) {
    const t = GAMES > 1 ? i / (GAMES - 1) : 1;
    const skill = 64 + 30 * (1 - Math.exp(-2.8 * t));
    form = form * 0.92 + (rand() - 0.5) * 18; // mean-reverting, so it wanders
    const jitter = (rand() - 0.5) * 20;
    let v = skill + form + jitter;
    const r = rand();
    if (r < 0.05) v -= 22 + rand() * 18; // a bad day
    else if (r > 0.975) v = Math.max(v, 95 + rand() * 5); // a great one
    out.push(Math.max(0, Math.min(100, Math.round(v))));
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
  // shows an impressive-but-believable answered count.
  //
  // The RATE is derived from the history's mean rather than the species sums,
  // so the hero's "X% lifetime accuracy" lands on the same number the trend
  // line ends at — the Statistics caption literally describes that line as the
  // running lifetime accuracy, so the two disagreeing is the kind of detail
  // that makes seeded data look fake.
  const meanPct =
    history.reduce((a, b) => a + b, 0) / (history.length || 1);
  const extra = 380 + Math.round(sumAttempts * 0.6);
  const answered = sumAttempts + extra;
  const correct = Math.min(answered, Math.round(answered * (meanPct / 100)));
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
