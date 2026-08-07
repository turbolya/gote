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

// The key a species is tallied under — taxon id when there is one, scientific
// name otherwise (Nearby cards and older cached decks can lack an id).
//
// It lives here, exported, because the rule has to be IDENTICAL everywhere or
// features that look a species up silently do nothing: App.js writes the tally
// under this key, the study screen asks whether that species is mastered under
// it, and a mismatch means the answer is always "no" with nothing to see. It was
// two independent copies of the same expression, which is the shape of a bug
// that appears the day one of them is edited.
export function speciesKey(card) {
  if (!card) return null;
  if (card.taxonId != null) return String(card.taxonId);
  return card.scientific || null;
}

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
