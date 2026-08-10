// Tests for compactEvents (src/sync/merge.js).
//
// The outbox is capped, and it used to enforce that by dropping the oldest
// events. That was silent data loss of the worst kind: the rounds were already
// counted on the device, so nothing looked wrong there, while the account — and
// so every other device — never learned about them. Compaction holds the same
// bound and keeps everything additive, so these tests are really one assertion
// repeated: folding must not lose anything.
//
//   node scripts/test-compact.js   (or via: npm test)

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'sync', 'merge.js');

const script = `
import { compactEvents } from ${JSON.stringify(src)};

// Distinct ids and increasing timestamps, because bars are identified by
// (event id + position) and ordered by time. Real events always have both; a
// fixture that reuses one id makes two different rounds collide into one bar
// and quietly stops testing what it claims to.
let seq = 0;
const ev = (o) => ({
  id: o.id || \`e\${seq += 1}\`,
  device_id: 'dev',
  ts: o.ts || new Date(Date.UTC(2026, 7, 1, 0, 0, seq)).toISOString(),
  local_day: o.local_day || '2026-08-01', answered: 0, correct: 0, pct: null, n: 0,
  species: {}, formats: {}, confusions: {}, history: [], counts: [], days: [], ...o,
});

const out = {};

out.totals = compactEvents([
  ev({ answered: 5, correct: 4 }),
  ev({ answered: 3, correct: 1 }),
], 'x');

out.rounds = compactEvents([
  ev({ answered: 5, correct: 4, pct: 80, n: 5, local_day: '2026-08-01' }),
  ev({ answered: 4, correct: 2, pct: 50, n: 4, local_day: '2026-08-02' }),
], 'x');

out.species = compactEvents([
  ev({ species: { 42: { name: 'Newt', sci: 'L. vulgaris', known: 3, missed: 1, lastSeen: 100, msTotal: 900, msCount: 3, points: 3, weight: 3 } } }),
  ev({ species: { 42: { known: 2, missed: 0, lastSeen: 50, msTotal: 400, msCount: 2, points: 2, weight: 2 } } }),
], 'x');

out.formats = compactEvents([
  ev({ formats: { typed: { answered: 2, correct: 2 } } }),
  ev({ formats: { typed: { answered: 1, correct: 0 }, pair: { answered: 3, correct: 2 } } }),
], 'x');

out.confusions = compactEvents([
  ev({ confusions: { 1: { 2: 1 } } }),
  ev({ confusions: { 1: { 2: 2, 3: 1 } } }),
], 'x');

// A baseline (bars in history, counts right-aligned) followed by a round.
out.bars = compactEvents([
  ev({ history: [60, 70, 80], counts: [4, 5], pct: null }),
  ev({ pct: 90, n: 9 }),
], 'x');

out.days = compactEvents([
  ev({ local_day: '2026-08-01', days: ['2026-07-30'] }),
  ev({ local_day: '2026-08-02' }),
  ev({ local_day: '2026-08-02' }),
], 'x');

out.identity = compactEvents([
  ev({ id: 'a', ts: '2026-08-01T00:00:00Z', local_day: '2026-08-01' }),
  ev({ id: 'b', ts: '2026-08-05T00:00:00Z', local_day: '2026-08-05' }),
], 'chosen-id');

out.empty = compactEvents([], 'x');
out.nullish = compactEvents(null, 'x');
out.holes = compactEvents([null, ev({ answered: 2, correct: 1 }), undefined], 'x');
out.junk = compactEvents([ev({ answered: 'x', correct: NaN, pct: 'no', n: -3 })], 'x');

console.log(JSON.stringify(out));
`;

const r = JSON.parse(
  execFileSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8' })
);

const assert = require('assert');
let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ', name);
  } catch (e) {
    fail++;
    console.log('  FAIL', name, '\n       ', e.message);
  }
}

console.log('\ncompactEvents: folding must not lose anything\n');

test('totals sum', () => {
  assert.strictEqual(r.totals.answered, 8);
  assert.strictEqual(r.totals.correct, 5);
});

test("each round's percentage becomes a chart bar, carrying its card count", () => {
  // The whole point: a compacted run is not one round, so pct must be null and
  // the percentages have to survive as bars or the chart silently loses points.
  assert.strictEqual(r.rounds.pct, null, 'a compacted run is not a round');
  assert.strictEqual(r.rounds.n, 0);
  assert.deepStrictEqual(r.rounds.bars.map((b) => b.pct), [80, 50]);
  assert.deepStrictEqual(r.rounds.bars.map((b) => b.n), [5, 4]);
  assert.ok(r.rounds.bars.every((b) => b.id), 'every bar keeps an identity');
  // The legacy arrays are deliberately empty: a client that predates bars
  // cannot dedupe a whole run handed to it at once.
  assert.deepStrictEqual(r.rounds.history, []);
});

test('species tallies deep-add, and lastSeen folds by max not by sum', () => {
  const s = r.species.species['42'];
  assert.strictEqual(s.known, 5);
  assert.strictEqual(s.missed, 1);
  assert.strictEqual(s.lastSeen, 100, 'a timestamp must not be summed');
  assert.strictEqual(s.msTotal, 1300);
  assert.strictEqual(s.msCount, 5);
  assert.strictEqual(s.points, 5);
  assert.strictEqual(s.weight, 5);
  assert.strictEqual(s.name, 'Newt', 'name/sci survive from whichever event had them');
});

test('per-format splits add up', () => {
  assert.deepStrictEqual(r.formats.formats.typed, { answered: 3, correct: 2 });
  assert.deepStrictEqual(r.formats.formats.pair, { answered: 3, correct: 2 });
});

test('confusion pairs merge and their counts sum', () => {
  assert.deepStrictEqual(r.confusions.confusions, { 1: { 2: 3, 3: 1 } });
});

test('existing bars are kept in order, with counts still right-aligned', () => {
  // The source baseline had 3 bars but only 2 counts (its oldest predates card
  // counts), so the missing one must pad to 0 rather than shifting the rest.
  assert.deepStrictEqual(r.bars.bars.map((b) => b.pct), [60, 70, 80, 90]);
  assert.deepStrictEqual(r.bars.bars.map((b) => b.n), [0, 4, 5, 9]);
});

test('every local_day survives, deduplicated, so no streak day is lost', () => {
  assert.deepStrictEqual(
    [...r.days.days].sort(),
    ['2026-07-30', '2026-08-01', '2026-08-02']
  );
});

test('the fold takes the newest timestamp and the id it was given', () => {
  assert.strictEqual(r.identity.id, 'chosen-id');
  assert.strictEqual(r.identity.ts, '2026-08-05T00:00:00Z');
  assert.strictEqual(r.identity.local_day, '2026-08-05');
  assert.strictEqual(r.identity.device_id, 'dev');
});

test('nothing to fold returns null rather than an empty event', () => {
  assert.strictEqual(r.empty, null);
  assert.strictEqual(r.nullish, null);
});

test('holes in the list are skipped, not counted as zeroes', () => {
  assert.strictEqual(r.holes.answered, 2);
  assert.strictEqual(r.holes.correct, 1);
});

test('junk folds to values the events table will accept', () => {
  assert.strictEqual(r.junk.answered, 0);
  assert.strictEqual(r.junk.correct, 0);
  assert.strictEqual(r.junk.pct, null);
  assert.ok(r.junk.bars.every((b) => b.n >= 0 && b.pct >= 0 && b.pct <= 100));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
