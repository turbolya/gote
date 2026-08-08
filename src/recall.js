// Retrieval-strength signals attached to the per-species tally. Pure, so
// scripts/test-recall.js can exercise it in plain node.
//
// Nothing reads these yet. They are recorded now because they are the one kind
// of data that cannot be backfilled: a scheduler written six months from now
// needs six months of history, and history not written down is gone. The cost
// is two integers and a timestamp per species.
//
//   lastSeen   when this species was last answered (ms epoch)
//   msTotal    summed answer latency across TIMED answers
//   msCount    how many answers were timed
//
// The shapes are chosen so they MERGE. Every rollup in this app folds by
// summing counters, because two devices playing offline have to reconcile
// without either overwriting the other (see src/sync/merge.js). So latency is
// stored as a sum and a count rather than as a mean — a mean cannot be merged,
// and storing one would quietly corrupt every multi-device account. `lastSeen`
// merges by max, which is order-independent for the same reason a day-set union
// is.
//
// `msCount` counts TIMED answers, not all answers: a wrist round carries no
// timing, and neither does "Pick the right one". Counting those as zero-latency
// would drag every mean toward nonsense, so they are simply not counted.

// Longer than this and the number is not a measurement of recall — it is a
// phone that went in a pocket, an interrupted session, a conversation. Kept
// generous because a genuinely hard card can take a while, but finite, because
// one 40-minute "answer" would swamp a species' whole average.
export const LATENCY_MAX_MS = 60000;

// A usable latency in whole milliseconds, or 0 for "not timed". 0 is the
// explicit absence value throughout — it is never a real measurement, since an
// answer cannot take zero time.
export function sanitizeLatency(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const rounded = Math.round(n);
  return rounded > LATENCY_MAX_MS ? 0 : rounded;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// Fold one answer into a per-species tally, returning the counter fields only
// (the caller owns name/sci/image, which are display data rather than counters).
//
// Used for BOTH the stored tally and the round's sync delta, which used to be
// two copies of the same arithmetic sitting one after the other.
export function recordRecall(prev, { correct = false, ms = 0, at = Date.now() } = {}) {
  const p = prev || {};
  const timed = sanitizeLatency(ms);
  return {
    known: num(p.known) + (correct ? 1 : 0),
    missed: num(p.missed) + (correct ? 0 : 1),
    // Max, not "latest write": events arrive out of order from other devices,
    // and the most recently APPLIED is not the most recent one played.
    lastSeen: Math.max(num(p.lastSeen), num(at) || 0),
    msTotal: num(p.msTotal) + timed,
    msCount: num(p.msCount) + (timed ? 1 : 0),
  };
}

// Average answer latency for a species, or null when nothing was timed. The
// null matters: a future scheduler must be able to tell "answers quickly" from
// "we have no idea", and 0 would read as the former.
export function meanLatencyMs(entry) {
  const count = num(entry && entry.msCount);
  if (count <= 0) return null;
  return num(entry && entry.msTotal) / count;
}
