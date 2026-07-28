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
const K_HISTORY = '@gote/history';
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
export const DATA_VERSION = 1;

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
  // Add steps as the shapes evolve, e.g.:
  //   if (from < 2) { await migratePrefsToV2(); from = 2; }
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
export async function resetStatistics() {
  try {
    await kv.multiRemove([K_STATS, K_SPECIES, K_HISTORY, K_STREAK]);
  } catch {
    /* ignore */
  }
}

// --- Per-game accuracy history -----------------------------------------------
// A list of recent games' accuracy percentages (0–100, oldest → newest), for
// the little background chart on the menu. Global, like the lifetime totals.

export async function loadHistory() {
  try {
    const raw = await kv.getItem(K_HISTORY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((n) => typeof n === 'number');
    }
  } catch {
    /* fall through */
  }
  return [];
}

// Overwrite the accuracy history wholesale (normal play uses addGameResult).
// Used by the screenshot seeder to plant a full, trending chart.
export async function saveHistory(history) {
  try {
    const arr = (Array.isArray(history) ? history : [])
      .filter((n) => typeof n === 'number')
      .slice(-MAX_HISTORY);
    await kv.setItem(K_HISTORY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

// Append one finished game's accuracy percent and return the trimmed history.
export async function addGameResult(pct) {
  const prev = await loadHistory();
  const next = [...prev, Math.max(0, Math.min(100, Math.round(pct)))].slice(
    -MAX_HISTORY
  );
  try {
    await kv.setItem(K_HISTORY, JSON.stringify(next));
  } catch {
    /* ignore — best-effort */
  }
  return next;
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

export async function loadFlags(username) {
  if (!username) return [];
  const { map, legacy } = await loadFlagsMap();
  if (Array.isArray(map[username])) return map[username].map(String);
  // One-time migration of the old global flag list: adopt it into the FIRST
  // account that loads and persist immediately (which rewrites storage into the
  // per-account map form), so later accounts don't also inherit the old flags.
  if (legacy && legacy.length) {
    await saveFlags(username, legacy);
    return legacy.map(String);
  }
  return [];
}

export async function saveFlags(username, taxonIds) {
  if (!username) return;
  try {
    const { map } = await loadFlagsMap();
    map[username] = [...new Set((taxonIds || []).map(String))];
    await kv.setItem(K_FLAGS, JSON.stringify(map));
  } catch {
    /* ignore — best-effort */
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
