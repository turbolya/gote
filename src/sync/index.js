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
import {
  ensureSession,
  currentUserId,
  currentEmail,
  isAnonymous,
  signOut as authSignOut,
} from './auth';
import {
  loadOutbox,
  saveOutbox,
  pushToOutbox,
  clearFromOutbox,
  loadAppliedIds,
  saveAppliedIds,
  loadLastPulledAt,
  saveLastPulledAt,
  loadLastUserId,
  saveLastUserId,
  resetPullState,
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
  currentEmail,
  isAnonymous,
  linkEmail,
  signInWithEmail,
  verifyCode,
  confirmLink,
  confirmSignIn,
} from './auth';

// How many rows one pull fetches. Generous enough that a device offline for
// months catches up in a couple of passes, small enough not to stall a launch.
const PULL_LIMIT = 500;

// Only one sync at a time. Two overlapping runs could both pull the same rows
// before either updated the ledger, and double-count them.
let inFlight = null;

// Coalescing timer for bursts. A watch session delivers one event per answer;
// firing a round-trip for each would be a dozen requests in as many seconds.
let pending = null;

// Everything in this file swallows its errors on purpose — a failed sync must
// never break a screen. That makes silent breakage the failure mode, so in
// development say something. Stripped from production builds.
function debug(...args) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[sync]', ...args);
}

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

// Sync soon, coalescing repeated calls into one. For bursts — a watch session
// arriving answer by answer — where syncing per event would be wasteful.
export function scheduleSync(delayMs = 5000) {
  if (!SYNC_ENABLED) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    syncNow();
  }, delayMs);
}

async function run() {
  try {
    const supabase = getClient();
    const userId = await ensureSession();
    if (!supabase) return null;
    if (!userId) {
      // Almost always one of: anonymous sign-ins not enabled on the project,
      // wrong URL/key, or no network.
      debug('no session — sign-in failed, staying queued');
      return null;
    }
    await push(supabase, userId);
    return await pull(supabase, userId);
  } catch (e) {
    debug('run failed', e && e.message);
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
  if (error) {
    debug('push rejected —', error.message, '(', rows.length, 'queued )');
    return; // keep them queued
  }
  debug('pushed', rows.length);
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

// --- accounts ----------------------------------------------------------------

// What the Sync screen needs to render.
export async function getSyncStatus() {
  if (!SYNC_ENABLED) return { enabled: false };
  try {
    const [userId, email, anon, queued] = await Promise.all([
      currentUserId(),
      currentEmail(),
      isAnonymous(),
      loadOutbox(),
    ]);
    return {
      enabled: true,
      signedIn: Boolean(userId),
      anonymous: anon,
      email: email || null,
      queued: queued.length,
    };
  } catch {
    return { enabled: true, signedIn: false, anonymous: true, email: null, queued: 0 };
  }
}

// Call after any successful sign-in or link. Two very different cases:
//
//   LINK (this device's anonymous account gains an email) — the user id does
//   not change, so its rows are already on the account and there is nothing to
//   reconcile.
//
//   SIGN IN (this device joins an account created elsewhere) — the user id
//   changes. Everything played here so far went to the abandoned anonymous
//   account and would simply vanish from the user's history, so it is re-sent
//   as one baseline event. The device skips its own rows on pull, so the
//   baseline is never applied here and cannot double-count; the OTHER devices
//   apply it once.
export async function afterAuthChange() {
  if (!SYNC_ENABLED) return null;
  try {
    const userId = await currentUserId();
    if (!userId) return null;
    const previous = await loadLastUserId();
    if (previous && previous !== userId) {
      // The watermark and ledger describe the old account. Left in place they
      // would make the app skip the new account's entire history.
      await resetPullState();
      await uploadBaseline();
    }
    await saveLastUserId(userId);
    return await syncNow();
  } catch (e) {
    debug('afterAuthChange failed', e && e.message);
    return null;
  }
}

// One event carrying this device's lifetime totals, so joining an existing
// account contributes its history instead of discarding it.
//
// Known limitation: a single event carries one local day, so the day-by-day
// streak history from before the switch stays on this device — the totals and
// per-species tallies merge, the old calendar does not. Emitting one row per
// active day would preserve it, at the cost of hundreds of rows for a
// long-standing player. Revisit if streaks turn out to matter more than that.
async function uploadBaseline() {
  const [stats, species] = await Promise.all([loadStats(), loadSpeciesStats()]);
  if (!stats || (!stats.answered && !Object.keys(species || {}).length)) return;
  await recordEvent({
    answered: stats.answered || 0,
    correct: stats.correct || 0,
    pct: null, // not a round — must not land on the accuracy chart
    species: species || {},
  });
  debug('baseline queued', stats.answered, 'answers');
}

// Delete the account and every synced row, then start over anonymously.
// Required by App Store guideline 5.1.1(v).
//
// The actual delete happens in the delete-account edge function: removing an
// auth user needs the service-role key, which bypasses RLS and must never be
// in the app. The function takes the user id from the caller's verified JWT,
// so this request carries no id at all — there is nothing here to tamper with.
//
// Local stats are deliberately NOT touched. They are this device's own history,
// the user asked to delete an ACCOUNT, and Settings already has a separate
// "reset statistics" for wiping local data. Deleting both on one tap would
// destroy data nobody asked to lose.
export async function deleteAccount() {
  if (!SYNC_ENABLED) return { ok: false, error: 'sync-disabled' };
  try {
    const supabase = getClient();
    const userId = await ensureSession();
    if (!supabase || !userId) return { ok: false, error: 'not-signed-in' };

    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });
    if (error) {
      debug('delete failed', error.message);
      return { ok: false, error: error.message };
    }
    if (data && data.error) return { ok: false, error: data.error };

    // Drop everything that referred to the deleted account, INCLUDING the
    // outbox: those queued events belong to a user that no longer exists, and
    // uploading them into the next anonymous account would resurrect the data
    // the user just asked to erase.
    await Promise.all([resetPullState(), saveOutbox([]), saveLastUserId('')]);
    await authSignOut();
    await ensureSession(); // fresh anonymous identity, so the app keeps working
    return { ok: true };
  } catch (e) {
    debug('delete threw', e && e.message);
    return { ok: false, error: String(e) };
  }
}

// Sign out and go back to a fresh anonymous account. Local stats are left
// alone: they are this device's own history and the user did not ask to erase
// anything. The pull state is reset so the next account is read from scratch.
export async function signOutAndReset() {
  if (!SYNC_ENABLED) return;
  try {
    await authSignOut();
    await resetPullState();
    await saveLastUserId('');
  } catch {
    /* best-effort */
  }
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
