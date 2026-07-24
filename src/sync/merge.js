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

  // `pct` is null for a single answer: one card is not a round, and letting it
  // through would spike the menu's accuracy chart with 0%/100% points.
  const history =
    event.pct == null
      ? r.history
      : [...r.history, clamp(Math.round(num(event.pct)), 0, 100)];

  const day = event.localDay || event.local_day;
  const days = day && !r.days.includes(day) ? [...r.days, day] : r.days;

  return {
    stats: {
      answered: r.stats.answered + answered,
      correct: r.stats.correct + correct,
    },
    species,
    history,
    days,
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
