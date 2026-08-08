// Which QUESTION to ask about a species — the logic behind Smart play. Pure, so
// scripts/test-smartmode.js can exercise it in plain node.
//
// Every other mode asks the same question all round. Smart play asks the one
// that best fits what is known about that species right now, because the four
// formats are not interchangeable — they are a ladder of retrieval difficulty:
//
//   PICTURE  name → pick from 4 photos    easiest: recognition, 25% guess floor
//   NAME     photo → pick from 5 names    recognition, 20% guess floor
//   PAIR     photo → one of 2 look-alikes discrimination on a KNOWN confusion
//   TYPED    photo → write the name       recall, no guessing at all
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
};

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
// The shape, in words: a species you have never met is introduced with its name
// visible; as it becomes familiar the name disappears and you choose it from a
// list; once you reliably know it you are asked to produce it. A live confusion
// outranks all of that, because a pair you actively mix up is the most valuable
// question available and stays valuable at every strength.
export function formatWeights({ evidence = 0, rate = 0, hasPartner = false } = {}) {
  const n = num(evidence);
  const r = Math.min(1, Math.max(0, num(rate)));

  // First meeting: show the name and let the photo be found. Nothing else is
  // fair, and nothing else teaches the association.
  if (n <= 0) {
    return { [FORMAT.PICTURE]: 1, [FORMAT.NAME]: 0, [FORMAT.PAIR]: 0, [FORMAT.TYPED]: 0 };
  }

  const weak = n < MIN_EVIDENCE || r < WEAK_RATE;
  const strong = n >= TYPED_MIN_EVIDENCE && r >= TYPED_MIN_RATE;

  return {
    // Fades out as the species is learned — it is the easiest question and
    // stops being informative once the answer is reliably known.
    [FORMAT.PICTURE]: weak ? 5 : strong ? 0 : 2,
    // The workhorse, and the peak sits in the middle where most cards live.
    [FORMAT.NAME]: weak ? 3 : strong ? 2 : 5,
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
// `rng` is injectable so tests are deterministic.
export function chooseFormat(
  { evidence = 0, rate = 0, hasPartner = false, allow = ALL_FORMATS } = {},
  rng = Math.random
) {
  const permitted = new Set(allow && allow.length ? allow : ALL_FORMATS);
  const weights = formatWeights({ evidence, rate, hasPartner });

  const pool = ALL_FORMATS.filter((f) => permitted.has(f) && weights[f] > 0);
  // Nothing qualified — offline with an unseen species, say. NAME is the safe
  // fallback: it needs only the deck itself, and it is the format every other
  // mode already uses.
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
