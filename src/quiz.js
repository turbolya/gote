// Pure quiz helpers (no React Native), unit-tested in scripts/test-quiz.js.

// How many leading ancestor ids two taxa share. More shared = closer relatives
// (they diverge lower in the tree). `ancestry` is an ordered kingdom→species
// array of taxon ids.
export function sharedAncestorDepth(a = [], b = []) {
  let n = 0;
  const len = Math.min(a.length, b.length);
  while (n < len && a[n] === b[n]) n += 1;
  return n;
}

/**
 * Choose `count` multiple-choice distractor cards for `answerCard`, preferring
 * taxonomically similar species: same genus first, then family, order, … and
 * only widening to unrelated taxa if nothing closer exists.
 *
 * @param {object} answerCard  the correct card { taxonId, ancestry, ... }
 * @param {Array}  pool        all candidate cards (the full deck)
 * @param {number} count       how many distractors to return
 * @param {() => number} rng   optional RNG (defaults to Math.random) for tests
 * @returns {Array} up to `count` distractor cards (never includes the answer's
 *   taxon)
 */
export function pickSimilarDistractors(answerCard, pool, count, rng = Math.random) {
  if (!answerCard || count <= 0) return [];

  // Candidates: one per taxon, excluding the answer's own taxon.
  const seen = new Set([answerCard.taxonId]);
  const candidates = [];
  for (const c of pool) {
    if (seen.has(c.taxonId)) continue;
    seen.add(c.taxonId);
    candidates.push(c);
  }

  // Rank each candidate by how closely it's related to the answer, then take
  // the closest `count`. Ties (same closeness) are shuffled so repeated rounds
  // vary. We sort by depth desc, with a random tiebreak.
  const answerAncestry = answerCard.ancestry || [];
  const ranked = candidates
    .map((c) => ({
      card: c,
      depth: sharedAncestorDepth(answerAncestry, c.ancestry || []),
      r: rng(),
    }))
    .sort((x, y) => (y.depth - x.depth) || (x.r - y.r));

  return ranked.slice(0, count).map((x) => x.card);
}

/**
 * Build the options for a "Pick the right one" round: one correct option (a
 * CURATED photo of the target taxon — never the user's own shot, which would be
 * too recognizable) plus distractor photos from similar species. Returns up to
 * `total` options, shuffled, or null if there aren't enough photos for a fair
 * round.
 *
 * Every tile — correct AND distractors — uses an official CURATED species-page
 * photo (the same kind you'd see looking the species up on iNaturalist), never
 * the user's own observation photo.
 *
 * @param {object} args
 *   - card:          target card { taxonId, common, scientific }
 *   - correctPhotos: curated photo URLs for the target taxon (fetchTaxonPhotos)
 *   - similar:       [{ taxonId, name, common, photos:[url,…] }] — each similar
 *                    species with its OWN curated photos (fetchTaxonPhotosByIds)
 *   - total:         number of tiles (default 4)
 *   - rng:           optional RNG for deterministic tests
 *
 * Every option carries a display `name` (revealed after answering) and its
 * `taxonId` (so the screen can fetch that species' other photos on demand).
 *
 * @returns {{ name, options: [{ taxonId, photo, name, correct }] } | null}
 */
export function buildPickRound({ card, correctPhotos = [], similar = [], total = 4, rng = Math.random } = {}) {
  if (!card || correctPhotos.length === 0) return null;

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const targetName = card.common || card.scientific;

  // Correct tile: a random curated photo of the target.
  const correctPhoto = shuffle(correctPhotos)[0];

  // Distractors: similar species (excluding the target taxon), each shown with
  // one of its OWN curated photos. De-dupe by photo URL so no two tiles match.
  const usedPhotos = new Set([correctPhoto]);
  const distractors = [];
  for (const s of shuffle(similar)) {
    if (s.taxonId === card.taxonId) continue;
    const photo = (s.photos || []).find((p) => p && !usedPhotos.has(p));
    if (!photo) continue;
    usedPhotos.add(photo);
    distractors.push({
      taxonId: s.taxonId,
      photo,
      name: s.common || s.name,
      correct: false,
    });
    if (distractors.length >= total - 1) break;
  }

  // Need a full set of distinct tiles for a fair round.
  if (distractors.length < total - 1) return null;

  const options = shuffle([
    { taxonId: card.taxonId, photo: correctPhoto, name: targetName, correct: true },
    ...distractors,
  ]);

  return { name: targetName, options };
}
