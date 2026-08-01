// Pure merge logic for cross-device sync. No network, no storage, no React —
// everything here is a plain function over plain data, so scripts/test-sync.js
// can exercise the cases that actually matter (a second device replaying a
// month of events, a duplicate delivery, a clock that disagrees) without a
// simulator or a Supabase project.
//
// The model: an EVENT is one delta — "+n answered, +m correct, on this local
// day, with these per-species tallies". A finished round is one event; a single
// watch answer is one event. Events are append-only and carry a client-made id,
// so applying the same one twice is a no-op and order never matters.
//
// Deliberately NOT here: anything that reads or writes. Keeping this file free
// of I/O is what makes the merge testable, and the merge is the only part where
// a bug silently destroys a user's history.

// A local-calendar day key (YYYY-MM-DD) for a timestamp. Matches storage.js's
// dayKey: built from local date parts, never from an ISO/UTC string, so a
// player at 00:30 local time gets today rather than yesterday.
export function localDay(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// The empty rollup set — the shape every screen already reads from storage.
export function emptyRollups() {
  return {
    stats: { answered: 0, correct: 0 },
    species: {},
    history: [],
    days: [],
    confusions: {},
  };
}

// Fold one event into a rollup set, returning a NEW set (never mutates the
// input, so a failed sync can't leave half-applied state behind).
//
// `days` accumulates the set of active local days rather than a streak count.
// A streak derived from a day-set is inherently correct under sync: events can
// arrive late, out of order, or from a device that was offline for a week, and
// the answer is the same because set union doesn't care about order. Syncing
// {current, longest} instead would need every device to agree on history it
// may not have seen yet.
export function applyEvent(rollups, event) {
  const r = rollups || emptyRollups();
  if (!event || typeof event !== 'object') return r;

  const answered = num(event.answered);
  const correct = num(event.correct);

  const species = { ...r.species };
  const inc = event.species && typeof event.species === 'object' ? event.species : {};
  for (const key of Object.keys(inc)) {
    const d = inc[key] || {};
    const prev = species[key] || { known: 0, missed: 0 };
    species[key] = {
      // Names/images travel with the delta so a species first seen on another
      // device still renders on this one. Keep whatever we already had —
      // the local copy came from the full deck and is the better source.
      name: prev.name || d.name || '',
      sci: prev.sci || d.sci || '',
      image: prev.image || d.image || null,
      known: num(prev.known) + num(d.known),
      missed: num(prev.missed) + num(d.missed),
    };
  }

  // Accuracy-chart points. A finished round carries ONE (`pct`). A first-sync
  // BASELINE carries the device's whole chart at once as `history: [pct, …]`, so
  // a joining device shows the bars it played before sync — not just the lifetime
  // total over an empty chart. A single answer has neither (`pct` null, no array):
  // one card is not a round and must not spike the chart with a 0%/100% point.
  let history = r.history;
  if (Array.isArray(event.history) && event.history.length) {
    history = [...history, ...event.history.map((p) => clamp(Math.round(num(p)), 0, 100))];
  }
  if (event.pct != null) {
    history = [...history, clamp(Math.round(num(event.pct)), 0, 100)];
  }

  // Active days (the streak is computed from this set). This event's own
  // `local_day`, plus any day-set a baseline carries (`days: [YYYY-MM-DD, …]`).
  // A SET, so a day that arrives from both a baseline and a later round — or from
  // two devices — folds in exactly once.
  const daySet = new Set(r.days);
  const day = event.localDay || event.local_day;
  if (day) daySet.add(day);
  if (Array.isArray(event.days)) for (const d of event.days) { if (d) daySet.add(d); }
  const days = daySet.size === r.days.length ? r.days : [...daySet];

  // Confusions are counters too, so they fold exactly like species/stats: sum
  // this event's delta into the running matrix. Absent on older events.
  const confusions =
    event.confusions && typeof event.confusions === 'object'
      ? mergeConfusions(r.confusions || {}, event.confusions)
      : r.confusions || {};

  return {
    stats: {
      answered: r.stats.answered + answered,
      correct: r.stats.correct + correct,
    },
    species,
    history,
    days,
    confusions,
  };
}

// Fold many events, skipping any whose id has already been applied. Returns
// the new rollups plus the ids consumed, so the caller can extend its ledger
// in the same step it commits the rollups.
export function applyEvents(rollups, events, appliedIds = []) {
  const seen = new Set(appliedIds);
  let out = rollups || emptyRollups();
  const applied = [];
  for (const e of sortEvents(events || [])) {
    if (!e || e.id == null) continue;
    if (seen.has(e.id)) continue; // duplicate delivery, or already counted
    seen.add(e.id);
    applied.push(e.id);
    out = applyEvent(out, e);
  }
  return { rollups: out, applied };
}

// Oldest first. Only affects the ORDER of the accuracy chart — totals and the
// day set are order-independent — but the chart is a time series, so events
// pulled from another device have to slot in chronologically.
export function sortEvents(events) {
  return [...events].sort((a, b) => tsOf(a) - tsOf(b));
}

// Current + longest streak from a set of active local days. Same rules as the
// on-device streak: consecutive calendar days, and a run that didn't include
// today or yesterday has lapsed, so `current` is 0.
export function streakFromDays(days, now = Date.now()) {
  const sorted = [...new Set(days || [])].filter(Boolean).sort();
  if (!sorted.length) return { current: 0, longest: 0, lastActiveDay: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === nextDay(sorted[i - 1])) run += 1;
    else run = 1;
    if (run > longest) longest = run;
  }

  const today = localDay(now);
  const yesterday = prevDay(today);
  const last = sorted[sorted.length - 1];

  // Trailing run length, but only if it reaches today or yesterday — otherwise
  // the streak is broken and shows 0, matching streakStatus() on the phone.
  let current = 0;
  if (last === today || last === yesterday) {
    current = 1;
    for (let i = sorted.length - 1; i > 0; i--) {
      if (sorted[i - 1] === prevDay(sorted[i])) current += 1;
      else break;
    }
  }

  return { current, longest: Math.max(longest, current), lastActiveDay: last };
}

// --- settings payload versioning -------------------------------------------
//
// `settings.data` is a single jsonb blob synced last-write-wins. As the app
// grows (custom decks, deck-sharing prefs, …) new top-level keys join it, and
// two things have to stay true no matter how old the client on the other end
// is. See docs/SCHEMA-CHANGELOG.md for the running record.
//
//  1. A NEW reader must understand an OLD blob. That is what `v` and the
//     upcaster below are for: `v` is a version HINT, never a gate — an older
//     client that predates `v` just omits it, and the reader treats that as v0.
//  2. An OLD writer must not erase a NEW key it has never heard of. That is not
//     solved here — it is solved in the database: the settings table shallow-
//     merges `data` on write (migration 20260727…_settings_merge.sql), so a
//     client only ever contributes the keys it knows and leaves the rest intact.
//     Because the merge is shallow, every independently-evolving concern must be
//     its OWN top-level key (don't bury a new toggle inside `prefs`).
export const SETTINGS_PAYLOAD_VERSION = 2;

// v2: the player's "my tell" notes join the payload — each as its OWN top-level
// key `n:<pairKey>`, so the database shallow-merge protects them independently
// (a single `notes` object would let a device that edited one note clobber a
// note another device edited). Per-note `{ text, t }` (t = updatedAt ms; an
// empty text is a tombstone so a delete propagates); merged by mergeNotes, not
// by the whole-blob mergeSettings.
const NOTE_PREFIX = 'n:';

// Normalise a stored note to `{ text, t }` — accepts the current shape, the
// legacy bare string (pre-sync, no timestamp → t 0), or junk (→ null).
function normNote(v) {
  if (v == null) return null;
  if (typeof v === 'string') return { text: v, t: 0 };
  if (typeof v === 'object') return { text: typeof v.text === 'string' ? v.text : '', t: num(v.t) };
  return null;
}

// Flags ride the same payload as `f:<username>:<taxonId>` keys, scoped by
// username so switching accounts on a device never cross-contaminates. Each is
// `{ on, t }` (t = last toggle ms; on:false is a tombstone so an *un*flag
// propagates). Merged per flag by t (mergeFlags), like notes.
const FLAG_PREFIX = 'f:';

// Normalise a stored flag to `{ on, t }` — accepts the current shape, a legacy
// bare boolean (t 0), or junk (→ null).
function normFlag(v) {
  if (v == null) return null;
  if (typeof v === 'boolean') return { on: v, t: 0 };
  if (typeof v === 'object') return { on: !!v.on, t: num(v.t) };
  return null;
}

// Wrap the fields this client owns into the current payload shape. Only the
// known keys are written; the server merge preserves any newer keys already
// there. Notes are spread out as `n:<pairKey>` top-level keys (see above). Keep
// this in lock-step with SETTINGS_PAYLOAD_VERSION.
export function buildSettingsPayload(prefs, username, notes, flags) {
  const uname = username || null;
  const payload = { v: SETTINGS_PAYLOAD_VERSION, prefs: prefs || {}, username: uname };
  const m = notes && typeof notes === 'object' ? notes : {};
  for (const k of Object.keys(m)) {
    const n = normNote(m[k]);
    if (n) payload[NOTE_PREFIX + k] = { text: n.text, t: n.t };
  }
  // Flags are per-username, so they only ride when we know the account name.
  const f = flags && typeof flags === 'object' ? flags : {};
  if (uname) {
    for (const k of Object.keys(f)) {
      const n = normFlag(f[k]);
      if (n) payload[FLAG_PREFIX + uname + ':' + k] = { on: n.on, t: n.t };
    }
  }
  return payload;
}

// Pull the notes back out of a settings blob (the inverse of the spread above):
// a canonical `{ [pairKey]: { text, t } }` map from every `n:` top-level key.
export function notesFromPayload(data) {
  const d = data && typeof data === 'object' ? data : {};
  const out = {};
  for (const k of Object.keys(d)) {
    if (k.startsWith(NOTE_PREFIX)) {
      const n = normNote(d[k]);
      if (n) out[k.slice(NOTE_PREFIX.length)] = n;
    }
  }
  return out;
}

// Bring a stored payload up to the current shape before it is read. A missing
// `v` is the original unversioned blob ({ prefs, username }) and counts as v0.
// Unknown keys are always preserved, so a downgrade-then-upgrade round trip
// never drops a field. Add a step per version bump; never rewrite history.
export function upgradeSettingsPayload(data) {
  let d = data && typeof data === 'object' ? { ...data } : {};
  let v = num(d.v); // 0 when absent — the pre-versioning blob
  if (v < 1) {
    // v0 -> v1: no field changed; the version marker itself is the change.
    d.v = 1;
    v = 1;
  }
  if (v < 2) {
    // v1 -> v2: notes join as `n:<pairKey>` top-level keys. Additive — an older
    // blob simply has none, and any that are present are preserved as-is.
    d.v = 2;
    v = 2;
  }
  return d;
}

// Merge two settings blobs by timestamp. Settings are the one place where
// last-write-wins is right: losing a stale theme preference costs nothing,
// whereas losing a round costs real history.
export function mergeSettings(local, remote) {
  const l = local || {};
  const r = remote || {};
  const lt = num(l.updatedAt);
  const rt = num(r.updatedAt);
  if (!r.data) return l;
  if (!l.data) return r;
  return rt > lt ? r : l;
}

// Merge two "my tell" note maps per note by timestamp (last edit wins), so
// notes edited on different devices both survive and a delete (empty text,
// carried as a tombstone) propagates by its own timestamp. Deterministic
// regardless of argument order, so every device converges to the same result.
export function mergeNotes(local, remote) {
  const l = local && typeof local === 'object' ? local : {};
  const r = remote && typeof remote === 'object' ? remote : {};
  const out = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const a = normNote(l[k]);
    const b = normNote(r[k]);
    if (!a) { if (b) out[k] = b; continue; }
    if (!b) { out[k] = a; continue; }
    if (a.t > b.t) out[k] = a;
    else if (b.t > a.t) out[k] = b;
    else out[k] = a.text >= b.text ? a : b; // equal t: order-independent tiebreak
  }
  return out;
}

// The display shape the UI reads: `{ [pairKey]: text }` for notes with real
// text (tombstones and blanks are dropped).
export function displayNotes(map) {
  const m = map && typeof map === 'object' ? map : {};
  const out = {};
  for (const k of Object.keys(m)) {
    const n = normNote(m[k]);
    if (n && n.text) out[k] = n.text;
  }
  return out;
}

// Pull one username's flags back out of a settings blob (the inverse of the
// spread in buildSettingsPayload): a canonical `{ [taxonId]: { on, t } }` map
// from every `f:<username>:` key. A taxonId never contains a colon, so the
// remainder after the prefix is exactly the id.
export function flagsFromPayload(data, username) {
  const d = data && typeof data === 'object' ? data : {};
  const uname = username || '';
  const out = {};
  if (!uname) return out;
  const pre = FLAG_PREFIX + uname + ':';
  for (const k of Object.keys(d)) {
    if (k.startsWith(pre)) {
      const n = normFlag(d[k]);
      if (n) out[k.slice(pre.length)] = n;
    }
  }
  return out;
}

// Merge two flag maps per flag by timestamp (last toggle wins), so a flag set on
// one device and cleared on another resolve by which happened later. On an exact
// tie, "flagged" wins — order-independent, and it errs toward keeping a flag.
export function mergeFlags(local, remote) {
  const l = local && typeof local === 'object' ? local : {};
  const r = remote && typeof remote === 'object' ? remote : {};
  const out = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const a = normFlag(l[k]);
    const b = normFlag(r[k]);
    if (!a) { if (b) out[k] = b; continue; }
    if (!b) { out[k] = a; continue; }
    if (a.t > b.t) out[k] = a;
    else if (b.t > a.t) out[k] = b;
    else out[k] = a.on ? a : b; // equal t: keep the flag
  }
  return out;
}

// The display shape: the taxon ids currently flagged (on:true; tombstones drop).
export function flaggedIds(map) {
  const m = map && typeof map === 'object' ? map : {};
  return Object.keys(m).filter((k) => { const n = normFlag(m[k]); return n && n.on; });
}

// --- confusion matrix -------------------------------------------------------
//
// Which species the player systematically mixes up: `{ [correctKey]: { [chosenKey]:
// count } }`, keyed by taxon id. `addConfusion` records one wrong pick (correct
// was A, they chose B); `mergeConfusions` deep-adds two maps, so the same
// structure will fold across devices when confusions join the sync payload.
// Pure so scripts/test-sync.js can exercise them.

// Record one confusion into a map, returning a NEW map (never mutates input).
// A self-pair (A→A) or a missing key is a no-op — you can't be "confused" with
// the right answer, and there's nothing to learn from it.
export function addConfusion(map, correctKey, chosenKey, n = 1) {
  const m = map && typeof map === 'object' ? map : {};
  if (!correctKey || !chosenKey || correctKey === chosenKey) return m;
  const out = { ...m };
  const row = { ...(out[correctKey] || {}) };
  row[chosenKey] = num(row[chosenKey]) + num(n);
  out[correctKey] = row;
  return out;
}

// Deep-add two confusion maps (union of correct→chosen pairs, counts summed).
export function mergeConfusions(a, b) {
  const out = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== 'object') continue;
    for (const ck of Object.keys(src)) {
      const row = src[ck];
      if (!row || typeof row !== 'object') continue;
      const dst = out[ck] || (out[ck] = {});
      for (const chk of Object.keys(row)) dst[chk] = num(dst[chk]) + num(row[chk]);
    }
  }
  return out;
}

// Subtract `delta` from a confusion map (used to build the sync baseline: raw
// lifetime totals minus what's still queued, so a pair isn't counted twice).
// Counts clamp at 0 and pairs that reach 0 are dropped. Pure.
export function subtractConfusions(base, delta) {
  const out = {};
  const b = base && typeof base === 'object' ? base : {};
  const d = delta && typeof delta === 'object' ? delta : {};
  for (const ck of Object.keys(b)) {
    const row = b[ck] || {};
    const drow = d[ck] || {};
    const kept = {};
    for (const chk of Object.keys(row)) {
      const n = Math.max(0, num(row[chk]) - num(drow[chk]));
      if (n > 0) kept[chk] = n;
    }
    if (Object.keys(kept).length) out[ck] = kept;
  }
  return out;
}

// Trim an applied-id ledger. Unbounded growth would eventually make every
// launch slower; the ledger only has to cover ids that could still be
// redelivered, and the pull is watermarked by time as well.
export function trimLedger(ids, max = 2000) {
  const arr = Array.isArray(ids) ? ids : [];
  return arr.length <= max ? arr : arr.slice(arr.length - max);
}

// --- helpers ---------------------------------------------------------------

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function tsOf(e) {
  const t = e && (e.ts || e.created_at);
  const n = typeof t === 'number' ? t : Date.parse(t);
  return Number.isFinite(n) ? n : 0;
}

// Day arithmetic on YYYY-MM-DD via Date parts, so month ends, leap years and
// DST are handled by the platform rather than by adding 86400000ms.
function shiftDay(key, delta) {
  const [y, m, d] = String(key).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + delta);
  return localDay(dt.getTime());
}

function nextDay(key) {
  return shiftDay(key, 1);
}

function prevDay(key) {
  return shiftDay(key, -1);
}
