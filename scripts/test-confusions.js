// Tests for the confusion-pair ranking (src/confusions.js). Pure, so it runs in
// plain node via a small ESM wrapper (same approach as test-sync.js).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'confusions.js');

const script = `
import { topConfusionPairs } from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

console.log('\\ntopConfusionPairs');
{
  // Below the floor (default min 3) → nothing.
  eq('empty below the floor', topConfusionPairs({ A: { B: 2 } }), []);

  // Folds both directions of the same pair, then passes the floor.
  eq('folds both directions',
    topConfusionPairs({ A: { B: 2 }, B: { A: 1 } }),
    [{ a: 'A', b: 'B', count: 3, aToB: 2, bToA: 1 }]);

  // Strongest pair first.
  eq('ranks by count',
    topConfusionPairs({ A: { B: 5 }, C: { D: 3 } }).map((p) => [p.a, p.b, p.count]),
    [['A', 'B', 5], ['C', 'D', 3]]);

  // Self-pairs and zero/negative counts are ignored; canonical a<b ordering.
  eq('ignores self-pairs and zeros',
    topConfusionPairs({ A: { A: 9, B: 4, C: 0 } }),
    [{ a: 'A', b: 'B', count: 4, aToB: 4, bToA: 0 }]);

  // Respects the limit.
  eq('respects the limit',
    topConfusionPairs({ A: { B: 9 }, C: { D: 8 }, E: { F: 7 } }, { limit: 2 }).length, 2);

  // Custom floor.
  eq('honours a custom min',
    topConfusionPairs({ A: { B: 2 } }, { min: 2 }),
    [{ a: 'A', b: 'B', count: 2, aToB: 2, bToA: 0 }]);

  // Junk in, empty out.
  eq('survives junk', topConfusionPairs(null), []);
  eq('survives a junk row', topConfusionPairs({ A: 5, B: { C: 3 } }), [{ a: 'B', b: 'C', count: 3, aToB: 3, bToA: 0 }]);
}

console.log('\\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], { stdio: 'inherit' });
