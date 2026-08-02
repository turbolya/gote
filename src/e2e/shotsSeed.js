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
import {
  saveSpeciesStats,
  saveStats,
  saveHistory,
  saveStreak,
  saveConfusions,
  saveConfusionNote,
} from '../storage';
import { pairKey } from '../confusions';
import { historyTotals } from '../accuracy';

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

// Number of shared leading ancestors two taxa need before they count as
// believable look-alikes. ancestry is ordered kingdom→…→species, so a longer
// shared prefix means closer kin (shared family beats shared order beats shared
// class). Require at least a shared class (≈3) so we never pair, say, a wasp
// with an ivy just because the deck lists them next to each other.
const MIN_SHARED_ANCESTRY = 3;

// A "your tell" note that fits the pair's group, so the seeded note reads
// naturally whatever the top look-alikes turn out to be (the deck is the real
// account's, so we can't hardcode a species-specific tell).
function tellFor(iconic) {
  switch (iconic) {
    case 'Aves':
      return 'The bill is my tell — longer and all-dark on one, paler at the base on the other.';
    case 'Insecta':
    case 'Arachnida':
      return 'It’s the markings — the banding pattern is what finally set them apart for me.';
    case 'Fungi':
      return 'The cap and gills give it away once you look closely — that’s my tell.';
    case 'Mammalia':
      return 'The ears and muzzle shape are what set these two apart for me.';
    case 'Reptilia':
    case 'Amphibia':
      return 'The head shape and the markings down the back are the giveaway.';
    case 'Plantae':
      return 'The leaf edges are the giveaway — one’s toothed, the other smooth.';
    default:
      return 'Side by side the overall shape is subtly different — that’s what makes it click.';
  }
}

// A handful of "you mix these up" pairs from the real deck's taxon ids, so the
// Statistics "Species you mix up" list, the side-by-side comparison and the A/B
// duel drill all have real content (thumbnails + names) in the screenshots.
// Pairs are chosen as genuine look-alikes — taxonomically close species within
// the same iconic group, closest kin first — so the marketing shots show pairs a
// person would actually confuse, not two unrelated organisms. Counts are all >=
// the floor (3) so every pair surfaces, split across both directions so they
// read as mutual mix-ups.
function buildConfusions(deckCards) {
  // Same candidate set as buildSpecies (first MAX_SPECIES with an image), so
  // every pair also has a per-species tally — StatsScreen only renders a pair
  // when both taxa are in the breakdown.
  const cards = (deckCards || [])
    .filter((c) => c && c.taxonId != null && c.image)
    .slice(0, MAX_SPECIES);
  const counts = [6, 5, 4, 4, 3, 3];

  // Shared-ancestry depth between two cards (closer kin = deeper shared prefix).
  const sharedDepth = (a, b) => {
    const aa = a.ancestry || [];
    const ba = b.ancestry || [];
    let n = 0;
    while (n < aa.length && n < ba.length && aa[n] === ba[n]) n++;
    return n;
  };
  // All same-group candidate pairs that clear the floor, ranked closest-first.
  const ranked = [];
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].iconic && cards[j].iconic && cards[i].iconic !== cards[j].iconic) continue;
      const depth = sharedDepth(cards[i], cards[j]);
      if (depth < MIN_SHARED_ANCESTRY) continue;
      ranked.push({ i, j, depth });
    }
  }
  ranked.sort((x, y) => y.depth - x.depth);

  // Greedily take the closest disjoint pairs. If the deck yields too few real
  // look-alikes, top up with leftover consecutive cards so the list is never
  // short (rare, but keeps the screenshots populated).
  const used = new Set();
  const chosen = [];
  const take = (ci, cj) => {
    used.add(ci);
    used.add(cj);
    chosen.push([cards[ci], cards[cj]]);
  };
  for (const c of ranked) {
    if (chosen.length >= counts.length) break;
    if (used.has(c.i) || used.has(c.j)) continue;
    take(c.i, c.j);
  }
  for (let i = 0; chosen.length < counts.length && i + 1 < cards.length; i++) {
    if (used.has(i)) continue;
    let j = i + 1;
    while (j < cards.length && used.has(j)) j++;
    if (j < cards.length) take(i, j);
  }

  const confusions = {};
  const add = (from, to, n) => {
    if (n <= 0) return;
    confusions[from] = { ...(confusions[from] || {}), [to]: n };
  };
  const pairs = [];
  chosen.forEach(([ca, cb], idx) => {
    const a = String(ca.taxonId);
    const b = String(cb.taxonId);
    const n = counts[idx];
    const ab = Math.ceil(n / 2);
    add(a, b, ab); // shown a, chose b
    add(b, a, n - ab); // shown b, chose a
    pairs.push([a, b]);
  });
  // Group-appropriate "your tell" note for the top (most-confused) pair.
  const note = chosen.length ? tellFor(chosen[0][0].iconic) : null;
  return { confusions, pairs, note };
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
// Round SIZES come out of the same generator, because every aggregate over this
// chart is weighted by them (src/accuracy.js) — seeding percentages alone would
// leave the screenshots exercising a code path real users never hit. Sizes
// mirror how the app is actually played: mostly the Custom picker's default 16,
// a spread of shorter and longer rounds around it, and the occasional one-or-two
// card round abandoned early — precisely the kind that must NOT swing the trend.
function buildHistory() {
  const rand = rng(0x5eed);
  const out = [];
  const counts = [];
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
    const s = rand();
    if (s < 0.06) counts.push(1 + Math.floor(rand() * 2)); // barely started
    else if (s > 0.88) counts.push(30 + Math.floor(rand() * 25)); // a long session
    else counts.push(10 + Math.floor(rand() * 12));
  }
  return { history: out, counts };
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
  const { history, counts: historyCounts } = buildHistory();
  const { confusions, pairs, note } = buildConfusions(deckCards);

  // Lifetime totals: the per-species attempts plus a chunk of extra volume for
  // "past decks / Nearby rounds" (species not in the current deck), so the hero
  // shows an impressive-but-believable answered count.
  //
  // The RATE is derived from the history rather than the species sums, so the
  // hero's "X% lifetime accuracy" lands on the same number the trend line ends
  // at — the Statistics caption literally describes that line as the running
  // lifetime accuracy, so the two disagreeing is the kind of detail that makes
  // seeded data look fake. CARD-weighted, matching how the line is drawn.
  const totals = historyTotals(history, historyCounts);
  const meanPct = totals.answered > 0 ? (totals.correct / totals.answered) * 100 : 0;
  const extra = 380 + Math.round(sumAttempts * 0.6);
  const answered = sumAttempts + extra;
  const correct = Math.min(answered, Math.round(answered * (meanPct / 100)));
  const lifetime = { answered, correct };

  // Active streak: counted today (shows as a live "done" streak), with a longer
  // personal best behind it.
  const streak = { current: 12, longest: 21, lastActiveDay: todayKey() };

  await saveSpeciesStats(species);
  await saveStats(lifetime);
  await saveHistory(history, historyCounts);
  await saveStreak(streak);
  await saveConfusions(confusions);
  // A "your tell" note on the top pair, so the comparison shows a real note and
  // the Statistics row reads "Your tell ✓". The text fits the pair's group.
  if (pairs.length && note) {
    await saveConfusionNote(pairKey(pairs[0][0], pairs[0][1]), note);
  }
  try {
    await AsyncStorage.setItem(marker, '1');
  } catch {
    /* best-effort */
  }

  return { species, lifetime, history, historyCounts, streak, confusions };
}
