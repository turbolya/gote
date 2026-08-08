// Difficulty-weighted scoring. Pure, so scripts/test-scoring.js can exercise it
// in plain node.
//
// Accuracy answers "what fraction did I get right" and is deliberately left
// alone — a plain, comparable 0–100%. This file answers a different question:
// how much is an answer WORTH. Naming a species from memory and picking its
// photo out of four are not the same achievement, and a single percentage
// cannot say so without ceasing to be a percentage.
//
// So the score is cumulative points, not a rate. It rewards two things at once —
// answering more, and answering harder — which is exactly what a score should
// do and exactly what an accuracy figure must not.

import { FORMAT } from './smartmode.js';

// What one correct answer is worth, by the question that produced it. The
// spacing is the guess floor read backwards: a four-photo grid hands you 25%
// for nothing, a five-name list 20%, a two-way pair 50% but only on species you
// already confuse, and typing has no floor at all.
export const WEIGHTS = {
  [FORMAT.PICTURE]: 0.5,
  [FORMAT.NAME]: 1,
  [FORMAT.PAIR]: 1.5,
  [FORMAT.TYPED]: 2,
  // Self-graded. Worth the same as a name list because that is the nearest
  // thing it resembles — but note it is the one format the app does not mark
  // itself, so its points are only as honest as the player is. That is a real
  // exploit surface for a score in a way it never was for accuracy.
  [FORMAT.FLASH]: 1,
};

// Answers from before formats were recorded, and anything unrecognised. 1 is
// the right default because By name was the dominant mode for the whole of that
// history, so legacy answers are treated as what they almost certainly were
// rather than being silently dropped from the score.
export const DEFAULT_WEIGHT = 1;

export function weightOf(format) {
  const w = WEIGHTS[format];
  return typeof w === 'number' && Number.isFinite(w) ? w : DEFAULT_WEIGHT;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// Lifetime score from the per-format totals, plus whatever the format split does
// not account for.
//
// That remainder matters and is not an edge case: every answer given before
// 2.38.0 has no format at all, so a score built only from `statsByFormat` would
// tell a long-time player their entire history was worth nothing. It is
// reconstructed the same way the accuracy chart reconstructs its own prior —
// lifetime totals minus what the split explains — and weighted at
// DEFAULT_WEIGHT.
export function scoreFrom(lifetime, statsByFormat) {
  const by = statsByFormat && typeof statsByFormat === 'object' ? statsByFormat : {};
  let points = 0;
  let counted = 0;
  for (const [format, v] of Object.entries(by)) {
    const correct = num(v && v.correct);
    points += weightOf(format) * correct;
    counted += correct;
  }
  const legacy = Math.max(0, Math.round(num(lifetime && lifetime.correct)) - counted);
  return points + DEFAULT_WEIGHT * legacy;
}

// The most those same answers could have been worth, had every one been right.
// Only meaningful next to the score — on its own a score has no scale, and
// "820 of a possible 1,240" says something "820" does not.
export function potentialFrom(lifetime, statsByFormat) {
  const by = statsByFormat && typeof statsByFormat === 'object' ? statsByFormat : {};
  let max = 0;
  let counted = 0;
  for (const [format, v] of Object.entries(by)) {
    const answered = num(v && v.answered);
    max += weightOf(format) * answered;
    counted += answered;
  }
  const legacy = Math.max(0, Math.round(num(lifetime && lifetime.answered)) - counted);
  return max + DEFAULT_WEIGHT * legacy;
}

// --- per species --------------------------------------------------------------
//
// A species tally carries its own running totals rather than a per-format
// breakdown: `points` (weight of the correct answers) and `weight` (weight of
// all of them). Two numbers instead of one pair per format, and both fold by
// SUMMING, which is the only property the sync layer actually requires.

// One answer's contribution, for folding into a tally.
export function scoreDelta(format, correct) {
  const w = weightOf(format);
  return { points: correct ? w : 0, weight: w };
}

// How well a species is known, weighted — 0–1, where 1 means every answer was
// right AND is unaffected by which formats those answers used. Null when the
// species has no weighted history at all, so a caller can tell "nothing to say"
// from "answered everything wrong".
export function weightedRate(entry) {
  const weight = num(entry && entry.weight);
  if (weight <= 0) return null;
  return Math.min(1, Math.max(0, num(entry && entry.points) / weight));
}
