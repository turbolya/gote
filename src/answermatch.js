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
// What it does NOT forgive: naming a different species. That needs more than a
// cap on total edits, because look-alikes are exactly the species whose names
// are a couple of letters apart — "Western Meadowlark" is two edits from
// "Eastern Meadowlark", well inside the three a name that long is allowed, and
// was once accepted for it. So the slack is rationed PER WORD (a two-letter
// change inside one short word is a different word, not a slip), and when the
// caller knows the other species in play, an answer that fits one of them at
// least as well as the target is a miss however close it came.

// Either name is accepted. People routinely know one and not the other, and the
// point is testing recall of the species, not of a particular naming system.
export const ACCEPTS = ['common', 'scientific'];

// Fold a name to its comparable form: lowercase, unaccented, punctuation-free,
// single-spaced. NFKD splits an accented character into base + combining mark
// (and folds full-width forms to plain ones), so stripping the marks leaves the
// bare letters for every Latin-script language the app offers.
//
// Letters are kept in EVERY script. This used to keep only a-z and 0-9, which
// turned a Russian or Japanese common name into an empty string — so a player
// typing it exactly right was marked wrong, every time.
//
// Separators are listed rather than matched with \p{…}, so nothing here depends
// on the JS engine's Unicode property support: ASCII and Latin-1 punctuation,
// general punctuation, CJK punctuation, the katakana middle dot and full-width
// punctuation. The katakana long-vowel mark (U+30FC) is a letter, not a
// separator, and survives.
const SEPARATORS =
  /[\s\u0000-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u00BF\u00D7\u00F7\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F\u30FB\uFE10-\uFE1F\uFE30-\uFE4F\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]+/g;

// Letters NFKD leaves whole because they are not a base letter plus a mark.
const FOLDS = { ß: 'ss', æ: 'ae', ø: 'o', œ: 'oe', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

export function normalizeName(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritical marks
    .toLowerCase()
    .replace(/[ßæøœłđðþı]/g, (c) => FOLDS[c])
    // A common name can carry a qualifier the player has no reason to type:
    // "Mallard (domestic)" or "Newt, Smooth". Drop bracketed asides entirely,
    // then treat every remaining separator as a space.
    .replace(/\([^)]*\)/g, ' ')
    .replace(SEPARATORS, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Scripts that write a word per character or syllable: Han, kana, Hangul, Thai.
// One character there is a whole morpheme, so a one-character "slip" is usually
// a different name — ハシブトガラス and ハシボソガラス are two crows. Typing
// them goes through an IME that offers the right characters anyway, so they are
// matched exactly. (NFKD takes Hangul syllables apart into conjoining jamo,
// hence the jamo blocks alongside the syllable block.)
const DENSE_SCRIPT = /[\u0E00-\u0E7F\u1100-\u11FF\u3040-\u30FF\u3130-\u318F\u3400-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/;

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

// Edit distance that counts swapping two neighbouring letters as ONE edit
// (optimal string alignment), with a per-character tally of where the edits
// landed in `b`. A swapped pair is the commonest slip on a phone keyboard, and
// plain Levenshtein charges it two — which, once the slack is rationed per word,
// would fail "fakopnacs" for "fakopancs".
//
// Returns { distance, perChar } where perChar[j] is how many edits were
// attributed to b[j]. An insertion is charged to the character it sits before
// (or the last one, at the very end), so every edit belongs to some word.
export function alignEdits(a, b) {
  const n = a.length;
  const m = b.length;
  const d = [];
  for (let i = 0; i <= n; i++) {
    d.push(new Array(m + 1).fill(0));
    d[i][0] = i;
  }
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
    }
  }
  // Walk one optimal path back, preferring a match/substitution, so the edits
  // land on the characters they changed.
  const perChar = new Array(m).fill(0);
  const charge = (j) => {
    if (m) perChar[Math.min(Math.max(j, 0), m - 1)] += 1;
  };
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      if (d[i][j] === d[i - 1][j - 1] + cost) {
        if (cost) charge(j - 1);
        i -= 1;
        j -= 1;
        continue;
      }
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && d[i][j] === d[i - 2][j - 2] + 1) {
        charge(j - 1);
        i -= 2;
        j -= 2;
        continue;
      }
    }
    if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      charge(j - 1); // a letter of `b` the typist left out
      j -= 1;
    } else {
      charge(j); // an extra letter typed before b[j]
      i -= 1;
    }
  }
  return { distance: d[n][m], perChar };
}

// Compare one typed answer against one expected name.
// Returns null for no match, else { exact, distance }.
//
// Spaces are ignored in the comparison — "screechowl" and "screech owl" are the
// same answer — but the expected name's words still ration the slack: each word
// may absorb only maxEdits(its length) of the edits, and the whole name no more
// than maxEdits(the whole name). That is what separates a slip from a different
// word: "eastren" is one swap inside a 7-letter word, "western" is two changes.
function compareTo(typed, expected) {
  const want = normalizeName(expected);
  if (!want) return null;
  if (typed === want) return { exact: true, distance: 0 };
  const a = typed.replace(/ /g, '');
  const words = want.split(' ');
  const b = words.join('');
  if (a === b) return { exact: true, distance: 0 };
  if (DENSE_SCRIPT.test(b)) return null;
  const allowed = maxEdits(want.length);
  if (allowed === 0) return null;
  if (Math.abs(a.length - b.length) > allowed) return null;
  const { distance, perChar } = alignEdits(a, b);
  if (distance > allowed) return null;
  let at = 0;
  for (const w of words) {
    let spent = 0;
    for (let k = 0; k < w.length; k++) spent += perChar[at + k];
    if (spent > maxEdits(w.length)) return null;
    at += w.length;
  }
  return { exact: false, distance };
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
//
// `others` is optional: the OTHER species the player could plausibly mean —
// the round's pool, typically — as cards or { common, scientific }. A forgiven
// answer that is at least as close to one of them as to the target is a miss:
// it names that species, not this one. An exact match on the target always
// stands, even if another species happens to share the name.
export function matchAnswer(typed, card, others = null) {
  const input = normalizeName(typed);
  const common = card && card.common;
  const scientific = card && card.scientific;
  const miss = { ok: false, exact: false, matched: null, distance: null, expected: common || scientific || '' };
  if (!input) return miss;

  for (const [field, value] of [['common', common], ['scientific', scientific]]) {
    const hit = compareTo(input, value);
    if (!hit) continue;
    if (!hit.exact && closerToAnother(input, hit.distance, card, others)) return miss;
    return { ok: true, exact: hit.exact, matched: field, distance: hit.distance, expected: value };
  }
  return miss;
}

// Does `input` fit some other species' name at least as well as `distance`?
function closerToAnother(input, distance, card, others) {
  if (!Array.isArray(others) || !others.length) return false;
  const a = input.replace(/ /g, '');
  const own = card && card.taxonId != null ? String(card.taxonId) : null;
  const mine = new Set([normalizeName(card && card.common), normalizeName(card && card.scientific)]);
  for (const o of others) {
    if (!o) continue;
    if (own != null && o.taxonId != null && String(o.taxonId) === own) continue;
    for (const name of [o.common, o.scientific]) {
      const n = normalizeName(name);
      if (!n || mine.has(n)) continue;
      const b = n.replace(/ /g, '');
      if (Math.abs(a.length - b.length) > distance) continue;
      if (alignEdits(a, b).distance <= distance) return true;
    }
  }
  return false;
}
