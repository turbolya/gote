// Tests for the confusion-pair ranking (src/confusions.js). Pure, so it runs in
// plain node via a small ESM wrapper (same approach as test-sync.js).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'confusions.js');

const script = `
import { topConfusionPairs, pairKey, pairCount, CONFUSION_HINT_MIN, speciesEntry, speciesInfo } from ${JSON.stringify(src)};

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

console.log('\\npairKey');
{
  eq('is order-independent', pairKey('A', 'B'), pairKey('B', 'A'));
  eq('sorts its parts', pairKey('B', 'A'), 'A B');
  eq('coerces numbers to strings', pairKey(20, 3), pairKey(3, 20));
}

console.log('\\npairCount');
{
  eq('sums both directions', pairCount({ A: { B: 2 }, B: { A: 1 } }, 'A', 'B'), 3);
  eq('is order-independent', pairCount({ A: { B: 2 }, B: { A: 1 } }, 'B', 'A'), 3);
  eq('one direction only', pairCount({ A: { B: 4 } }, 'A', 'B'), 4);
  eq('missing pair is zero', pairCount({ A: { C: 2 } }, 'A', 'B'), 0);
  eq('a self-pair is zero', pairCount({ A: { A: 9 } }, 'A', 'A'), 0);
  eq('junk is zero', pairCount(null, 'A', 'B'), 0);
  eq('the hint floor is a positive integer', Number.isInteger(CONFUSION_HINT_MIN) && CONFUSION_HINT_MIN > 0, true);
}

console.log('\\nspeciesEntry / speciesInfo');
{
  // A deck card.
  eq('a card', speciesEntry({ taxonId: 1, common: 'Monarch', scientific: 'Danaus plexippus', image: 'own.jpg' }),
     { name: 'Monarch', sci: 'Danaus plexippus', image: 'own.jpg' });

  // One tile of a photo grid: a name and a curated photo, no scientific name.
  eq('a photo tile', speciesEntry({ taxonId: 2, name: 'Viceroy', photo: 'cur.jpg' }),
     { name: 'Viceroy', sci: null, image: 'cur.jpg' });

  // A per-species tally, which spells the scientific name differently.
  eq('a tally', speciesEntry({ name: 'Queen', sci: 'Danaus gilippus', image: null }),
     { name: 'Queen', sci: 'Danaus gilippus', image: null });

  // A name is the one field a row cannot do without.
  eq('no name is no entry', speciesEntry({ taxonId: 3, image: 'x.jpg' }), null);
  eq('junk is no entry', speciesEntry(null), null);

  // Falls back to the scientific name when there is no common one.
  eq('scientific only', speciesEntry({ scientific: 'Bombus sp' }),
     { name: 'Bombus sp', sci: 'Bombus sp', image: null });
}

console.log('\\nspeciesInfo resolution order');
{
  const sources = {
    cards:   { '1': { common: 'Monarch', scientific: 'Danaus plexippus', image: 'own.jpg' } },
    species: { '1': { name: 'Stale', sci: 'Stale sp', image: 'tally.jpg' },
               '2': { name: 'Queen', sci: 'Danaus gilippus', image: 'tally2.jpg' } },
    seen:    { '1': { name: 'Older', photo: 'seen.jpg' },
               '3': { name: 'Viceroy', photo: 'tile.jpg' } },
  };
  // Deck wins: it has the player's own photo and the freshest naming.
  eq('deck first', speciesInfo('1', sources).image, 'own.jpg');
  // Then the tallies — a species answered in a Nearby round, say.
  eq('tally second', speciesInfo('2', sources).name, 'Queen');
  // Then the directory: the look-alike from a photo grid that is in no deck and
  // has no tally. This is the case that used to make a whole pair vanish.
  eq('directory last', speciesInfo('3', sources), { name: 'Viceroy', sci: null, image: 'tile.jpg' });
  // Genuinely unknown stays unknown rather than inventing a label.
  eq('unknown is null', speciesInfo('9', sources), null);
  eq('no key is null', speciesInfo(null, sources), null);
  eq('no sources is null', speciesInfo('1'), null);
}

console.log('\\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], { stdio: 'inherit' });
