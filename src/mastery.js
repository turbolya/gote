// "Mastered" species: ones the player reliably gets right. Pure, reading the
// per-species tally `{ known, missed }` (src/storage.js loadSpeciesStats), so
// scripts/test-mastery.js can exercise it directly.
//
// Used by the optional "fresh photos" setting: once a species is mastered, the
// study screen swaps the player's own observation photo for a random official
// (curated) iNaturalist photo — so recognition is tested on the species, not on
// one memorised picture.

// A species counts as mastered once the player has enough correct answers AND a
// high enough accuracy — both, so a single lucky streak or a well-known-but-
// rarely-seen species doesn't qualify on a thin sample.
export const MASTERY_MIN_CORRECT = 5;
export const MASTERY_MIN_ACCURACY = 0.8; // correct / (correct + incorrect)

export function isMastered(
  entry,
  { minCorrect = MASTERY_MIN_CORRECT, minAccuracy = MASTERY_MIN_ACCURACY } = {}
) {
  const known = Number(entry && entry.known) || 0;
  const missed = Number(entry && entry.missed) || 0;
  const total = known + missed;
  if (total <= 0 || known < minCorrect) return false;
  return known / total >= minAccuracy;
}
