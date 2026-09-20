// Which QUESTION to ask about a species — the logic behind Smart play. Pure, so
// scripts/test-smartmode.js can exercise it in plain node.
//
// Every other mode asks the same question all round. Smart play asks the one
// that best fits what is known about that species right now, because the four
// formats are not interchangeable — they are a ladder of difficulty, easiest
// first:
//
//   NAME     photo → pick from 5 names    easiest: the photo is in front of you
//   PAIR     photo → one of 2 look-alikes discrimination on a KNOWN confusion
//   PICTURE  name → pick from 4 photos    hard: tell it from three others by
//                                         the picture alone, in photos you
//                                         have not seen before
//   TYPED    photo → write the name       recall, no guessing at all
//
// The same order as the scoring weights (src/scoring.js). PICTURE used to sit
// at the bottom as the easy one, on the strength of its one-in-four guess
// floor; in play it proved as hard as typing, and a new or struggling species
// fed mostly photo grids was being handed the hardest question going.
//
// Picking at random would waste that. A species seen once should not be asked
// for from memory, and one answered right forty times learns nothing from a
// fourth multiple-choice question. So the format is drawn from WEIGHTS that
// shift with what the tallies say — which keeps each item near the edge of its
// own difficulty while staying unpredictable enough not to feel like a drill.
//
// It reads the same signals the rest of the app already keeps: the per-species
// tally, the shrunk success rate (src/accuracy.js — a raw rate would let one
// lucky answer promote a species straight to typed recall), and the confusion
// matrix.

export const FORMAT = {
  PICTURE: 'picture',
  NAME: 'name',
  PAIR: 'pair',
  TYPED: 'typed',
  // Self-graded reveal (the Flash cards mode). Part of the recording vocabulary
  // but NOT of Smart play's palette: its "correct" is the player's own opinion,
  // so it is not comparable with the formats the app marks itself. Kept out of
  // ALL_FORMATS so chooseFormat can never draw it.
  FLASH: 'flash',
};

// The formats Smart play may choose between.
export const ALL_FORMATS = [FORMAT.PICTURE, FORMAT.NAME, FORMAT.PAIR, FORMAT.TYPED];

// Answers needed before a species is judged on its own record rather than
// treated as new. Below this the tally is too thin to mean much — which is the
// same reason shrunkRate exists.
export const MIN_EVIDENCE = 3;
// …and before it can be asked for from memory. Typed recall on a species seen
// twice is not a test, it is a wall.
export const TYPED_MIN_EVIDENCE = 5;
export const TYPED_MIN_RATE = 0.8;
// Below this a species is still being learned, whatever its sample size.
export const WEAK_RATE = 0.5;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// Relative likelihood of each format for one species. Zero means "never here":
// a format with zero weight is not merely unlikely, it is excluded.
//
//   evidence   known + missed for this species
//   rate       0–1 success rate, shrunk (pass accuracy.shrunkRate)
//   hasPartner a look-alike this player actually confuses it with, in this deck
//
// The shape, in words: a species you have never met, or keep getting wrong, is
// asked mostly by name — its photo in front of you, five names to choose from.
// As it becomes familiar the harder questions arrive: picking its photo out of
// four, and once you reliably know it, producing the name from memory. A live
// confusion outranks all of that, because a pair you actively mix up is the
// most valuable question available and stays valuable at every strength.
export function formatWeights({ evidence = 0, rate = 0, hasPartner = false } = {}) {
  const n = num(evidence);
  const r = Math.min(1, Math.max(0, num(rate)));

  // First meeting: mostly a name list, the easiest question there is. A photo
  // grid is still possible, just rare — a round on a deck with no history
  // should not be ALL one format, and the grid is the one that shows the name
  // and asks what it looks like. Rare also because it is the one format that
  // needs four other species' photos fetched live, so it is the slowest and
  // heaviest on the API.
  if (n <= 0) {
    return { [FORMAT.NAME]: 5, [FORMAT.PICTURE]: 1, [FORMAT.PAIR]: 0, [FORMAT.TYPED]: 0 };
  }

  const weak = n < MIN_EVIDENCE || r < WEAK_RATE;
  const strong = n >= TYPED_MIN_EVIDENCE && r >= TYPED_MIN_RATE;

  return {
    // The easy question. Dominant while a species is new or being missed, the
    // workhorse in the middle, and a rare change of pace once it is known —
    // never zero, so a known species does not face nothing but hard questions.
    [FORMAT.NAME]: weak ? 5 : strong ? 1 : 4,
    // Hard, so it grows with the species rather than being where it starts:
    // a trickle while weak, a real share in the middle, and the second most
    // likely question once the species is known.
    [FORMAT.PICTURE]: weak ? 1 : strong ? 4 : 3,
    // Only once there is something to recall. A trickle before "strong" so the
    // format is not a sudden cliff the first time a species qualifies.
    [FORMAT.TYPED]: strong ? 5 : n >= MIN_EVIDENCE && r >= 0.65 ? 1 : 0,
    // Highest single weight when it applies, but never the only option — being
    // asked the same pair every time it appears would be a drill, not a round.
    [FORMAT.PAIR]: hasPartner ? 4 : 0,
  };
}

// Draw one format from the weights.
//
// `allow` narrows the candidates for reasons that have nothing to do with
// learning: PICTURE needs four other species' photos fetched live, so it cannot
// run offline, and PAIR needs the partner card to actually be in this deck.
// Excluded formats are removed before the draw rather than after, so their
// weight is redistributed instead of silently biasing toward whatever is left.
//
// An EMPTY list means nothing is allowed, and falls through to the NAME
// fallback below. Only an omitted one means "no restriction". The difference
// is the round a player gets by choosing Look-alike pairs alone with no
// confusions recorded: every card's candidates are then empty, and treating
// that as "anything goes" served a normal mixed round — typed recall and photo
// grids on a round asked for as pairs.
//
// `rng` is injectable so tests are deterministic.
export function chooseFormat(
  { evidence = 0, rate = 0, hasPartner = false, allow = ALL_FORMATS } = {},
  rng = Math.random
) {
  const permitted = new Set(Array.isArray(allow) ? allow : ALL_FORMATS);
  const weights = formatWeights({ evidence, rate, hasPartner });

  const pool = ALL_FORMATS.filter((f) => permitted.has(f) && weights[f] > 0);
  // Nothing qualified — pairs-only with no confusion to ask about, or offline
  // with an unseen species. NAME is the safe fallback: it needs only the deck
  // itself, and it is the format every other mode already uses.
  if (!pool.length) return permitted.has(FORMAT.NAME) ? FORMAT.NAME : [...permitted][0] || FORMAT.NAME;

  const total = pool.reduce((sum, f) => sum + weights[f], 0);
  let roll = num(rng()) * total;
  for (const f of pool) {
    roll -= weights[f];
    if (roll < 0) return f;
  }
  // Only reachable if rng() returned exactly 1 (or something out of range).
  return pool[pool.length - 1];
}
