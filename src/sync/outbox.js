// The outbox: events produced locally that haven't reached the server yet.
//
// Why a queue rather than pushing inline: gote is used in the field, where
// there is often no signal. A round played on a mountain has to count the
// instant it finishes, so local storage is written first and the upload is
// queued for whenever the network comes back. Sync is never in the path of
// anything the player sees.
//
// Kept separate from src/storage.js because that file is the app's own state;
// this is transport bookkeeping that only the sync layer reads.

import * as kv from '../kv';

const K_OUTBOX = '@gote/sync/outbox';
const K_APPLIED = '@gote/sync/appliedIds';
const K_PULLED_AT = '@gote/sync/lastPulledAt';
const K_DEVICE = '@gote/sync/deviceId';
const K_LAST_USER = '@gote/sync/lastUserId';
// The account this device has already contributed its baseline to. Separate
// from K_LAST_USER, which tracks the account it last SYNCED with — the two
// differ exactly when a baseline must be skipped. See loadBaselineUserId.
const K_BASELINE_USER = '@gote/sync/baselineUserId';
const K_OPT_IN = '@gote/sync/optIn';

// Whether the user has turned sync ON. Off by default: a sync-capable build
// still uploads NOTHING and creates no account until this is set. Everything
// else in the sync layer is gated on it, so "off" means the app behaves exactly
// as a build with no credentials would — local only.
export async function loadSyncOptIn() {
  try {
    return (await kv.getItem(K_OPT_IN)) === '1';
  } catch {
    return false;
  }
}

export async function saveSyncOptIn(on) {
  try {
    await kv.setItem(K_OPT_IN, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

// A cap so a long offline stretch (or a server that stays unreachable) can't
// grow the queue without bound. Oldest go first: they are the ones whose
// history matters least if something has to be dropped.
const MAX_OUTBOX = 1000;

export async function loadOutbox() {
  return readJson(K_OUTBOX, []);
}

export async function saveOutbox(events) {
  const arr = Array.isArray(events) ? events : [];
  await writeJson(K_OUTBOX, arr.slice(-MAX_OUTBOX));
}

export async function pushToOutbox(event) {
  const arr = await loadOutbox();
  arr.push(event);
  await saveOutbox(arr);
  return arr.length;
}

// Drop the events that were confirmed uploaded, keeping anything queued while
// the request was in flight.
export async function clearFromOutbox(ids) {
  const gone = new Set(ids || []);
  const arr = await loadOutbox();
  await saveOutbox(arr.filter((e) => !gone.has(e.id)));
}

// Ids already folded into the local rollups. Guards against a redelivered row
// being counted twice — the same job `@gote/watchResultIds` does for the watch.
export async function loadAppliedIds() {
  return readJson(K_APPLIED, []);
}

export async function saveAppliedIds(ids) {
  await writeJson(K_APPLIED, Array.isArray(ids) ? ids : []);
}

// Watermark for the pull query. Server `created_at`, not a local clock, so a
// device with a wrong time can't skip rows it never saw.
// The pull watermark is PER ACCOUNT, and that is what makes returning to an
// account safe.
//
// It used to be a single value, which forced an account switch to throw it away
// — and throwing it away meant re-reading an entire account from the beginning.
// That re-read is only harmless if every event in it is recognised as already
// applied, which put the whole burden on the applied-id ledger; and the ledger
// is capped (2000), so an active player who eventually exceeded the cap would
// have the oldest events silently re-added to totals that already had them.
//
// Keyed by account, none of that arises. Signing back into an account resumes
// from where that account left off — nothing is re-read, so nothing can be
// re-applied — and a genuinely new account simply has no watermark and is read
// from the beginning, which is correct because this device has never seen it.
function pulledKey(userId) {
  return `${K_PULLED_AT}:${userId || 'anon'}`;
}

export async function loadLastPulledAt(userId) {
  try {
    return (await kv.getItem(pulledKey(userId))) || null;
  } catch {
    return null;
  }
}

export async function saveLastPulledAt(userId, iso) {
  try {
    if (iso) await kv.setItem(pulledKey(userId), String(iso));
  } catch {
    /* ignore */
  }
}

// Drop one account's watermark, so the next sync re-reads it from the start.
// Only for an account whose rows are GONE (see deleteAccount) — for anything
// else, re-reading is exactly what we are avoiding.
export async function clearLastPulledAt(userId) {
  try {
    await kv.removeItem(pulledKey(userId));
  } catch {
    /* ignore */
  }
}

// Which account this device last synced with. Signing in on a second device
// switches accounts, and both the pull watermark and the applied-id ledger
// describe the OLD one — leaving them in place would make the app skip the new
// account's entire history, since those rows are older than the watermark.
export async function loadLastUserId() {
  try {
    return (await kv.getItem(K_LAST_USER)) || null;
  } catch {
    return null;
  }
}

export async function saveLastUserId(id) {
  try {
    // Falsy clears it — signing out must not leave the old id behind, or the
    // next sign-in would look like "same account" and skip the reconcile.
    if (id) await kv.setItem(K_LAST_USER, String(id));
    else await kv.removeItem(K_LAST_USER);
  } catch {
    /* ignore */
  }
}

// Forget every account's pull state. Only for "these rows no longer exist"
// (deleteAccount) — never for an ordinary account switch, which is handled by
// the per-account watermark above.
//
// The applied-id ledger deliberately SURVIVES even here, because the rollups
// are a CUMULATIVE FOLD: applyRemote adds each event to totals that already
// include everything folded before it, and nothing can un-apply an event. The
// ledger is the last line between a re-read and silently doubled statistics.
// Clearing the watermark and the ledger together — which this function used to
// do, on every account switch and every sync off/on cycle — re-pulled the full
// history with an empty ledger and added all of it a second time.
//
// Ids are UUIDs, so an id applied once must never be applied again regardless
// of which account it arrives from. There is no case where forgetting one helps.
export async function resetPullState() {
  try {
    const keys = await kv.getAllKeys();
    const stale = (keys || []).filter((k) => k === K_PULLED_AT || k.startsWith(`${K_PULLED_AT}:`));
    if (stale.length) await kv.multiRemove(stale);
  } catch {
    /* ignore */
  }
}

// Which account this device last uploaded its baseline to.
//
// The baseline re-sends this device's whole history so an account it is joining
// does not start empty. Sending it twice to the SAME account is pure
// duplication — the second copy has a fresh event id, so the ledger cannot
// recognise it, and every other device adds it on top of the first. That is
// what a sync off/on cycle used to do: sign out, mint a new anonymous account,
// baseline into it, sign back in, baseline again.
export async function loadBaselineUserId() {
  try {
    return (await kv.getItem(K_BASELINE_USER)) || null;
  } catch {
    return null;
  }
}

export async function saveBaselineUserId(id) {
  try {
    if (id) await kv.setItem(K_BASELINE_USER, String(id));
    else await kv.removeItem(K_BASELINE_USER);
  } catch {
    /* ignore */
  }
}

// A stable per-install id, so a device can recognise its own rows on pull and
// skip re-applying what it already counted locally.
export async function getDeviceId() {
  try {
    const existing = await kv.getItem(K_DEVICE);
    if (existing) return existing;
    const id = uid();
    await kv.setItem(K_DEVICE, id);
    return id;
  } catch {
    return 'unknown';
  }
}

// UUID v4 shape from Math.random. Deliberately not expo-crypto: these ids are
// only ever compared for equality, never used as secrets or as anything an
// attacker could gain from guessing, so cryptographic randomness would buy
// nothing and cost a native module (and therefore a rebuild) to install.
// A DETERMINISTIC event id for the baseline, derived from the device and the
// account it is being sent to. Belt to the braces of the loadBaselineUserId
// guard: `id` is the table's primary key and push upserts with
// ignoreDuplicates, so even if this device somehow tries to baseline the same
// account twice, the second one lands on its own row and is discarded
// server-side instead of becoming a duplicate every other device adds up.
//
// Not a real UUIDv5 (no SHA-1 available here without a dependency), but it only
// has to be stable, well-distributed and shaped like a UUID — the column is
// `uuid`, and collisions across different (device, account) pairs would have to
// beat a 128-bit hash of two random UUIDs.
export function baselineUid(deviceId, userId) {
  const seed = `gote-baseline|${deviceId || ''}|${userId || ''}`;
  // Four independently-salted FNV-1a passes → 16 bytes of hex.
  let hex = '';
  for (let salt = 0; salt < 4; salt++) {
    let h = 0x811c9dc5 ^ (salt * 0x01000193);
    const s = `${salt}:${seed}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    hex += h.toString(16).padStart(8, '0');
  }
  // Stamp the version (4) and variant nibbles so it is a well-formed UUID.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function readJson(key, fallback) {
  try {
    const raw = await kv.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(fallback) && !Array.isArray(parsed) ? fallback : parsed;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  try {
    await kv.setItem(key, JSON.stringify(value));
  } catch {
    /* best-effort */
  }
}
