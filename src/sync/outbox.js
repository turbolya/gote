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
export async function loadLastPulledAt() {
  try {
    return (await kv.getItem(K_PULLED_AT)) || null;
  } catch {
    return null;
  }
}

export async function saveLastPulledAt(iso) {
  try {
    if (iso) await kv.setItem(K_PULLED_AT, String(iso));
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

// Forget everything we know about what has been pulled. Called on an account
// switch so the new account is re-read from the beginning.
export async function resetPullState() {
  try {
    await kv.multiRemove([K_PULLED_AT, K_APPLIED]);
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
