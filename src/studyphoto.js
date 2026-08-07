// Which photo the study screen shows. Pure, so scripts/test-studyphoto.js can
// exercise it in plain node.
//
// The "fresh photos" option swaps a mastered species' card for a random OFFICIAL
// iNaturalist photo, so recognition is tested on the species rather than on one
// memorised picture. That reads like a one-line substitution and is really a
// small state machine with a requirement that is easy to break and nearly
// impossible to spot by eye:
//
//   WHILE THE OFFICIAL PHOTO IS BEING FETCHED, THE PLAYER'S OWN PHOTO MUST NOT
//   BE ON SCREEN.
//
// Show it for even a frame and the card gets answered from memory — which is
// precisely what the option exists to prevent. The bug would look like a brief
// flicker, on a screen full of legitimate loading states, only for species the
// player has already mastered, and only with an option enabled that is off by
// default. It would survive a long time.
//
// So the rule lives here as three functions with tests, rather than as a
// conditional expression inside a component nobody can call from a test.

// Explicit `.js`, unlike the extensionless imports elsewhere in src/: this file
// is loaded directly by scripts/test-studyphoto.js under plain node ESM, which
// does not do Metro's extension guessing. Metro resolves it either way.
import { speciesKey } from './mastery.js';

// Should this card be shown an official photo instead of the player's own?
//
// Three things must hold, and the caller supplies the mastery lookup rather than
// the answer, so the key used to ask is the same one the tallies are stored
// under (see speciesKey — the two used to be independent copies of one rule).
export function wantsFreshPhoto({ freshPhotos = false, card = null, isMastered = null } = {}) {
  if (!freshPhotos || !card || typeof isMastered !== 'function') return false;
  return !!isMastered(speciesKey(card));
}

// Choose one official photo at random. Returns null when there are none, which
// the caller treats as "fall back to the player's own photo" — the offline case.
//
// `random` is injectable so a test can pin the choice; the index is clamped
// because a source returning exactly 1.0 would otherwise index past the end.
export function pickFreshPhoto(photos, random = Math.random) {
  if (!Array.isArray(photos) || !photos.length) return null;
  const raw = Math.floor(random() * photos.length);
  const i = Math.min(photos.length - 1, Math.max(0, Number.isFinite(raw) ? raw : 0));
  return photos[i] || null;
}

// The photo to render, and whether we are still waiting for one.
//
//   { uri, loading }
//
// The middle branch is the leak guard described at the top of this file: a fresh
// photo is wanted but has not resolved, so there is nothing safe to show yet.
// `uri: null` with `loading: true` is what keeps the own photo off screen.
//
// Once resolved, `freshUri` null means the fetch found nothing (offline, or a
// species with no curated photos) and the own photo is the honest fallback —
// better a memorised picture than a blank card.
export function studyPhoto({
  wantsFresh = false,
  freshResolved = false,
  freshUri = null,
  ownImage = null,
} = {}) {
  if (!wantsFresh) return { uri: ownImage || null, loading: false };
  if (!freshResolved) return { uri: null, loading: true };
  return { uri: freshUri || ownImage || null, loading: false };
}
