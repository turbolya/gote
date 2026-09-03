// Tiny persistence layer over the device's key-value store: remembers the last
// username and keeps a running lifetime score (answered / correct).
//
// Goes through src/kv.js rather than AsyncStorage directly, so a Node test can
// swap in an in-memory backend and exercise this file (see src/kv.js).

import * as kv from './kv';

const K_USER = '@gote/username';
const K_STATS = '@gote/stats';
const K_PREFS = '@gote/prefs';
const K_SPECIES = '@gote/species';
// Confusion matrix: which species the player systematically mixes up. Keyed by
// the correct species → the wrongly-chosen species → count. See src/sync/merge.js
// (addConfusion / mergeConfusions) for the shape and the (future) sync fold.
const K_CONFUSIONS = '@gote/confusions';
// Per-pair "my tell" notes the player writes to distinguish two look-alikes,
// keyed by src/confusions.js pairKey → free text.
const K_CONFUSION_NOTES = '@gote/confusionNotes';
// "Verify the fix" recovery streaks: pairKey → consecutive correct answers on a
// former-nemesis pair (reset on relapse). Device-local, like the notes.
const K_CONFUSION_WINS = '@gote/confusionWins';
const K_CACHE = '@gote/obscache';
const K_FLAGS = '@gote/flags';
// Guided-tour progress: { status: 'new' | 'running' | 'done', step: <index> }.
// Device-local and deliberately not synced — "have I been shown around THIS
// phone" is a property of the device, not of the account.
const K_TUTORIAL = '@gote/tutorial';
const K_ROUND_SETUP = '@gote/roundSetup';
// Lifetime totals split by which question format the answer was given in:
// { [format]: { answered, correct } }. Smart play asks the same species four
// different ways and they are not equally hard, so a single blended accuracy
// number stops being comparable with itself as the mix shifts. See
// src/smartmode.js and the DB v6 migration.
const K_FORMATS = '@gote/statsByFormat';
const K_HISTORY = '@gote/history';
// Cards per finished round, parallel to K_HISTORY and right-aligned with it (see
// src/accuracy.js alignCounts). Stored separately rather than folding the two
// into one array of objects, because `history` is also a sync wire format: a
// parallel array is an additive change an older client simply ignores, whereas
// changing the element type would make it read every bar as NaN.
const K_HISTORY_N = '@gote/historyCounts';
// The accuracy chart, as identified records: [{ id, pct, n, at }]. The source of
// truth; K_HISTORY / K_HISTORY_N are still written as derived arrays so an older
// build (or a rollback) keeps working. See src/sync/merge.js mergeBars for why
// bars need identities: an anonymous list cannot tell two copies of one round
// apart, which is how the same round kept being drawn twice.
const K_BARS = '@gote/bars';
const K_STREAK = '@gote/streak';
const K_DAYS = '@gote/activeDays';
const K_WATCH_IDS = '@gote/watchResultIds';
const K_WATCH_TIP = '@gote/watchTipDismissed';
// When the local settings last changed (ms epoch). The one timestamp that makes
// last-write-wins between this device and the server actually work.
const K_SET_TS = '@gote/settingsStamp';
// The on-device data-shape version. See runDataMigrations below.
const K_DATA_VERSION = '@gote/dataVersion';
// A manifest of photo URLs we've successfully prefetched into the image cache —
// the queryable "which photos are downloaded" set the OS cache can't give us.
// Used to build a playable deck when offline. See src/prefetch.js.
const K_DL_IMAGES = '@gote/downloadedImages';
// Cap so the manifest can't grow without bound across many decks. Keeps the
// most-recently-added, which are the ones most likely still in the OS cache.
const MAX_DL_IMAGES = 1500;

// How many applied watch-result ids to remember (for dedup — see below). Bounds
// storage; far more than the in-flight window between the two delivery channels.
const MAX_WATCH_IDS = 500;

// How many recent games to keep for the menu's accuracy chart. Comfortably more
// than fit on screen; the chart shows only the newest that fit.
const MAX_HISTORY = 120;

// Bump if the cached card shape changes incompatibly — a mismatch forces a
// fresh full download instead of using stale-shaped data.
// v2: cards carry `ancestry` for similar-distractor picking.
// v3: cards carry `rankLevel` for the "identified to species" filter (fixes
//     stale caches whose cards lacked reliable rank data).
// v4: cards carry `attribution`/`licenseCode` for the on-card photo credit.
// v5: cards carry `lat`/`lng`/`placeGuess` for the observation-location map pin.
const CACHE_VERSION = 5;

// The version of the LOCAL data shapes on this device. Bump when a stored blob
// changes shape incompatibly, and add a matching step to runDataMigrations().
//
// Three separate version numbers, deliberately, because they govern three
// different things and move at different times (see docs/SCHEMA-CHANGELOG.md):
//   • DATA_VERSION (here)      — the on-device AsyncStorage shapes.
//   • CACHE_VERSION (below)    — only the disposable observation cache.
//   • SETTINGS_PAYLOAD_VERSION — what crosses the network (src/sync/merge.js).
export const DATA_VERSION = 2;

export async function loadDataVersion() {
  try {
    const n = Number(await kv.getItem(K_DATA_VERSION));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// Forward-only local migrations, run once at startup before anything reads
// storage. Each step upgrades the stored shapes from one version to the next.
// A fresh install and an already-current device both no-op. Best-effort: a
// failed step must never block launch, so the reached version is still stamped.
export async function runDataMigrations() {
  let from = await loadDataVersion();
  if (from === 0) {
    // No marker: a brand-new install, or a device from before data versioning.
    // Both are the v1 baseline — the shapes the app has always written — so
    // nothing is rewritten. (Pre-launch there is no older shape in the wild.)
    from = DATA_VERSION;
  }
  // v1 -> v2: the accuracy chart becomes a list of identified bars.
  if (from < 2) {
    await migrateBarsV2();
    from = 2;
  }
  try {
    await kv.setItem(K_DATA_VERSION, String(DATA_VERSION));
  } catch {
    /* best-effort — a write failure just means we retry next launch */
  }
  return DATA_VERSION;
}

export async function loadUsername() {
  try {
    return await kv.getItem(K_USER);
  } catch {
    return null;
  }
}

export async function saveUsername(username) {
  try {
    await kv.setItem(K_USER, username);
  } catch {
    /* ignore write errors — persistence is best-effort */
  }
}

export async function loadStats() {
  try {
    const raw = await kv.getItem(K_STATS);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to default */
  }
  return { answered: 0, correct: 0 };
}

// User preferences: per-species toggle, species-name language, research-grade.
const DEFAULT_PREFS = {
  perSpecies: true,
  locale: 'en',
  researchGrade: false,
  speciesOnly: false,
  namedOnly: false,
  freshPhotos: false, // swap a mastered species' photo for an official one
  themeMode: 'system', // 'light' | 'dark' | 'system'
};

export async function loadPrefs() {
  try {
    const raw = await kv.getItem(K_PREFS);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* fall through to default */
  }
  return { ...DEFAULT_PREFS };
}

export async function savePrefs(prefs) {
  try {
    await kv.setItem(K_PREFS, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

// When the local settings last changed, as a millisecond timestamp. Used only
// by the sync layer to decide, on launch, whether the server's copy is newer.
export async function loadSettingsStamp() {
  try {
    const raw = await kv.getItem(K_SET_TS);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function saveSettingsStamp(ts) {
  try {
    await kv.setItem(K_SET_TS, String(ts));
  } catch {
    /* ignore */
  }
}

// Add a finished round's results to the lifetime totals and return the new totals.
export async function addToStats(answered, correct) {
  const prev = await loadStats();
  const next = {
    answered: prev.answered + answered,
    correct: prev.correct + correct,
  };
  try {
    await kv.setItem(K_STATS, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

// --- lifetime totals, split by question format --------------------------------
// Counters, never averages: they have to fold across devices by summing, like
// every other rollup here.

export async function loadStatsByFormat() {
  try {
    const raw = await kv.getItem(K_FORMATS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* fall through */
  }
  return {};
}

export async function saveStatsByFormat(map) {
  try {
    await kv.setItem(K_FORMATS, JSON.stringify(map || {}));
  } catch {
    /* ignore */
  }
}

// Add one round's per-format answers and return the new map. `delta` is
// { [format]: { answered, correct } } — only the formats actually used.
export async function addToStatsByFormat(delta) {
  const prev = await loadStatsByFormat();
  const next = { ...prev };
  for (const [format, d] of Object.entries(delta || {})) {
    if (!format || !d) continue;
    const p = next[format] || { answered: 0, correct: 0 };
    next[format] = {
      answered: (Number(p.answered) || 0) + (Number(d.answered) || 0),
      correct: (Number(p.correct) || 0) + (Number(d.correct) || 0),
    };
  }
  await saveStatsByFormat(next);
  return next;
}

// Overwrite the lifetime totals wholesale (normal play uses addToStats). Used by
// the screenshot seeder to plant a realistic lifetime score.
export async function saveStats(stats) {
  try {
    await kv.setItem(K_STATS, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

// Per-species tallies, keyed by taxon id: { [key]: { name, sci, known, missed } }.
// Used by the statistics page (most missed / most known).
export async function loadSpeciesStats() {
  try {
    const raw = await kv.getItem(K_SPECIES);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to default */
  }
  return {};
}

export async function saveSpeciesStats(map) {
  try {
    await kv.setItem(K_SPECIES, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// The confusion matrix: `{ [correctKey]: { [chosenKey]: count } }`, keyed by
// species taxon id (scientific name as a fallback). Counts only — display names
// are joined from `@gote/species` when the nemesis UI needs them.
export async function loadConfusions() {
  try {
    const raw = await kv.getItem(K_CONFUSIONS);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

export async function saveConfusions(map) {
  try {
    await kv.setItem(K_CONFUSIONS, JSON.stringify(map || {}));
  } catch {
    /* ignore */
  }
}

// The player's "my tell" notes. Canonical shape: `{ [pairKey]: { text, t } }`
// (t = last-edit ms; an empty text is a tombstone, kept so a delete propagates
// through sync). Legacy bare-string entries (written before notes synced) upcast
// to `{ text, t: 0 }` — a real edit anywhere, with a real timestamp, wins over
// them. Notes ride the settings payload as `n:<pairKey>` keys and merge per note
// (src/sync/merge.js mergeNotes); displayNotes gives the `{ pairKey: text }` the
// UI reads.
export async function loadConfusionNotes() {
  try {
    const raw = await kv.getItem(K_CONFUSION_NOTES);
    const obj = raw ? JSON.parse(raw) : {};
    if (!obj || typeof obj !== 'object') return {};
    const out = {};
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === 'string') out[k] = { text: v, t: 0 };
      else if (v && typeof v === 'object')
        out[k] = { text: typeof v.text === 'string' ? v.text : '', t: Number(v.t) || 0 };
    }
    return out;
  } catch {
    return {};
  }
}

// Save one note, stamped `now`. A blank clears it — kept as an empty-text
// tombstone so the deletion syncs rather than silently reappearing from another
// device. Returns the new canonical map (so the caller can push it).
export async function saveConfusionNote(key, text, now = Date.now()) {
  if (!key) return null;
  try {
    const map = await loadConfusionNotes();
    map[key] = { text: (text || '').trim(), t: now };
    await kv.setItem(K_CONFUSION_NOTES, JSON.stringify(map));
    return map;
  } catch {
    return null;
  }
}

// Overwrite the whole note map (used after a sync merge).
export async function saveConfusionNotes(map) {
  try {
    await kv.setItem(K_CONFUSION_NOTES, JSON.stringify(map || {}));
  } catch {
    /* ignore */
  }
}

// The "verify the fix" recovery streaks: `{ [pairKey]: streak }`. Whole map is
// saved at once (App keeps the running copy in a ref).
export async function loadConfusionWins() {
  try {
    const raw = await kv.getItem(K_CONFUSION_WINS);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

export async function saveConfusionWins(map) {
  try {
    await kv.setItem(K_CONFUSION_WINS, JSON.stringify(map || {}));
  } catch {
    /* ignore */
  }
}

// Wipe all gameplay statistics (lifetime totals + per-species tallies + the
// per-game accuracy history shown on the menu).
//
// K_DAYS goes too, and its absence here was a real bug: the streak is
// recomputed from the active-day SET whenever a sync folds in a remote event
// (applyRemote → backfillActiveDays → streakFromDays), so clearing the streak
// but keeping the days meant a synced device watched its streak reset to 0 and
// then quietly come back on the next pull. Totals didn't resurrect — the
// applied-id ledger stops old events from re-folding — so the day set must be
// cleared with the same finality, or reset looks like it didn't stick.
//
// The confusion matrix and the "verify the fix" recovery streaks go too: both
// are derived from answers, so leaving them would keep the Statistics page
// showing look-alike pairs for a history the player just erased. They can be
// removed outright — like the totals, they ride the append-only event log, and
// the applied-id ledger stops already-consumed events from re-folding.
//
// The player's own pair NOTES cannot. Those ride the SETTINGS row, which is
// last-write-wins per note and re-read on every pull, so deleting the key here
// would let another device's copy win the next merge and put every note back.
// They are cleared the way the app clears a single note — an empty-text
// tombstone stamped `now` (see saveConfusionNote) — which is what makes the
// deletion propagate instead of silently reappearing. The new map is returned
// so the caller can push it; the deletion doesn't leave this device otherwise.
export async function resetStatistics(now = Date.now()) {
  let notes = {};
  try {
    await kv.multiRemove([
      K_STATS, K_FORMATS, K_SPECIES, K_HISTORY, K_HISTORY_N, K_BARS, K_STREAK, K_DAYS,
      K_CONFUSIONS, K_CONFUSION_WINS,
    ]);
  } catch {
    /* ignore */
  }
  try {
    const prev = await loadConfusionNotes();
    for (const key of Object.keys(prev)) notes[key] = { text: '', t: now };
    await saveConfusionNotes(notes);
  } catch {
    /* ignore — a failed tombstone just leaves the note, never crashes reset */
  }
  return notes;
}

// --- Per-game accuracy history -----------------------------------------------
// A list of recent games' accuracy percentages (0–100, oldest → newest), for
// the little background chart on the menu. Global, like the lifetime totals.
//
// Each percentage has a companion card count in K_HISTORY_N, because a
// percentage alone can't be aggregated honestly: averaging a 1-card round with a
// 100-card round as equals is what made the "lifetime accuracy" trend line miss
// the lifetime accuracy. See src/accuracy.js. Rounds played before v2.37.0 have
// no count; the arrays are right-aligned so those simply sit at the front with
// an unknown size.

// Read a stored array of finite numbers, or [] for anything unusable.
async function loadNumbers(key) {
  try {
    const raw = await kv.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((n) => typeof n === 'number');
    }
  } catch {
    /* fall through */
  }
  return [];
}

export async function loadHistory() {
  return loadNumbers(K_HISTORY);
}

// Cards per finished round, right-aligned with loadHistory()'s percentages.
// Shorter than the history for a player who has rounds from before counts were
// recorded; never longer.
export async function loadHistoryCounts() {
  return loadNumbers(K_HISTORY_N);
}

// Overwrite the accuracy history wholesale (normal play uses addGameResult).
// Used by the screenshot seeder to plant a full, trending chart, and by sync
// when a merge rebuilds the chart from the account's events.
export async function saveHistory(history, counts) {
  const pcts = (Array.isArray(history) ? history : [])
    .filter((n) => typeof n === 'number')
    .slice(-MAX_HISTORY);
  const clean = (Array.isArray(counts) ? counts : []).filter((n) => typeof n === 'number');
  // Right-aligned, exactly as the old parallel arrays were.
  const ns = pcts.length ? clean.slice(-pcts.length) : [];
  const offset = pcts.length - ns.length;
  const prev = counts === undefined ? await loadBars() : [];
  await saveBars(
    pcts.map((pct, i) => ({
      id: `seed-${i}`,
      pct,
      // Omitted counts leave the stored sizes alone: a caller that only knows
      // the percentages must not silently erase them.
      n: counts === undefined ? (prev[i] ? prev[i].n : 0) : i >= offset ? ns[i - offset] : 0,
      at: i,
    }))
  );
}

// Append one finished game's accuracy percent, with the number of cards it
// covered, and return the trimmed history + counts.
//
// `n` is the weight every aggregate over this chart uses. It is passed rather
// than derived so the caller's own card total is the source of truth — including
// for a watch round, whose cards were already banked one at a time and so can't
// be recovered from the lifetime delta.
export async function addGameResult(pct, n = 0) {
  const bars = await loadBars();
  // The producer names the bar. Every other device adopts this id rather than
  // inventing one, which is what makes re-sending it a no-op instead of a
  // second round on the chart. `at` is when it was played, so devices that
  // merge in a different order still draw the rounds in the same sequence.
  const bar = {
    id: barId(),
    pct: Math.max(0, Math.min(100, Math.round(pct))),
    n: Math.max(0, Math.round(Number(n) || 0)),
    at: Date.now(),
  };
  const next = await saveBars([...bars, bar]);
  return { history: next.map((b) => b.pct), counts: next.map((b) => b.n), bar };
}

// --- Daily streak ------------------------------------------------------------
// Consecutive calendar days with at least one finished round. Stored as
// { current, longest, lastActiveDay } where lastActiveDay is a local YYYY-MM-DD.

// Local calendar-day key for a Date (uses local time, so no UTC/midnight traps).
function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// The local day before `d` (built from date parts, so month ends and DST are
// handled correctly — not a naive minus-24-hours).
function prevDayKey(d) {
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
}

export async function loadStreak() {
  try {
    const raw = await kv.getItem(K_STREAK);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s.current === 'number') {
        return {
          current: s.current,
          longest: typeof s.longest === 'number' ? s.longest : s.current,
          lastActiveDay: s.lastActiveDay || null,
        };
      }
    }
  } catch {
    /* fall through */
  }
  return { current: 0, longest: 0, lastActiveDay: null };
}

// Overwrite the streak record wholesale (normal play uses recordStreakDay).
// Used by the screenshot seeder to plant an active multi-day streak.
export async function saveStreak(streak) {
  try {
    await kv.setItem(K_STREAK, JSON.stringify(streak));
  } catch {
    /* ignore */
  }
}

// Mark today active and advance / continue / reset the streak. Idempotent within
// a day. Returns the new record.
export async function recordStreakDay(now = Date.now()) {
  const d = new Date(now);
  const today = dayKey(d);
  const yesterday = prevDayKey(d);
  const prev = await loadStreak();
  // Never rewind: results can arrive late (e.g. watch rounds syncing a day
  // after they were played) — a timestamp older than the last active day must
  // not move the streak backwards or reset it. (ISO YYYY-MM-DD compares
  // correctly as a string.)
  if (prev.lastActiveDay && today < prev.lastActiveDay) return prev;
  let current;
  if (prev.lastActiveDay === today) current = prev.current; // already counted
  else if (prev.lastActiveDay === yesterday) current = prev.current + 1; // continued
  else current = 1; // first ever, or a gap → restart
  const next = {
    current,
    longest: Math.max(prev.longest || 0, current),
    lastActiveDay: today,
  };
  try {
    await kv.setItem(K_STREAK, JSON.stringify(next));
  } catch {
    /* ignore — best-effort */
  }
  return next;
}

// Display state for "now" from a stored streak: 'done' (already counted today),
// 'atRisk' (counted yesterday, not yet today), or 'broken' (gap → shows 0).
export function streakStatus(streak, now = Date.now()) {
  const longest = (streak && streak.longest) || 0;
  if (!streak || !streak.lastActiveDay) return { count: 0, state: 'broken', longest };
  const d = new Date(now);
  if (streak.lastActiveDay === dayKey(d)) return { count: streak.current, state: 'done', longest };
  if (streak.lastActiveDay === prevDayKey(d)) return { count: streak.current, state: 'atRisk', longest };
  return { count: 0, state: 'broken', longest };
}

// --- Active days (for cross-device streaks) ----------------------------------
// The set of local calendar days with at least one finished round, as
// YYYY-MM-DD strings. Redundant with the streak record on a single device —
// but a streak COUNT cannot be merged across devices, while a set of days can:
// union it and recompute. Maintained alongside the counter so nothing changes
// for a local-only player. See src/sync/merge.js → streakFromDays.

export async function loadActiveDays() {
  try {
    const raw = await kv.getItem(K_DAYS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((d) => typeof d === 'string');
    }
  } catch {
    /* fall through */
  }
  return [];
}

export async function saveActiveDays(days) {
  try {
    const arr = [...new Set((days || []).filter((d) => typeof d === 'string'))].sort();
    await kv.setItem(K_DAYS, JSON.stringify(arr));
  } catch {
    /* ignore — best-effort */
  }
}

// Add one day to the set. Returns the full set.
export async function addActiveDay(now = Date.now()) {
  const days = await loadActiveDays();
  const key = dayKey(new Date(now));
  if (days.includes(key)) return days;
  const next = [...days, key].sort();
  await saveActiveDays(next);
  return next;
}

// The day set for a player who was here before it existed. Their streak record
// only remembers ONE day (lastActiveDay), so the earlier run is unrecoverable —
// seed what we have and let the caller keep the stored `longest`, rather than
// recomputing a smaller one and appearing to erase their record.
export async function backfillActiveDays(streak) {
  const days = await loadActiveDays();
  if (days.length) return days;
  const last = streak && streak.lastActiveDay;
  if (!last) return days;
  const seeded = [last];
  await saveActiveDays(seeded);
  return seeded;
}

// --- Watch tip dismissal -----------------------------------------------------
// Whether the user has hidden the "Did you know? (Apple Watch)" notice on the
// main menu. It stays available in Settings regardless.

export async function loadWatchTipDismissed() {
  try {
    return (await kv.getItem(K_WATCH_TIP)) === '1';
  } catch {
    return false;
  }
}

export async function saveWatchTipDismissed(dismissed) {
  try {
    await kv.setItem(K_WATCH_TIP, dismissed ? '1' : '0');
  } catch {
    /* ignore — best-effort */
  }
}

// --- Round picker setup -----------------------------------------------------
// The last round the player actually STARTED from the picker, per mode
// ({ smart: {...}, flash: {...} }). Shape and every rule about it belong to
// src/roundsetup.js, which normalizes whatever comes back — including nothing,
// and including a record written against a deck that no longer exists.
//
// Kept out of prefs deliberately: prefs are synced between devices, and which
// groups you drilled on the phone last night is not something the tablet should
// inherit.

export async function loadRoundSetup() {
  try {
    const raw = await kv.getItem(K_ROUND_SETUP);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {}; // unreadable or not valid JSON — open on the defaults
  }
}

export async function saveRoundSetup(map) {
  try {
    await kv.setItem(K_ROUND_SETUP, JSON.stringify(map || {}));
  } catch {
    /* ignore — best-effort */
  }
}

// --- Guided tour ------------------------------------------------------------
// Where the tutorial got to. Stored as an opaque record: the shape and every
// rule about it belong to src/tutorial.js, which normalizes whatever comes back
// (including nothing, and including a record written by a different version).

export async function loadTutorial() {
  try {
    const raw = await kv.getItem(K_TUTORIAL);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // unreadable or not valid JSON — treat as never started
  }
}

export async function saveTutorial(state) {
  try {
    await kv.setItem(K_TUTORIAL, JSON.stringify(state));
  } catch {
    /* ignore — best-effort */
  }
}

// --- Applied watch-result ids (dedup) ----------------------------------------
// The watch delivers each game result on two channels (queued transferUserInfo
// + instant sendMessage when reachable), and transferUserInfo can redeliver
// across app launches. Each result carries a unique `rid`; we remember the ids
// we've already folded into stats so a result is never counted twice. Stored as
// a capped FIFO list (newest last).

export async function loadAppliedWatchIds() {
  try {
    const raw = await kv.getItem(K_WATCH_IDS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {
    /* fall through */
  }
  return [];
}

export async function saveAppliedWatchIds(ids) {
  try {
    const capped = (Array.isArray(ids) ? ids : []).slice(-MAX_WATCH_IDS);
    await kv.setItem(K_WATCH_IDS, JSON.stringify(capped));
  } catch {
    /* ignore — best-effort */
  }
}

// --- Flagged species ---------------------------------------------------------
// The user can "flag" species (to revisit, to study, whatever they like). Flags
// are scoped PER USERNAME — consistent with the per-account observation cache —
// so switching accounts loads that account's own flagged species and never mixes
// them. Stored as one map { [username]: [taxonId, …] } (taxon ids as strings)
// under K_FLAGS.

// Read the raw flags map, tolerating absent/corrupt/legacy data.
async function loadFlagsMap() {
  try {
    const raw = await kv.getItem(K_FLAGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { map: parsed, legacy: null };
      }
      // Legacy (pre-1.8.1) format: a single flat array shared across accounts.
      if (Array.isArray(parsed)) return { map: {}, legacy: parsed.map(String) };
    }
  } catch {
    /* fall through */
  }
  return { map: {}, legacy: null };
}

// One username's flags, canonical: `{ [taxonId]: { on, t } }` (t = last toggle
// ms; on:false is a tombstone kept so an *un*flag syncs). Accepts the legacy
// array form `[id,…]` (all flagged, t 0) so old stores upcast. Notes-style, so
// flags can ride the settings payload and merge per flag (src/sync/merge.js).
function flagRecordOf(v) {
  const out = {};
  if (Array.isArray(v)) {
    for (const id of v) out[String(id)] = { on: true, t: 0 };
    return out;
  }
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) {
      const e = v[k];
      if (typeof e === 'boolean') out[k] = { on: e, t: 0 };
      else if (e && typeof e === 'object') out[k] = { on: !!e.on, t: Number(e.t) || 0 };
    }
  }
  return out;
}

// The canonical record for a username (for sync). Upcasts the legacy array form
// and folds in the pre-1.8.1 global flat list the first time an account loads.
export async function loadFlagsRecord(username) {
  if (!username) return {};
  const { map, legacy } = await loadFlagsMap();
  if (map[username] != null) return flagRecordOf(map[username]);
  if (legacy && legacy.length) {
    const rec = flagRecordOf(legacy);
    await saveFlagsRecord(username, rec); // adopt into the per-account form once
    return rec;
  }
  return {};
}

// The display shape the app reads: the taxon ids currently flagged (on:true).
export async function loadFlags(username) {
  const rec = await loadFlagsRecord(username);
  return Object.keys(rec).filter((k) => rec[k] && rec[k].on);
}

// Overwrite one username's whole flag record (used after a sync merge).
export async function saveFlagsRecord(username, record) {
  if (!username) return;
  try {
    const { map } = await loadFlagsMap();
    map[username] = record && typeof record === 'object' ? record : {};
    await kv.setItem(K_FLAGS, JSON.stringify(map));
  } catch {
    /* ignore — best-effort */
  }
}

// Toggle one flag, stamped `now`. on:false is kept as a tombstone so the change
// propagates through sync. Returns the new canonical record (so the caller can
// push it).
export async function saveFlag(username, taxonId, on, now = Date.now()) {
  if (!username || taxonId == null) return null;
  try {
    const rec = await loadFlagsRecord(username);
    rec[String(taxonId)] = { on: !!on, t: now };
    await saveFlagsRecord(username, rec);
    return rec;
  } catch {
    return null;
  }
}

// --- Observation cache -------------------------------------------------------
// One cache per "account identity" = username + locale (different language ⇒
// different common names ⇒ different cards). Shape:
//   { version, username, locale, cards: [...], watermark, syncedAt }
// `watermark` is the newest observation `updated_at` we've seen (for the next
// incremental sync); `syncedAt` is when we last synced (ms epoch).

export function cacheMatches(cache, username, locale) {
  return (
    !!cache &&
    cache.version === CACHE_VERSION &&
    cache.username === username &&
    cache.locale === locale &&
    Array.isArray(cache.cards) &&
    cache.cards.length > 0
  );
}

export async function loadCache() {
  try {
    const raw = await kv.getItem(K_CACHE);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveCache({ username, locale, cards, watermark, syncedAt }) {
  try {
    await kv.setItem(
      K_CACHE,
      JSON.stringify({
        version: CACHE_VERSION,
        username,
        locale,
        cards,
        watermark: watermark || null,
        syncedAt: syncedAt || Date.now(),
      })
    );
  } catch {
    /* ignore — caching is best-effort */
  }
}

export async function clearCacheData() {
  try {
    await kv.removeItem(K_CACHE);
  } catch {
    /* ignore */
  }
}

// --- downloaded-image manifest ----------------------------------------------
// The set of photo URLs known to be in the on-device image cache, so an offline
// session can be limited to cards whose photos will actually render. Best-effort
// and approximate: the OS may evict an entry we still list (worst case a card
// shows a placeholder), which is why it is a play-time hint, not a guarantee.

export async function loadDownloadedImages() {
  try {
    const raw = await kv.getItem(K_DL_IMAGES);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Merge `urls` into the manifest (deduped, capped to the newest MAX_DL_IMAGES)
// and persist. Returns the new size.
export async function addDownloadedImages(urls) {
  try {
    const set = new Set(await loadDownloadedImages());
    for (const u of urls || []) if (u) set.add(u);
    let arr = [...set];
    if (arr.length > MAX_DL_IMAGES) arr = arr.slice(arr.length - MAX_DL_IMAGES);
    await kv.setItem(K_DL_IMAGES, JSON.stringify(arr));
    return arr.length;
  } catch {
    return 0;
  }
}

export async function clearDownloadedImages() {
  try {
    await kv.removeItem(K_DL_IMAGES);
  } catch {
    /* ignore */
  }
}


// --- accuracy chart bars ------------------------------------------------------

// A local id for a bar. Only ever compared for equality, and the producer of a
// bar is the one that names it, so the other devices adopt this id rather than
// inventing their own — which is what makes a re-send a no-op.
function barId() {
  return 'b-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

export async function loadBars() {
  try {
    const raw = await kv.getItem(K_BARS);
    // Fall back to the legacy parallel arrays when the bar list is absent, so
    // correctness does not depend on the migration having run first. A device
    // that reads before runDataMigrations, or one restored from a backup taken
    // before it, still has its chart rather than a silently empty one.
    if (!raw) return legacyBars(await loadNumbers(K_HISTORY), await loadNumbers(K_HISTORY_N));
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((b) => b && b.id != null)
      .map((b) => ({
        id: String(b.id),
        pct: Math.max(0, Math.min(100, Math.round(Number(b.pct) || 0))),
        n: Math.max(0, Math.round(Number(b.n) || 0)),
        at: Number(b.at) || 0,
      }));
  } catch {
    return [];
  }
}

// Persist the chart, and mirror it into the legacy arrays so nothing that still
// reads those (an older build, a rollback) sees an empty chart.
export async function saveBars(bars) {
  const arr = (Array.isArray(bars) ? bars : []).slice(-MAX_HISTORY);
  try {
    await kv.setItem(K_BARS, JSON.stringify(arr));
    await kv.setItem(K_HISTORY, JSON.stringify(arr.map((b) => b.pct)));
    await kv.setItem(K_HISTORY_N, JSON.stringify(arr.map((b) => b.n)));
  } catch {
    /* ignore */
  }
  return arr;
}

// v1 -> v2. The old shape was two parallel arrays of bare numbers, right-aligned
// with each other. They get ids by position and an `at` of their index, which
// puts every pre-existing bar before anything played since — true, and it keeps
// their order without needing a timestamp nobody recorded.
// The old shape: two parallel arrays of bare numbers, the counts right-aligned
// with the percentages. They get ids by position and an `at` of their index,
// which puts every pre-existing bar before anything played since — true, and it
// keeps their order without needing a timestamp nobody recorded.
function legacyBars(history, counts) {
  const offset = history.length - counts.length;
  return history.map((pct, i) => ({
    id: `legacy-${i}`,
    pct: Math.max(0, Math.min(100, Math.round(Number(pct) || 0))),
    n: i >= offset ? Math.max(0, Math.round(Number(counts[i - offset]) || 0)) : 0,
    at: i,
  }));
}

async function migrateBarsV2() {
  try {
    if (await kv.getItem(K_BARS)) return; // already migrated
    const [history, counts] = await Promise.all([
      loadNumbers(K_HISTORY),
      loadNumbers(K_HISTORY_N),
    ]);
    if (!history.length) return;
    await kv.setItem(K_BARS, JSON.stringify(legacyBars(history, counts)));
  } catch {
    /* best-effort — a failed migration just leaves the legacy arrays in place */
  }
}
