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
  loadUsername,
  saveUsername,
  loadSettingsStamp,
  saveSettingsStamp,
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
  loadSyncOptIn,
  saveSyncOptIn,
  uid,
} from './outbox';
import {
  localDay,
  applyEvents,
  streakFromDays,
  trimLedger,
} from './merge';

export { SYNC_ENABLED } from './config';
export { loadSyncOptIn } from './outbox';
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

// The runtime gate for ALL sync activity: the build must carry credentials AND
// the user must have turned sync on. Off by default — a sync-capable build
// uploads nothing, creates no account, and behaves exactly like a credential-
// less build until the user opts in from the Sync screen. This is what makes
// "nothing leaves your device by default" literally true.
async function syncOn() {
  return SYNC_ENABLED && (await loadSyncOptIn());
}

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
  // Nothing is even queued while sync is off — no sync-related data touches disk
  // until the user opts in. Their existing history is captured wholesale by the
  // baseline at that point (see uploadBaseline), so nothing is lost.
  if (!(await syncOn())) return null;
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

// Mirror a settings change to the server. Cheap and idempotent — one row per
// user. The `updatedAt` doubles as the last-write-wins clock: we stamp it here
// AND remember it locally (only on a successful write), so the next launch can
// tell whether the server's copy is newer than this device's.
export async function pushSettings(prefs, username, updatedAt = Date.now()) {
  if (!(await syncOn())) return;
  try {
    const supabase = getClient();
    const userId = await ensureSession();
    if (!supabase || !userId) return;
    const { error } = await supabase.from('settings').upsert(
      {
        user_id: userId,
        data: { prefs: prefs || {}, username: username || null },
        updated_at: new Date(updatedAt).toISOString(),
      },
      { onConflict: 'user_id' }
    );
    if (!error) await saveSettingsStamp(updatedAt);
  } catch {
    /* best-effort */
  }
}

// Upload whatever settings this device currently holds. Used when sync is first
// turned on (so the account starts with this device's settings) and after a
// LINK (the account keeps this device's id, so its settings stay this device's).
export async function pushLocalSettings() {
  const [prefs, username] = await Promise.all([loadPrefs(), loadUsername()]);
  await pushSettings(prefs, username, Date.now());
}

// --- syncing -----------------------------------------------------------------

// Push the outbox, then pull anything new from other devices and fold it into
// local storage. Returns a summary the caller can use to refresh state, or null
// if nothing changed / sync is off.
export async function syncNow() {
  if (!(await syncOn())) return null;
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
    // Detect an account change HERE rather than trusting callers to announce
    // it. This lives in the sync path because the id it compares against is
    // only ever written here: a device that had never linked had no recorded
    // previous account, so the reconcile silently did nothing and the device
    // kept a watermark from the account it just left — pulling none of its new
    // account's history.
    await reconcileAccount(userId);
    await push(supabase, userId);
    return await pull(supabase, userId);
  } catch (e) {
    debug('run failed', e && e.message);
    return null; // offline, rate-limited, whatever — try again next time
  }
}

// Contribute this device's existing history to the account it is now syncing
// with. Two situations, one action:
//
//   FIRST EVER SYNC — someone who has played for months and only now turns sync
//   on. Without a baseline the server would only ever learn about rounds played
//   from this moment, and their second device would show an empty account.
//
//   ACCOUNT SWITCH — everything here went to the account they just left, so it
//   would otherwise vanish from their history. The pull watermark also has to
//   go, since it describes the old account and would make the app skip the new
//   one's entire past.
async function reconcileAccount(userId) {
  const previous = await loadLastUserId();
  if (previous === userId) return; // same account as last time — nothing to do
  if (previous) {
    debug('account changed', previous, '->', userId);
    await resetPullState();
  } else {
    debug('first sync for this device');
  }
  await uploadBaseline();
  await saveLastUserId(userId);
}

async function push(supabase, userId) {
  const queued = await loadOutbox();
  if (!queued.length) return;
  const rows = queued.map((e) => ({ ...e, user_id: userId }));
  // ON CONFLICT DO NOTHING, not DO UPDATE. A push that succeeded server-side
  // but whose response never arrived must not fail forever on the duplicate
  // primary key and wedge the queue — but the row already there is the truth,
  // and re-writing it is exactly what an append-only log must never do.
  //
  // It also has to be DO NOTHING for a more mundane reason: DO UPDATE requires
  // UPDATE privilege at plan time, whether or not a conflict happens, and
  // `events` deliberately grants none.
  const { error } = await supabase
    .from('events')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
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
//
// When sync is off, this reports so WITHOUT creating a session — checking the
// status must not itself mint an anonymous account, or "off by default" would be
// a lie the moment someone opened the screen.
export async function getSyncStatus() {
  if (!SYNC_ENABLED) return { enabled: false, on: false };
  const on = await loadSyncOptIn();
  if (!on) return { enabled: true, on: false };
  try {
    const [userId, email, anon, queued] = await Promise.all([
      currentUserId(),
      currentEmail(),
      isAnonymous(),
      loadOutbox(),
    ]);
    return {
      enabled: true,
      on: true,
      signedIn: Boolean(userId),
      anonymous: anon,
      email: email || null,
      queued: queued.length,
    };
  } catch {
    return { enabled: true, on: true, signedIn: false, anonymous: true, email: null, queued: 0 };
  }
}

// Turn sync ON. Records consent, then syncs: the first run signs the device in
// anonymously and uploads a baseline of everything played so far, so nothing
// already on the device is left behind. Returns the merge summary (or null).
export async function enableSync() {
  if (!SYNC_ENABLED) return null;
  await saveSyncOptIn(true);
  // Upload this device's current settings, so the account starts with them
  // rather than having no settings row until the next change.
  await pushLocalSettings();
  return syncNow();
}

// Turn sync OFF. Stops all upload and signs out, so nothing more leaves the
// device. Local statistics are untouched — this is about the network, not the
// data. Anything already on the server stays until the account is deleted; the
// screen says so, and Delete synced account is the way to remove it.
export async function disableSync() {
  await saveSyncOptIn(false);
  await signOutAndReset();
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
export async function afterAuthChange(mode = 'link') {
  // Linking or signing in is itself the act of turning sync on, so make sure the
  // opt-in is recorded before syncing (a user can reach the email flow only from
  // the Sync screen, but recording it here keeps the invariant local).
  await saveSyncOptIn(true);
  // The reconcile itself lives in run() (see reconcileAccount), so it cannot be
  // missed by a caller that forgets to announce a sign-in. This is just "sync
  // now, please" with a name that says why.
  const merged = await syncNow();
  // Settings follow the identity, not the stats:
  //   signin — this device JOINS another account, so that account's settings
  //            overwrite whatever was here (forced pull).
  //   link   — same account id gains an email, so its settings stay this
  //            device's; make sure the server has them.
  let settings = null;
  if (mode === 'signin') {
    settings = await pullSettings({ force: true });
  } else {
    await pushLocalSettings();
  }
  return { merged, settings };
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
  const [stats, species, queued] = await Promise.all([
    loadStats(),
    loadSpeciesStats(),
    loadOutbox(),
  ]);

  // Subtract what is still in the outbox. Those rounds are already counted in
  // the local rollups AND are about to be pushed as events, so a baseline of
  // the raw totals would put them on the account twice — invisible on this
  // device (it skips its own rows) and wrong on every other one.
  let answered = num(stats && stats.answered);
  let correct = num(stats && stats.correct);
  const sp = {};
  for (const [key, v] of Object.entries(species || {})) {
    sp[key] = {
      name: v.name,
      sci: v.sci,
      image: v.image || null,
      known: num(v.known),
      missed: num(v.missed),
    };
  }
  for (const e of queued) {
    answered -= num(e.answered);
    correct -= num(e.correct);
    for (const [key, d] of Object.entries(e.species || {})) {
      if (!sp[key]) continue;
      sp[key].known -= num(d.known);
      sp[key].missed -= num(d.missed);
    }
  }

  answered = Math.max(0, answered);
  correct = Math.max(0, correct);
  const species2 = {};
  for (const [key, v] of Object.entries(sp)) {
    const known = Math.max(0, v.known);
    const missed = Math.max(0, v.missed);
    if (known || missed) species2[key] = { ...v, known, missed };
  }

  if (!answered && !correct && !Object.keys(species2).length) return;

  await recordEvent({
    answered,
    correct,
    pct: null, // not a round — must not land on the accuracy chart
    species: species2,
  });
  debug('baseline queued:', answered, 'answers');
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
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
    // Turn sync OFF after a delete. The user removed their synced data;
    // silently minting a fresh anonymous account and re-uploading would undo
    // exactly what they asked for. They can turn it back on any time.
    await saveSyncOptIn(false);
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

// Pull settings from the server and adopt them into local storage. Separate
// from syncNow because settings are last-write-wins and stats are not — mixing
// the two merge rules in one function is how you end up applying the wrong one.
//
//   force = false (launch): adopt only when the server's copy is strictly newer
//           than this device's last change, so an offline local change is kept.
//   force = true  (joining an existing account): the server's settings are the
//           account's, so they overwrite whatever this device had.
//
// Returns the adopted { prefs, username } (so the caller can update live state),
// or null when nothing changed. Writes local storage as a side effect.
export async function pullSettings({ force = false } = {}) {
  if (!(await syncOn())) return null;
  try {
    const supabase = getClient();
    const userId = await ensureSession();
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
      .from('settings')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data || !data.data) return null;

    const serverTs = Date.parse(data.updated_at) || 0;
    const localTs = await loadSettingsStamp();
    if (!force && serverTs <= localTs) return null; // local is up to date

    const serverPrefs =
      data.data.prefs && typeof data.data.prefs === 'object' ? data.data.prefs : {};
    const serverUsername = data.data.username || null;

    // Compare against what's actually on disk BEFORE overwriting, so the caller
    // is told exactly whether the deck-defining fields (account + language)
    // moved — and can reload only when they did. Doing this here rather than in
    // the React layer sidesteps a stale-closure trap.
    const localPrefs = await loadPrefs();
    const localUsername = await loadUsername();
    const usernameChanged = !!serverUsername && serverUsername !== localUsername;
    const localeChanged = !!serverPrefs.locale && serverPrefs.locale !== localPrefs.locale;

    const mergedPrefs = { ...localPrefs, ...serverPrefs };
    await savePrefs(mergedPrefs);
    if (serverUsername) await saveUsername(serverUsername);
    await saveSettingsStamp(serverTs || Date.now());
    return { prefs: mergedPrefs, username: serverUsername, usernameChanged, localeChanged };
  } catch {
    return null;
  }
}

// Launch-time settings pull: adopt the server's copy only if it's newer.
export function syncSettings() {
  return pullSettings({ force: false });
}
