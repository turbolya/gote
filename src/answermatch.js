// Judging a TYPED species name. Pure, so scripts/test-answermatch.js can
// exercise it in plain node.
//
// This is the part of Smart play most likely to feel wrong, and the failure is
// asymmetric: a matcher that is too strict makes the best learning format feel
// like a spelling test and people stop using it, while one that is slightly too
// loose costs almost nothing — you still had to produce the name from memory.
// So it errs generous, deliberately, and every rule below leans that way.
//
// What it forgives:
//   • case, accents and diacritics — "Fakopáncs" == "fakopancs", which matters
//     a great deal when the answer is Hungarian and the keyboard is a phone
//   • hyphens, apostrophes and other punctuation ("Great-spotted" == "great
//     spotted"), and any amount of surrounding or repeated whitespace
//   • parenthetical and trailing qualifiers on a common name
//   • small typos, scaled to the length of the name (see maxEdits)
//
// What it does NOT forgive: naming a different species. Fuzziness is bounded by
// edit distance, so "Lissotriton vulgaris" never matches "Lissotriton montandoni"
// — those are 9 edits apart, far outside any tolerance here.

// Either name is accepted. People routinely know one and not the other, and the
// point is testing recall of the species, not of a particular naming system.
export const ACCEPTS = ['common', 'scientific'];

// Fold a name to its comparable form: lowercase, unaccented, punctuation-free,
// single-spaced. NFD splits an accented character into base + combining mark, so
// stripping the marks leaves plain ASCII for every Latin-script language the app
// offers.
export function normalizeName(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritical marks
    .toLowerCase()
    // A common name can carry a qualifier the player has no reason to type:
    // "Mallard (domestic)" or "Newt, Smooth". Drop bracketed asides entirely,
    // then treat every remaining separator as a space.
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// How many single-character edits to forgive, by length of the expected name.
// Short names get no slack (they are quick to type and easy to confuse with a
// genuinely different word); long ones get more, because a 20-letter binomial
// typed on a phone will pick up a slip or two from a player who plainly knows it.
export function maxEdits(len) {
  return Math.min(3, Math.floor(len / 5));
}

// Levenshtein distance, with a ceiling: once every value in a row exceeds `max`
// the answer cannot come back under it, so we stop. Species names are short, but
// this runs on every keystroke-completed answer and the early exit keeps it
// trivially cheap.
export function levenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const curr = new Array(b.length + 1);
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
}

// Compare one typed answer against one expected name.
// Returns null for no match, else { exact, distance }.
function compareTo(typed, expected) {
  const want = normalizeName(expected);
  if (!want) return null;
  if (typed === want) return { exact: true, distance: 0 };
  const allowed = maxEdits(want.length);
  if (allowed === 0) return null;
  const d = levenshtein(typed, want, allowed);
  return d <= allowed ? { exact: false, distance: d } : null;
}

// Judge a typed answer against a card.
//
//   { ok, exact, matched, distance, expected }
//
// `exact` false with `ok` true is the forgiven-typo case: the answer counts, and
// the caller should show `expected` so the player sees the spelling they missed.
// Scoring a near-miss as wrong would punish knowing the species for not knowing
// the keyboard, which is the opposite of what this format is for.
//
// The common name is tried first so that is what gets shown back when both
// would match — it is the name the player is most likely studying.
export function matchAnswer(typed, card) {
  const input = normalizeName(typed);
  const common = card && card.common;
  const scientific = card && card.scientific;
  // distance is null rather than Infinity on a miss: it is only meaningful when
  // ok is true, and Infinity does not survive JSON.
  const miss = { ok: false, exact: false, matched: null, distance: null, expected: common || scientific || '' };
  if (!input) return miss;

  for (const [field, value] of [['common', common], ['scientific', scientific]]) {
    const hit = compareTo(input, value);
    if (hit) return { ok: true, exact: hit.exact, matched: field, distance: hit.distance, expected: value };
  }
  return miss;
}
