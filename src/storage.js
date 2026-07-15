// Tiny persistence layer over AsyncStorage: remembers the last username and
// keeps a running lifetime score (answered / correct).

import AsyncStorage from '@react-native-async-storage/async-storage';

const K_USER = '@gote/username';
const K_STATS = '@gote/stats';
const K_PREFS = '@gote/prefs';
const K_SPECIES = '@gote/species';
const K_CACHE = '@gote/obscache';
const K_FLAGS = '@gote/flags';
const K_HISTORY = '@gote/history';
const K_STREAK = '@gote/streak';

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

export async function loadUsername() {
  try {
    return await AsyncStorage.getItem(K_USER);
  } catch {
    return null;
  }
}

export async function saveUsername(username) {
  try {
    await AsyncStorage.setItem(K_USER, username);
  } catch {
    /* ignore write errors — persistence is best-effort */
  }
}

export async function loadStats() {
  try {
    const raw = await AsyncStorage.getItem(K_STATS);
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
    const raw = await AsyncStorage.getItem(K_PREFS);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* fall through to default */
  }
  return { ...DEFAULT_PREFS };
}

export async function savePrefs(prefs) {
  try {
    await AsyncStorage.setItem(K_PREFS, JSON.stringify(prefs));
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
    await AsyncStorage.setItem(K_STATS, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

// Overwrite the lifetime totals wholesale (normal play uses addToStats). Used by
// the screenshot seeder to plant a realistic lifetime score.
export async function saveStats(stats) {
  try {
    await AsyncStorage.setItem(K_STATS, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

// Per-species tallies, keyed by taxon id: { [key]: { name, sci, known, missed } }.
// Used by the statistics page (most missed / most known).
export async function loadSpeciesStats() {
  try {
    const raw = await AsyncStorage.getItem(K_SPECIES);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through to default */
  }
  return {};
}

export async function saveSpeciesStats(map) {
  try {
    await AsyncStorage.setItem(K_SPECIES, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// Wipe all gameplay statistics (lifetime totals + per-species tallies + the
// per-game accuracy history shown on the menu).
export async function resetStatistics() {
  try {
    await AsyncStorage.multiRemove([K_STATS, K_SPECIES, K_HISTORY, K_STREAK]);
  } catch {
    /* ignore */
  }
}

// --- Per-game accuracy history -----------------------------------------------
// A list of recent games' accuracy percentages (0–100, oldest → newest), for
// the little background chart on the menu. Global, like the lifetime totals.

export async function loadHistory() {
  try {
    const raw = await AsyncStorage.getItem(K_HISTORY);
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
    await AsyncStorage.setItem(K_HISTORY, JSON.stringify(arr));
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
    await AsyncStorage.setItem(K_HISTORY, JSON.stringify(next));
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
    const raw = await AsyncStorage.getItem(K_STREAK);
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
    await AsyncStorage.setItem(K_STREAK, JSON.stringify(streak));
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
    await AsyncStorage.setItem(K_STREAK, JSON.stringify(next));
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

// --- Flagged species ---------------------------------------------------------
// The user can "flag" species (to revisit, to study, whatever they like). Flags
// are scoped PER USERNAME — consistent with the per-account observation cache —
// so switching accounts loads that account's own flagged species and never mixes
// them. Stored as one map { [username]: [taxonId, …] } (taxon ids as strings)
// under K_FLAGS.

// Read the raw flags map, tolerating absent/corrupt/legacy data.
async function loadFlagsMap() {
  try {
    const raw = await AsyncStorage.getItem(K_FLAGS);
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
    await AsyncStorage.setItem(K_FLAGS, JSON.stringify(map));
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
    const raw = await AsyncStorage.getItem(K_CACHE);
    if (raw) return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  return null;
}

export async function saveCache({ username, locale, cards, watermark, syncedAt }) {
  try {
    await AsyncStorage.setItem(
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
    await AsyncStorage.removeItem(K_CACHE);
  } catch {
    /* ignore */
  }
}
