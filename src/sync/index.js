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
  loadStatsByFormat,
  saveStatsByFormat,
  addToStatsByFormat,
  loadSpeciesStats,
  saveSpeciesStats,
  loadConfusions,
  saveConfusions,
  loadConfusionNotes,
  saveConfusionNotes,
  loadFlagsRecord,
  saveFlagsRecord,
  loadHistory,
  loadHistoryCounts,
  loadBars,
  saveBars,
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
  loadBaselineUserId,
  saveBaselineUserId,
  clearLastPulledAt,
  resetPullState,
  getDeviceId,
  loadSyncOptIn,
  saveSyncOptIn,
  uid,
  baselineUid,
  sanitizeEvent,
  loadPendingBaseline,
  savePendingBaseline,
  clearPendingBaseline,
} from './outbox';
import {
  localDay,
  applyEvents,
  streakFromDays,
  trimLedger,
  buildSettingsPayload,
  upgradeSettingsPayload,
  notesFromPayload,
  mergeNotes,
  displayNotes,
  flagsFromPayload,
  mergeFlags,
  flaggedIds,
  subtractConfusions,
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

// Why the last push failed, for the Sync screen. Without this a rejected push
// is completely silent: the screen shows "1 round waiting upload" and the user
// has no way to learn that it is being refused rather than merely delayed.
// Not persisted — the next sync attempt sets it again.
let lastPushError = null;

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
//   n                 cards the `pct` round covered — the weight every aggregate
//                     over the chart uses. Sent separately from `answered`
//                     because a watch round banks its cards one at a time and
//                     reports answered: 0, yet still draws a bar
//   species           { [taxonId]: { name, sci, image, known, missed } }
//   formats           { [format]: { answered, correct } } — Smart play mixes
//                     question formats of very different difficulty in one
//                     round, so the totals are split to stay interpretable
//   bars              identified chart points [{ id, pct, n, at }]. A round
//                     ships the single bar it created; a baseline ships the
//                     device's whole chart. Folding is a union by id, so
//                     re-sending one changes nothing
//   history           legacy chart array, for clients that predate `bars`
//   counts            baseline only: cards per bar, right-aligned with `history`
//                     (shorter when the device has bars from before sizes were
//                     recorded); a normal round leaves this empty and rides `n`
//   days              baseline only: the active local days the streak is built
//                     from; a normal round leaves this empty and rides `local_day`
//   id                optional: supply a DETERMINISTIC id when the event must
//                     be idempotent across retries and reinstalls (the baseline
//                     does — see baselineUid). Omit for ordinary play, where a
//                     fresh random id per round is exactly right.
export async function recordEvent({ answered = 0, correct = 0, pct = null, n = 0, species = {}, formats = {}, confusions = {}, bars = [], history = [], counts = [], days = [], ts = Date.now(), id = null } = {}) {
  // Nothing is even queued while sync is off — no sync-related data touches disk
  // until the user opts in. Their existing history is captured wholesale by the
  // baseline at that point (see uploadBaseline), so nothing is lost.
  if (!(await syncOn())) return null;
  try {
    // sanitizeEvent owns the numeric clamping (see src/sync/outbox.js): the
    // table's CHECK constraints reject a bad row permanently AND take the rest
    // of the batch down with it, so nothing may leave here out of range.
    const event = sanitizeEvent({
      id: id || uid(),
      device_id: await getDeviceId(),
      ts: new Date(ts).toISOString(),
      local_day: localDay(ts),
      answered,
      correct,
      pct,
      n,
      species: species || {},
      formats: formats || {},
      confusions: confusions || {},
      // Identified chart bars. A round ships the one it just created, so every
      // other device adopts THAT id instead of deriving its own — which is what
      // makes a re-send a no-op rather than a second bar. `pct`/`n` ride along
      // for clients that predate bars.
      bars: Array.isArray(bars) ? bars : [],
      history: Array.isArray(history) ? history : [],
      counts: Array.isArray(counts) ? counts : [],
      days: Array.isArray(days) ? days : [],
    });
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
    // The "my tell" notes and flags ride along as `n:<pairKey>` / `f:<user>:<id>`
    // keys. Loaded here so every settings write carries the latest; the DB
    // shallow-merge keeps each key independent, so this never erases a note or
    // flag changed on another device. Flags are per-username.
    const notes = await loadConfusionNotes();
    const flags = username ? await loadFlagsRecord(username) : {};
    const { error } = await supabase.from('settings').upsert(
      {
        user_id: userId,
        // Versioned payload; only the keys this client owns. The DB shallow-
        // merges on write, so newer keys added by a later client survive.
        data: buildSettingsPayload(prefs, username, notes, flags),
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
    const { discarded } = (await push(supabase, userId)) || {};
    await confirmBaseline(userId, discarded);
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
    // Nothing to reset. The watermark is per account, so this account already
    // remembers how far it got (resume, re-read nothing) or has none yet (read
    // from the start, which is right because this device has never seen it).
    // Wiping pull state here is what used to re-fold an account's whole history
    // into rollups that already contained it — see resetPullState.
  } else {
    debug('first sync for this device');
  }
  // "Different account from last sync" is not the same question as "an account
  // that has never seen this device's history". Turning sync off and on lands
  // here twice — once for the throwaway anonymous account, once for the real
  // one signed back into — and without this guard the second pass re-sends a
  // baseline the account already has.
  const baselined = await loadBaselineUserId();
  let pendingBaselineId = null;
  if (baselined === userId) {
    debug('baseline already sent to', userId, '— skipping');
  } else {
    // Marking the account as baselined HERE was a quiet way to lose a device's
    // whole history: uploadBaseline only queues the event, so if the push that
    // follows never succeeds the account keeps no baseline while the device is
    // certain it sent one, and reconcileAccount never tries again. The mark now
    // waits until the row has actually left (see confirmBaseline).
    // Supersede a baseline still queued for a PREVIOUS account. Ordinary rounds
    // are deltas, so re-stamping a queued one onto the account the device is
    // signed into now is right and loses nothing. A baseline is not a delta, it
    // is a snapshot of everything this device has — so a stale one would be
    // pushed beside the fresh snapshot and draw this device's chart twice. (The
    // totals happened to survive, because uploadBaseline deducts the outbox and
    // the second snapshot came out at zero; the bars did not.) Dropping it first
    // also means the fresh snapshot is computed WITHOUT it, so it carries the
    // full history rather than a remainder.
    const stale = await loadPendingBaseline();
    if (stale) {
      debug('superseding a baseline queued for', stale.userId);
      await clearFromOutbox([stale.eventId]);
      await clearPendingBaseline();
    }
    pendingBaselineId = await uploadBaseline(userId);
    // Remembered on DISK, not just for the rest of this run: the push carrying
    // it may not succeed for days, and reconcileAccount returns early on every
    // sync after the first, so a purely in-memory hand-off would never be
    // confirmed at all.
    if (pendingBaselineId) await savePendingBaseline(userId, pendingBaselineId);
    // Nothing to contribute — a genuinely empty device. That IS done, so mark it
    // and don't come back.
    else await saveBaselineUserId(userId);
  }
  await saveLastUserId(userId);
  return pendingBaselineId;
}

// Record "this device has contributed to this account" only once the baseline
// row has genuinely gone. It has, when it is no longer queued AND was not thrown
// away as unacceptable — a discarded row leaves the outbox too, and treating
// that as success is exactly the confusion this guards against.
//
// Runs on EVERY sync rather than only the one that queued the baseline, because
// the push that carries it may fail for a long time first.
async function confirmBaseline(userId, discarded) {
  const pending = await loadPendingBaseline();
  if (!pending || pending.userId !== userId) return;
  if (discarded && discarded.includes(pending.eventId)) {
    debug('baseline was rejected outright — not marking', userId);
    await clearPendingBaseline();
    return;
  }
  const stillQueued = (await loadOutbox()).some((e) => e && e.id === pending.eventId);
  if (stillQueued) {
    debug('baseline still queued — will mark once it lands');
    return;
  }
  await saveBaselineUserId(userId);
  await clearPendingBaseline();
}

async function push(supabase, userId) {
  const queued = await loadOutbox();
  if (!queued.length) return { discarded: [] };
  const rows = queued.map((e) => ({ ...e, user_id: userId }));
  // ON CONFLICT DO NOTHING, not DO UPDATE. A push that succeeded server-side
  // but whose response never arrived must not fail forever on the duplicate
  // primary key and wedge the queue — but the row already there is the truth,
  // and re-writing it is exactly what an append-only log must never do.
  //
  // It also has to be DO NOTHING for a more mundane reason: DO UPDATE requires
  // UPDATE privilege at plan time, whether or not a conflict happens, and
  // `events` deliberately grants none.
  const send = (batch) =>
    supabase.from('events').upsert(batch, { onConflict: 'id', ignoreDuplicates: true });

  const { error } = await send(rows);
  if (!error) {
    lastPushError = null;
    debug('pushed', rows.length);
    await clearFromOutbox(rows.map((r) => r.id));
    return { discarded: [] };
  }

  // The batch failed. It is one statement, so ONE unacceptable row takes every
  // other round down with it — and a row rejected by a CHECK constraint is
  // rejected forever, which used to wedge the queue permanently: nothing more
  // ever uploaded, the outbox grew to its 1000 cap, and the oldest rounds were
  // then dropped unseen. Retry row by row so the good ones still land.
  debug('batch push rejected —', error.message, '— retrying individually');
  const stuck = [];
  const sent = [];
  for (const row of rows) {
    const { error: e } = await send([row]);
    if (!e) {
      sent.push(row.id);
    } else if (isPermanentReject(e)) {
      // This row can never be accepted. Dropping it loses one round from the
      // account, which is the lesser harm: keeping it loses ALL of them.
      debug('dropping unacceptable event', row.id, '—', e.code, e.message);
      sent.push(row.id);
      stuck.push({ id: row.id, code: e.code, message: e.message });
    }
    // Anything else (offline, rate-limited, 5xx) stays queued for next time.
  }
  if (sent.length) await clearFromOutbox(sent);
  lastPushError = stuck.length
    ? `${stuck.length} round(s) could not be uploaded and were discarded: ${stuck[0].message}`
    : error.message;
  if (stuck.length) debug('discarded', stuck.length, 'unacceptable events');
  return { discarded: stuck.map((r) => r.id) };
}

// Is this rejection one that retrying can never fix? A constraint violation or
// a malformed value describes the ROW, not the moment — the same bytes will be
// refused on every attempt. Network, rate-limit and 5xx failures are the
// opposite and must stay queued.
//   23514 check_violation · 23502 not_null_violation · 23503 fk_violation
//   22P02 invalid_text_representation · 22003 numeric_value_out_of_range
//   22007 invalid_datetime_format · 22008 datetime_field_overflow
//   PGRST204 unknown column (client newer than the database)
//
// 22007 is here because the integration suite caught its absence: a malformed
// `local_day` comes back as 22007, not the 22P02 you would expect from a bad
// text value, so a row with a broken date wedged the queue for ever — the exact
// failure this function exists to stop.
function isPermanentReject(e) {
  const code = String((e && e.code) || '');
  return ['23514', '23502', '23503', '22P02', '22003', '22007', '22008', 'PGRST204'].includes(code);
}

async function pull(supabase, userId) {
  const since = await loadLastPulledAt(userId);
  const deviceId = await getDeviceId();

  let query = supabase
    .from('events')
    .select('id, device_id, ts, local_day, answered, correct, pct, n, species, formats, confusions, bars, history, counts, days, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(PULL_LIMIT);
  // Keyset cursor: strictly after (created_at, id). The id tiebreak is what
  // stops rows sharing a created_at with the last row of a page from being
  // skipped — see loadLastPulledAt.
  if (since && since.iso) {
    query = since.id
      ? query.or(
          `created_at.gt."${since.iso}",and(created_at.eq."${since.iso}",id.gt.${since.id})`
        )
      : query.gt('created_at', since.iso);
  }

  const { data, error } = await query;
  if (error || !data) return null;
  if (!data.length) {
    await recoverEmptiedAccount(supabase, userId);
    return null;
  }

  // Our own rows were counted locally the moment they were played. Re-applying
  // them would double every number on this device.
  const foreign = data.filter((e) => e.device_id !== deviceId);
  const last = data[data.length - 1];
  const newest = last.created_at;
  const newestId = last.id;

  if (!foreign.length) {
    await saveLastPulledAt(userId, newest, newestId);
    return null;
  }

  const changed = await applyRemote(foreign);
  await saveLastPulledAt(userId, newest, newestId);
  return changed;
}

// Notice an account that has become EMPTY under a device that believes it has
// already contributed to it, and re-send the baseline.
//
// This is the one contradiction the normal bookkeeping cannot resolve on its
// own, and it is silent. `baselineUserId` says "I already sent my history to
// this account" and the watermark points past rows that no longer exist, so the
// device uploads nothing and pulls nothing — forever. Rows can go out from under
// it in more ways than one: deleted by hand in the dashboard, lost to a restore
// from an older backup, or wiped by a project reset. None of that reaches the
// client, so it has to be inferred.
//
// The inference is sound because it is a provable contradiction rather than a
// heuristic: if this device really had baselined this account, the account
// cannot be empty. It is deliberately narrow — the probe runs only when a pull
// came back with nothing at all, and only for a device that claims to have
// baselined — and it costs one indexed `limit(1)` lookup, not a count.
//
// Re-sending is safe even if the diagnosis were somehow wrong: the baseline's id
// is derived from (device, account), so a copy that is already there collides
// with itself and the upsert drops it rather than double-counting.
async function recoverEmptiedAccount(supabase, userId) {
  // Never claimed to have sent one — an empty account is simply new.
  if ((await loadBaselineUserId()) !== userId) return;
  // Anything still queued means "not uploaded yet", not "the account lost it".
  // Concluding emptiness here would re-baseline on every offline sync.
  if ((await loadOutbox()).length) return;

  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (error || !data || data.length) return; // errored, or the account has rows

  debug('account', userId, 'is empty but this device baselined it — re-sending');
  // Rewind too: rows may have been restored from a backup whose created_at
  // predates the watermark, which would otherwise stay invisible. Safe, because
  // the applied-id ledger survives and skips anything already folded in.
  await clearLastPulledAt(userId);
  await uploadBaseline(userId);
  // Flush now rather than waiting for the next sync — the account is empty and
  // every other device is looking at nothing.
  await push(supabase, userId);
}

// Fold remote events into the local rollups. The ONLY place sync writes to the
// app's own state, and it only ever adds.
async function applyRemote(events) {
  const [stats, formats, species, bars, streak, confusions, appliedIds] = await Promise.all([
    loadStats(),
    loadStatsByFormat(),
    loadSpeciesStats(),
    loadBars(),
    loadStreak(),
    loadConfusions(),
    loadAppliedIds(),
  ]);
  const days = await backfillActiveDays(streak);

  const { rollups, applied } = applyEvents(
    { stats, formats, species, bars, days, confusions },
    events,
    appliedIds
  );
  if (!applied.length) return null; // all duplicates

  const merged = streakFromDays(rollups.days);

  await Promise.all([
    saveStats(rollups.stats),
    saveStatsByFormat(rollups.formats),
    saveSpeciesStats(rollups.species),
    // Bars, not the derived arrays: identity is what makes the fold a union.
    saveBars(rollups.bars),
    saveActiveDays(rollups.days),
    saveConfusions(rollups.confusions),
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
    formats: rollups.formats,
    species: rollups.species,
    history: rollups.history,
    historyCounts: rollups.counts,
    streak: await loadStreak(),
    confusions: rollups.confusions,
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
      // Why those queued rounds are still queued, when we know. A count on its
      // own cannot distinguish "waiting for a network" from "being refused".
      pushError: lastPushError,
    };
  } catch {
    return { enabled: true, on: true, signedIn: false, anonymous: true, email: null, queued: 0, pushError: lastPushError };
  }
}

// Turn sync ON. Records consent, then syncs: the first run signs the device in
// anonymously and uploads a baseline of everything played so far, so nothing
// already on the device is left behind. Returns the merge summary (or null).
// Re-send this device's history to the account, for the case where the baseline
// went up WRONG and the normal machinery cannot notice.
//
// How that happens: uploadBaseline deliberately subtracts whatever is sitting in
// the outbox, because those rounds are about to be pushed as their own events.
// If that push then fails permanently — one row the table's CHECK constraints
// refuse takes the whole batch with it — the account keeps a baseline with the
// rounds deducted and nothing to replace them. `baselineUserId` is already
// recorded, so reconcileAccount never tries again, and the baseline id is stable
// per (device, account), so even a forced retry collides with the wrong row and
// is dropped. The history is stranded on the device, silently and permanently.
//
// The subtlety is what "this device's history" means. Local totals are NOT it:
// a device that has joined an account has folded other devices' events into the
// same numbers, and re-sending those would put the other devices' rounds on the
// account a second time, for everyone. So deduct exactly what was merged.
//
// An earlier version refused outright when anything had been merged. That was
// useless in practice — a device signs in and PULLS before anything else, so the
// ledger is never empty by the time someone notices history is missing, and the
// repair refused precisely when it was needed. The integration suite caught it.
//
// Only events this device actually APPLIED are deducted (the applied-id ledger).
// A foreign event not yet folded in is not in the local totals either, so
// subtracting it would leave the account short by that much instead.
// Every event on the account, a page at a time. A single select is capped
// (PostgREST defaults, and PULL_LIMIT above), and a partial list here would mean
// a partial subtraction — i.e. re-sending rounds the account already has.
async function fetchAllEvents(supabase, userId) {
  const PAGE = 500;
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('events')
      .select('id, device_id, answered, correct, species, formats, confusions')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { error: error.message };
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return { rows };
  }
}

export async function recontributeHistory() {
  if (!(await syncOn())) return { ok: false, error: 'sync-off' };
  const supabase = getClient();
  const userId = await ensureSession();
  if (!supabase || !userId) return { ok: false, error: 'not-signed-in' };

  // Converge FIRST. Everything below rests on "the local totals contain every
  // event on the account", so pull until nothing new arrives — a single pass
  // moves at most PULL_LIMIT rows, and an account with more than that would
  // otherwise leave rows unapplied and get them subtracted anyway, sending less
  // than this device actually owns. Bounded, because a device that never
  // converges must not spin here.
  for (let i = 0; i < 10; i += 1) {
    const changed = await syncNow();
    if (!changed) break;
  }

  const { rows, error } = await fetchAllEvents(supabase, userId);
  if (error) return { ok: false, error };

  // Deduct EVERY event on the account, this device's and the other devices'
  // alike. Both are already in the local totals by now — a foreign event
  // because the loop above merged it, an own event because it was counted when
  // it was played — and both are already on the account, so what is left over is
  // exactly the part that never got there.
  //
  // Deliberately NOT filtered by the applied-id ledger. The ledger is capped
  // (trimLedger, 2000), so on a long-lived account the ids of events merged long
  // ago fall out of it, and asking it "did I merge this?" returns a false
  // negative — which sent another device's rounds back to it. The integration
  // suite caught that; converging first makes the question unnecessary.
  const merged = rows;

  // Note there is no bar accounting here any more. Bars fold by id, so the
  // baseline can ship the whole chart and anything the account already has is
  // simply ignored.
  //
  // A fresh id on purpose: the deterministic one is already taken by the bad row.
  await uploadBaseline(userId, { id: uid(), alsoSubtract: merged });
  await saveBaselineUserId(userId);
  const queued = await loadOutbox();
  await syncNow();
  // Report what is left queued, so a caller can tell "sent" from "still stuck".
  const after = await loadOutbox();
  return { ok: true, sent: queued.length, stillQueued: after.length };
}

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

// One event carrying this device's history, so joining an existing account
// contributes it instead of discarding it. Beyond the lifetime totals and
// per-species tallies, the baseline carries the accuracy-chart bars (`history`)
// and the active-day set the streak is built from (`days`) — so a joining device
// reconstructs the whole hero, not just the lifetime number over an empty chart.
// `id` overrides the deterministic baseline id. Recovery needs that: the normal
// id is stable per (device, account) precisely so a retry collides with the row
// already there — which also means a baseline that went up WRONG can never be
// corrected by re-sending it. See recontributeHistory.
// `alsoSubtract` is a further list of events to deduct, alongside the outbox.
// Recovery needs it: a device that has already folded in another device's
// events holds totals that are no longer only its own, and re-sending them
// would put that other device's rounds on the account a second time. Deducting
// exactly what it merged leaves its OWN history, which is the thing to re-send.
async function uploadBaseline(userId, { id: idOverride = null, alsoSubtract = [] } = {}) {
  const [stats, fmts, species, confusions, history, counts, activeDays, streak, queued] = await Promise.all([
    loadStats(),
    loadStatsByFormat(),
    loadSpeciesStats(),
    loadConfusions(),
    loadHistory(),
    loadHistoryCounts(),
    loadActiveDays(),
    loadStreak(),
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
      // Retrieval signals ride along, or a device joining an account arrives
      // with tallies but no history behind them (src/recall.js).
      lastSeen: num(v.lastSeen),
      msTotal: num(v.msTotal),
      msCount: num(v.msCount),
      points: num(v.points),
      weight: num(v.weight),
    };
  }
  // The per-format split is a set of counters like everything else, so it needs
  // the same "minus what's queued" treatment.
  const fmt = {};
  for (const [k, v] of Object.entries(fmts || {})) {
    fmt[k] = { answered: num(v && v.answered), correct: num(v && v.correct) };
  }
  // Confusions get the same "minus what's queued" treatment as the totals above.
  let conf = confusions || {};
  for (const e of [...queued, ...(alsoSubtract || [])]) {
    answered -= num(e.answered);
    correct -= num(e.correct);
    for (const [k, d] of Object.entries(e.formats || {})) {
      if (!fmt[k]) continue;
      fmt[k].answered -= num(d && d.answered);
      fmt[k].correct -= num(d && d.correct);
    }
    for (const [key, d] of Object.entries(e.species || {})) {
      if (!sp[key]) continue;
      sp[key].known -= num(d.known);
      sp[key].missed -= num(d.missed);
      // Additive, so they need the same subtraction. `lastSeen` deliberately
      // does NOT: it folds by max, so re-sending it is idempotent — and
      // subtracting a max is not a thing that means anything.
      sp[key].msTotal -= num(d.msTotal);
      sp[key].msCount -= num(d.msCount);
      sp[key].points -= num(d.points);
      sp[key].weight -= num(d.weight);
    }
    if (e.confusions) conf = subtractConfusions(conf, e.confusions);
  }

  answered = Math.max(0, answered);
  correct = Math.max(0, correct);
  const formats2 = {};
  for (const [k, v] of Object.entries(fmt)) {
    const a = Math.max(0, v.answered);
    const c = Math.max(0, v.correct);
    if (a || c) formats2[k] = { answered: a, correct: c };
  }
  const species2 = {};
  for (const [key, v] of Object.entries(sp)) {
    const known = Math.max(0, v.known);
    const missed = Math.max(0, v.missed);
    const msTotal = Math.max(0, v.msTotal);
    // A count without a total (or vice versa) would poison the mean, so they
    // are floored together: either both survive the subtraction or neither.
    const msCount = msTotal > 0 ? Math.max(0, v.msCount) : 0;
    // Floored together for the same reason: points without their weight would
    // read as an impossible rate.
    const weight = Math.max(0, v.weight);
    const points = weight > 0 ? Math.max(0, v.points) : 0;
    if (known || missed) species2[key] = { ...v, known, missed, msTotal, msCount, points, weight };
  }

  // The chart. Just send it: bars carry ids and fold by union, so a bar the
  // account already has is ignored rather than drawn twice. That single
  // property replaced three separate mechanisms here — a positional trim of
  // queued rounds, a value-matching removal, and bespoke accounting in the
  // repair path — none of which are needed any more.
  //
  // `history`/`counts` are deliberately NOT sent from a baseline. A client that
  // predates bars cannot dedupe them, so handing it a whole chart is how it
  // ends up drawing rounds twice. It keeps getting per-round `pct` events,
  // which are safe; it just doesn't inherit a joining device's back catalogue.
  const bars = await loadBars();

  // Active days: send the full set. A day is a SET member on the other side, so a
  // day a still-queued round will re-add folds in exactly once — no subtraction
  // needed. Seed from the streak's one remembered day for a player who predates
  // the day-set (mirrors backfillActiveDays on the receiving side).
  let baseDays = Array.isArray(activeDays) ? activeDays : [];
  if (!baseDays.length && streak && streak.lastActiveDay) baseDays = [streak.lastActiveDay];

  if (
    !answered && !correct
    && !Object.keys(species2).length && !Object.keys(conf).length
    && !Object.keys(formats2).length
    && !bars.length && !baseDays.length
  ) return;

  const queuedId = await recordEvent({
    answered,
    correct,
    pct: null, // the baseline itself is not a round; its bars ride in `history`
    species: species2,
    formats: formats2,
    confusions: conf,
    bars,
    history: [],
    counts: [],
    days: baseDays,
    // Stable per (device, account), so a second attempt collides with the row
    // already there and is dropped by the upsert rather than double-counting on
    // every other device — unless a caller deliberately supplies a fresh one.
    id: idOverride || baselineUid(await getDeviceId(), userId),
  });
  debug('baseline queued:', answered, 'answers,', bars.length, 'bars,', baseDays.length, 'days');
  // The caller marks the account as baselined only once this row has actually
  // left the outbox, so it needs to know which row to watch.
  return queuedId;
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
    // The baseline marker goes too: the account it referred to is gone, so a
    // future account must get this device's history again.
    await Promise.all([
      resetPullState(),
      saveOutbox([]),
      saveLastUserId(''),
      saveBaselineUserId(''),
      // The queued baseline it referred to went with the outbox, and the account
      // it was for no longer exists.
      clearPendingBaseline(),
    ]);
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
// anything.
//
// Pull state is deliberately KEPT. Signing out is not "forget this account" —
// turning sync off and on again, or signing back in later, is the common path,
// and the account's watermark is exactly what makes the return trip re-read
// nothing. The baseline marker stays for the same reason: that account already
// has this device's history and must not be sent it twice.
export async function signOutAndReset() {
  if (!SYNC_ENABLED) return;
  try {
    await authSignOut();
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

    // Notes merge per note by their own timestamp, independent of the prefs
    // last-write-wins clock — so a note edited on another device is adopted even
    // when this device's *settings* are newer. Done first, before the prefs gate.
    const remoteNotes = notesFromPayload(data.data);
    let noteDisplay = null;
    if (Object.keys(remoteNotes).length) {
      const merged = mergeNotes(await loadConfusionNotes(), remoteNotes);
      await saveConfusionNotes(merged);
      noteDisplay = displayNotes(merged);
    }

    // Flags merge the same way, per flag, scoped to the account name in the blob.
    const blobUsername = (data.data && data.data.username) || null;
    const remoteFlags = flagsFromPayload(data.data, blobUsername);
    let flagIds = null;
    if (blobUsername && Object.keys(remoteFlags).length) {
      const merged = mergeFlags(await loadFlagsRecord(blobUsername), remoteFlags);
      await saveFlagsRecord(blobUsername, merged);
      flagIds = flaggedIds(merged);
    }

    const serverTs = Date.parse(data.updated_at) || 0;
    const localTs = await loadSettingsStamp();
    // Prefs aren't newer: still surface any merged notes/flags so the UI updates.
    if (!force && serverTs <= localTs) {
      return noteDisplay || flagIds ? { notes: noteDisplay, flags: flagIds } : null;
    }

    // Upcast whatever shape the server holds to the current one before reading,
    // so a blob written by an older (or newer) client is understood, not misread.
    const payload = upgradeSettingsPayload(data.data);
    const serverPrefs =
      payload.prefs && typeof payload.prefs === 'object' ? payload.prefs : {};
    const serverUsername = payload.username || null;

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
    return { prefs: mergedPrefs, username: serverUsername, usernameChanged, localeChanged, notes: noteDisplay, flags: flagIds };
  } catch {
    return null;
  }
}

// Launch-time settings pull: adopt the server's copy only if it's newer.
export function syncSettings() {
  return pullSettings({ force: false });
}
