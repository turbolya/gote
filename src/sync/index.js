// Cross-device sync — the public surface. App.js talks to this file and
// nothing else in src/sync/.
//
// Shape of the thing:
//
//   play a round ──▶ local storage (instant, offline, authoritative)
//                └─▶ outbox ──▶ events table ──▶ other devices pull & fold in
//
// Local storage is never waited on by the network and never overwritten by it —
// remote events are FOLDED IN as deltas. That is what makes two devices playing
// at once safe: there is no "latest wins" step where one device's rounds can
// replace another's.
//
// Every function here is best-effort and swallows its errors. Sync failing must
// never surface as a broken screen; the outbox simply keeps its rows and tries
// again next launch.

import {
  loadStats,
  saveStats,
  loadSpeciesStats,
  saveSpeciesStats,
  loadHistory,
  saveHistory,
  loadStreak,
  saveStreak,
  loadActiveDays,
  saveActiveDays,
  backfillActiveDays,
  loadPrefs,
  savePrefs,
} from '../storage';
import { getClient } from './client';
import { SYNC_ENABLED } from './config';
import { ensureSession } from './auth';
import {
  loadOutbox,
  pushToOutbox,
  clearFromOutbox,
  loadAppliedIds,
  saveAppliedIds,
  loadLastPulledAt,
  saveLastPulledAt,
  getDeviceId,
  uid,
} from './outbox';
import {
  localDay,
  applyEvents,
  streakFromDays,
  mergeSettings,
  trimLedger,
} from './merge';

export { SYNC_ENABLED } from './config';
export {
  ensureSession,
  currentUserId,
  isAnonymous,
  linkEmail,
  signInWithEmail,
  verifyCode,
  signOut,
} from './auth';

// How many rows one pull fetches. Generous enough that a device offline for
// months catches up in a couple of passes, small enough not to stall a launch.
const PULL_LIMIT = 500;

// Only one sync at a time. Two overlapping runs could both pull the same rows
// before either updated the ledger, and double-count them.
let inFlight = null;

// --- producing ---------------------------------------------------------------

// Record one stat delta for upload. Called AFTER local storage is already
// written, so this is purely additive — if it throws, the player still has
// their round.
//
//   answered/correct  card counts
//   pct               0-100 for a FINISHED round; omit for a single answer,
//                     which is not a round and must not become a chart point
//   species           { [taxonId]: { name, sci, image, known, missed } }
export async function recordEvent({ answered = 0, correct = 0, pct = null, species = {}, ts = Date.now() } = {}) {
  if (!SYNC_ENABLED) return null;
  try {
    const event = {
      id: uid(),
      device_id: await getDeviceId(),
      ts: new Date(ts).toISOString(),
      local_day: localDay(ts),
      answered,
      correct,
      pct,
      species: species || {},
    };
    await pushToOutbox(event);
    return event.id;
  } catch {
    return null;
  }
}

// Mirror a settings change. Cheap and idempotent — the row is one per user.
export async function pushSettings(prefs, username) {
  if (!SYNC_ENABLED) return;
  try {
    const supabase = getClient();
    const userId = await ensureSession();
    if (!supabase || !userId) return;
    await supabase.from('settings').upsert(
      {
        user_id: userId,
        data: { prefs: prefs || {}, username: username || null },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );
  } catch {
    /* best-effort */
  }
}

// --- syncing -----------------------------------------------------------------

// Push the outbox, then pull anything new from other devices and fold it into
// local storage. Returns a summary the caller can use to refresh state, or null
// if nothing changed / sync is off.
export async function syncNow() {
  if (!SYNC_ENABLED) return null;
  if (inFlight) return inFlight;
  inFlight = run().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run() {
  try {
    const supabase = getClient();
    const userId = await ensureSession();
    if (!supabase || !userId) return null;
    await push(supabase, userId);
    return await pull(supabase, userId);
  } catch {
    return null; // offline, rate-limited, whatever — try again next time
  }
}

async function push(supabase, userId) {
  const queued = await loadOutbox();
  if (!queued.length) return;
  const rows = queued.map((e) => ({ ...e, user_id: userId }));
  // Upsert, not insert: a push that succeeded server-side but whose response
  // never arrived would otherwise fail forever on the duplicate primary key,
  // wedging the queue. Same id → same row → no double count.
  const { error } = await supabase.from('events').upsert(rows, { onConflict: 'id' });
  if (error) return; // keep them queued
  await clearFromOutbox(rows.map((r) => r.id));
}

async function pull(supabase, userId) {
  const since = await loadLastPulledAt();
  const deviceId = await getDeviceId();

  let query = supabase
    .from('events')
    .select('id, device_id, ts, local_day, answered, correct, pct, species, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(PULL_LIMIT);
  if (since) query = query.gt('created_at', since);

  const { data, error } = await query;
  if (error || !data || !data.length) return null;

  // Our own rows were counted locally the moment they were played. Re-applying
  // them would double every number on this device.
  const foreign = data.filter((e) => e.device_id !== deviceId);
  const newest = data[data.length - 1].created_at;

  if (!foreign.length) {
    await saveLastPulledAt(newest);
    return null;
  }

  const changed = await applyRemote(foreign);
  await saveLastPulledAt(newest);
  return changed;
}

// Fold remote events into the local rollups. The ONLY place sync writes to the
// app's own state, and it only ever adds.
async function applyRemote(events) {
  const [stats, species, history, streak, appliedIds] = await Promise.all([
    loadStats(),
    loadSpeciesStats(),
    loadHistory(),
    loadStreak(),
    loadAppliedIds(),
  ]);
  const days = await backfillActiveDays(streak);

  const { rollups, applied } = applyEvents(
    { stats, species, history, days },
    events,
    appliedIds
  );
  if (!applied.length) return null; // all duplicates

  const merged = streakFromDays(rollups.days);

  await Promise.all([
    saveStats(rollups.stats),
    saveSpeciesStats(rollups.species),
    saveHistory(rollups.history),
    saveActiveDays(rollups.days),
    // Never let a recomputed streak shrink `longest`: players who predate the
    // day-set only have one remembered day, so recomputing alone would look
    // like their record was erased.
    saveStreak({
      current: merged.current,
      longest: Math.max(merged.longest, (streak && streak.longest) || 0),
      lastActiveDay: merged.lastActiveDay || (streak && streak.lastActiveDay) || null,
    }),
    saveAppliedIds(trimLedger([...appliedIds, ...applied])),
  ]);

  return {
    lifetime: rollups.stats,
    species: rollups.species,
    history: rollups.history,
    streak: await loadStreak(),
    count: applied.length,
  };
}

// Pull settings from the server and adopt them if they're newer. Separate from
// syncNow because settings are last-write-wins and stats are not — mixing the
// two merge rules in one function is how you end up applying the wrong one.
export async function syncSettings() {
  if (!SYNC_ENABLED) return null;
  try {
    const supabase = getClient();
    const userId = await ensureSession();
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
      .from('settings')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;

    const localPrefs = await loadPrefs();
    const winner = mergeSettings(
      { data: { prefs: localPrefs }, updatedAt: 0 },
      { data: data.data, updatedAt: Date.parse(data.updated_at) || 0 }
    );
    if (!winner || !winner.data || !winner.data.prefs) return null;
    if (winner.updatedAt === 0) return null; // local already won
    await savePrefs({ ...localPrefs, ...winner.data.prefs });
    return winner.data;
  } catch {
    return null;
  }
}
