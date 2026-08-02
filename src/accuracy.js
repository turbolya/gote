// Accuracy weighting. Pure (no React, no react-native), so scripts/test-accuracy.js
// can exercise it directly in plain node.
//
// Two distinct problems live here:
//
//  1. COUNT WEIGHTING. The accuracy chart stores one percentage per finished
//     round, so averaging those percentages treats a 1-card round exactly like a
//     100-card one. Five 20-card rounds at 70% plus one lucky 1-card round reads
//     as 75% — while the lifetime figure printed under the chart (correct /
//     answered, which was always weighted) says 70.3%. A line labelled "lifetime
//     accuracy" that doesn't land on the lifetime accuracy is just wrong. Every
//     aggregate below is a RATIO OF SUMS, never a mean of ratios, so it does.
//
//  2. SMALL SAMPLES. A species answered once, correctly, is not a species known
//     at 100% — but raw known/(known+missed) says exactly that, and lets it
//     outrank a species answered right forty times out of forty-two. `shrunkRate`
//     pulls a thin sample toward the player's own lifetime rate until it has
//     earned its position.
//
// Weighting is applied wherever an aggregate claims to summarise many rounds.
// Shrinkage is applied only to RANKING and per-species display — never to the
// headline number or to a single round's own bar, because a stat that has been
// quietly adjusted is harder to trust than one that is plain arithmetic.

// Nominal round length, used only as a last resort: a round played before
// v2.37.0 recorded its percentage but not how many cards it had. Reachable only
// when NO round on the device has a known size (otherwise the player's own mean
// round length is the better guess — see roundWeights).
export const DEFAULT_ROUND_CARDS = 12;

// How much evidence a per-species rate needs before it is believed, measured in
// cards. Read it as "m cards of the player's average performance are mixed in":
// at m = 8 a single correct answer lands near the lifetime rate, 20-for-20 reads
// ~91%, and 100-for-100 reads ~98%. Perfect stays perfect once it is earned.
export const SHRINK_M = 8;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const clampPct = (v) => Math.min(100, Math.max(0, v));
// Non-negative integer, or 0 for anything unusable (null, NaN, junk from an
// older payload). 0 means "size unknown" throughout this file.
const size = (v) => {
  const n = num(v);
  return n > 0 ? Math.round(n) : 0;
};

// --- count weighting ---------------------------------------------------------

// Line up a `counts` array with its `history` array, returning exactly
// history.length entries where 0 means "size unknown".
//
// Alignment is from the RIGHT, and both halves of that matter: `counts` starts
// out empty for a player who predates it, so the rounds with a known size are
// always the newest ones; and history is trimmed from the front (MAX_HISTORY),
// which drops the oldest from both arrays together. Right-alignment is therefore
// correct both while counts is catching up and forever after.
export function alignCounts(history = [], counts = []) {
  const h = Array.isArray(history) ? history.length : 0;
  const src = Array.isArray(counts) ? counts : [];
  const out = new Array(h).fill(0);
  const n = Math.min(h, src.length);
  for (let i = 0; i < n; i++) out[h - n + i] = size(src[src.length - n + i]);
  return out;
}

// Weights for a weighted average: aligned counts, with unknown sizes filled in.
// The fill is the player's OWN mean round length when any round has a known
// size, which self-calibrates to how they actually play; DEFAULT_ROUND_CARDS
// only when nothing at all is known.
export function roundWeights(history = [], counts = []) {
  const aligned = alignCounts(history, counts);
  let sum = 0;
  let known = 0;
  for (const n of aligned) {
    if (n > 0) {
      sum += n;
      known++;
    }
  }
  const fill = known > 0 ? Math.max(1, Math.round(sum / known)) : DEFAULT_ROUND_CARDS;
  return aligned.map((n) => (n > 0 ? n : fill));
}

// The card totals the chart itself implies: how many cards its rounds covered,
// and how many of those were right.
//
// `correct` is deliberately NOT rounded. Percentages are stored as integers, so
// it is only a close reconstruction of the true tally — but leaving the residue
// in place is what makes priorFor exact: the same fractional error is subtracted
// from the lifetime total and then added back by the curve, cancelling out. Round
// it here and the trend line misses its target by a fraction of a point.
export function historyTotals(history = [], counts = []) {
  const data = Array.isArray(history) ? history : [];
  const w = roundWeights(data, counts);
  let answered = 0;
  let correct = 0;
  for (let i = 0; i < data.length; i++) {
    answered += w[i];
    correct += (clampPct(num(data[i])) / 100) * w[i];
  }
  return { answered, correct };
}

// The head start the chart needs so its final value equals the lifetime figure
// printed beside it. Two things live outside the chart's own rounds:
//
//   • rounds trimmed off the front once history outgrew MAX_HISTORY, and
//   • single answers that never became a round at all (a card answered on the
//     watch counts toward lifetime accuracy but draws no bar).
//
// Both are real answers, and the only place they can go is the start of the
// curve. Returns null when the numbers don't support a seed — right after a
// stats reset, or if rounding made the reconstruction exceed the true total —
// in which case the curve simply starts at its first round.
export function priorFor(lifetime, history = [], counts = []) {
  const t = historyTotals(history, counts);
  const answered = Math.round(num(lifetime && lifetime.answered)) - t.answered;
  // Carries historyTotals' fractional residue, so cumulativeAccuracy's last
  // value works out to exactly lifetime.correct / lifetime.answered.
  const correct = Math.round(num(lifetime && lifetime.correct)) - t.correct;
  if (!(answered > 0)) return null;
  if (correct < 0 || correct > answered) return null;
  return { answered, correct };
}

// Running accuracy across every round up to each point, weighted by how many
// cards each round had — i.e. sum(correct) / sum(answered) as of round i, in
// percent. This is the lifetime-accuracy trend line, and with a `prior` seed its
// last value IS the lifetime accuracy.
export function cumulativeAccuracy(history = [], counts = [], prior = null) {
  const data = Array.isArray(history) ? history : [];
  const w = roundWeights(data, counts);
  let sumW = prior ? num(prior.answered) : 0;
  let sumWX = prior ? num(prior.correct) * 100 : 0;
  const out = [];
  for (let i = 0; i < data.length; i++) {
    const pct = clampPct(num(data[i]));
    sumW += w[i];
    sumWX += pct * w[i];
    out.push(sumW > 0 ? sumWX / sumW : pct);
  }
  return out;
}

// Partition n items into m contiguous, near-equal buckets; returns m [start,end)
// index pairs (end exclusive). Assumes n >= m >= 1.
function buckets(n, m) {
  const out = [];
  for (let i = 0; i < m; i++) {
    out.push([Math.floor((i * n) / m), Math.floor(((i + 1) * n) / m)]);
  }
  return out;
}

// Downsample per-round percentages to at most m bars, so the whole history stays
// on screen once it outgrows the available bars. Each bar is its bucket's
// weighted accuracy — a bucket holding one 1-card round and one 100-card round
// reads as the 100-card round almost exactly, which is what happened.
// Returned unchanged when it already fits.
export function downsampleAccuracy(history = [], counts = [], m) {
  const data = Array.isArray(history) ? history : [];
  if (m <= 0) return [];
  if (data.length <= m) return data.slice();
  const w = roundWeights(data, counts);
  return buckets(data.length, m).map(([s, e]) => {
    let sumW = 0;
    let sumWX = 0;
    for (let i = s; i < e; i++) {
      sumW += w[i];
      sumWX += clampPct(num(data[i])) * w[i];
    }
    return sumW > 0 ? sumWX / sumW : 0;
  });
}

// Sample a series to at most m points by taking each bucket's LAST value, so the
// final (most recent) value is always preserved. Used for the cumulative
// accuracy line, whose endpoint is the true lifetime accuracy and must survive
// being squeezed onto fewer pixels.
export function sampleBucketEnds(data, m) {
  if (m <= 0) return [];
  if (data.length <= m) return data.slice();
  return buckets(data.length, m).map(([, e]) => data[e - 1]);
}

// --- small-sample shrinkage --------------------------------------------------

// The player's overall hit rate as a 0–1 fraction — the prior a thin per-species
// sample is pulled toward. Falls back to 0.5 (no information) before any card
// has been answered.
export function lifetimeRate(lifetime) {
  const answered = num(lifetime && lifetime.answered);
  if (!(answered > 0)) return 0.5;
  return clamp01(num(lifetime && lifetime.correct) / answered);
}

// A per-species success rate (0–1) that small samples can't game:
//
//     (known + m × priorRate) / (known + missed + m)
//
// One correct answer no longer beats forty-two, and one miss no longer means 0%.
// The adjustment fades as evidence accumulates, so a species with real history
// reports essentially its raw rate. Never-seen species stay at 0 (same as the
// raw rate) so they sort to the bottom rather than to the prior.
export function shrunkRate(entry, priorRate = 0.5, m = SHRINK_M) {
  const known = Math.max(0, num(entry && entry.known));
  const missed = Math.max(0, num(entry && entry.missed));
  const total = known + missed;
  if (total <= 0) return 0;
  return (known + m * clamp01(priorRate)) / (total + m);
}
