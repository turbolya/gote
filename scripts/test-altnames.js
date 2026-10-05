// Tests for src/altnames.js — picking the typeable names out of iNaturalist's
// name list. The fixtures are trimmed copies of real GET /v1/taxa?all_names=true
// responses, so the shapes are the ones the API actually returns: names tagged
// with a BASE language ('pt', not 'pt-BR'), scientific names under locale 'sci',
// and a flag for invalid ones.

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'altnames.js');

const script = `
import { alternateNamesFrom } from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

// Alcedo atthis, as iNaturalist returns it.
const KINGFISHER = [
  { name: 'Common Kingfisher', locale: 'en', lexicon: 'english', position: 0, is_valid: true },
  { name: 'Eurasian Kingfisher', locale: 'en', lexicon: 'english', position: 1, is_valid: true },
  { name: 'River Kingfisher', locale: 'en', lexicon: 'english', position: 2, is_valid: true },
  { name: 'Alcedo atthis', locale: 'sci', lexicon: 'scientific-names', is_valid: true },
  { name: 'Guarda-rios', locale: 'pt', lexicon: 'portuguese', is_valid: true },
  { name: 'Guarda-rios-comum', locale: 'pt', lexicon: 'portuguese', is_valid: true },
  { name: 'カワセミ', locale: 'ja', lexicon: 'japanese', is_valid: true },
  { name: 'Eisvogel', locale: 'de', lexicon: 'german', is_valid: true },
  { name: 'सामान्य ढिवर', locale: 'mr', lexicon: 'marathi', is_valid: false },
];

eq('English: every English name, first-listed first',
  alternateNamesFrom(KINGFISHER, 'en'),
  ['Common Kingfisher', 'Eurasian Kingfisher', 'River Kingfisher']);

eq('a region on the locale does not hide the language (en-GB)',
  alternateNamesFrom(KINGFISHER, 'en-GB'),
  ['Common Kingfisher', 'Eurasian Kingfisher', 'River Kingfisher']);

eq('pt-BR gets the Portuguese names, which iNaturalist tags just "pt"',
  alternateNamesFrom(KINGFISHER, 'pt-BR'),
  ['Guarda-rios', 'Guarda-rios-comum']);

eq('another script', alternateNamesFrom(KINGFISHER, 'ja'), ['カワセミ']);

eq('only the studied language: a German deck does not accept the English names',
  alternateNamesFrom(KINGFISHER, 'de'), ['Eisvogel']);

eq('scientific names are never returned — the card already carries those',
  alternateNamesFrom(KINGFISHER, 'en').includes('Alcedo atthis'), false);

eq('invalid names are dropped',
  alternateNamesFrom(KINGFISHER, 'mr'), []);

eq('a name with no validity flag is kept',
  alternateNamesFrom([{ name: 'Smooth Newt', locale: 'en' }], 'en'), ['Smooth Newt']);

eq('duplicates collapse, ignoring case',
  alternateNamesFrom([
    { name: 'Coot', locale: 'en' },
    { name: 'coot', locale: 'en' },
    { name: ' Coot ', locale: 'en' },
  ], 'en'), ['Coot']);

eq('blank and non-string names are skipped',
  alternateNamesFrom([
    { name: '   ', locale: 'en' },
    { name: null, locale: 'en' },
    { locale: 'en' },
    null,
    { name: 'Robin', locale: 'en' },
  ], 'en'), ['Robin']);

eq('nothing to go on gives nothing, not an error', alternateNamesFrom(undefined, 'en'), []);
eq('not an array gives nothing', alternateNamesFrom({ name: 'x' }, 'en'), []);
eq('no locale gives nothing', alternateNamesFrom(KINGFISHER, ''), []);
eq('an unlisted language gives nothing', alternateNamesFrom(KINGFISHER, 'fi'), []);

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
  stdio: 'inherit',
});
