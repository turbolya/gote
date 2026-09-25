// Tests for the typed-answer matcher (src/answermatch.js). Pure, so it runs in
// plain node via a small ESM wrapper (same approach as test-mastery.js).
//
// The bar this has to clear: a player who KNOWS the species must not be marked
// wrong for the keyboard. Most of what follows is that case in its various
// disguises — accents, case, hyphens, phone-typing slips. The opposite case
// matters too and is cheaper to check: naming a DIFFERENT species must never
// pass, however similar the spelling.

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'answermatch.js');

const script = `
import { normalizeName, levenshtein, alignEdits, maxEdits, matchAnswer } from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}
function ok(name, cond) { eq(name, !!cond, true); }

// A Hungarian common name, because that is the case that has to work: accents
// the phone keyboard makes awkward, on a long word.
const WOODPECKER = { common: 'Nagy fakopáncs', scientific: 'Dendrocopos major' };
const NEWT = { common: 'Smooth Newt', scientific: 'Lissotriton vulgaris' };
const NO_COMMON = { common: null, scientific: 'Lissotriton montandoni' };

console.log('\\nnormalizeName');
{
  eq('strips accents', normalizeName('Nagy fakopáncs'), 'nagy fakopancs');
  eq('lowercases', normalizeName('SMOOTH NEWT'), 'smooth newt');
  eq('hyphens become spaces', normalizeName('Great-spotted Woodpecker'), 'great spotted woodpecker');
  eq('collapses repeated whitespace', normalizeName('  Smooth   Newt  '), 'smooth newt');
  eq('drops a bracketed qualifier', normalizeName('Mallard (domestic)'), 'mallard');
  eq('drops apostrophes', normalizeName("Bewick's Swan"), 'bewick s swan');
  // The full Hungarian vowel set, including the double-acute ő/ű that NFD
  // decomposes to a base letter plus a combining mark.
  eq('Hungarian long vowels fold to base letters', normalizeName('áéíóöőúüű'), 'aeiooouuu');
  eq('and so do their capitals', normalizeName('ÁÉÍÓÖŐÚÜŰ'), 'aeiooouuu');
  eq('null', normalizeName(null), '');
  eq('undefined', normalizeName(undefined), '');
  eq('punctuation only', normalizeName('—,.'), '');
}

console.log('\\nlevenshtein');
{
  eq('identical', levenshtein('newt', 'newt'), 0);
  eq('one substitution', levenshtein('newt', 'newf'), 1);
  eq('one transposition costs two', levenshtein('ab', 'ba'), 2);
  eq('insertion', levenshtein('newt', 'newts'), 1);
  eq('empty against a word', levenshtein('', 'newt'), 4);
  eq('both empty', levenshtein('', ''), 0);
  // The ceiling is an optimisation, so it must never report UNDER the truth.
  ok('the ceiling only ever over-reports', levenshtein('abcdefgh', 'zzzzzzzz', 2) > 2);
  eq('a length gap beyond the ceiling exits early', levenshtein('a', 'aaaaaaaa', 2), 3);
}

console.log('\\nmaxEdits scales with length');
{
  eq('a 4-letter name gets no slack', maxEdits(4), 0);
  eq('a 9-letter name gets one', maxEdits(9), 1);
  eq('a 14-letter name gets two', maxEdits(14), 2);
  eq('long names cap at three', maxEdits(40), 3);
}

console.log('\\nmatchAnswer — the player knows it');
{
  const m = (t, card = WOODPECKER) => matchAnswer(t, card);
  ok('typed exactly', m('Nagy fakopáncs').ok);
  ok('without the accents', m('nagy fakopancs').ok);
  ok('all lower case', m('nagy fakopáncs').ok);
  ok('with stray whitespace', m('  nagy   fakopancs ').ok);
  ok('the scientific name instead', m('Dendrocopos major').ok);
  ok('scientific, lower case', m('dendrocopos major').ok);
  eq('which name matched is reported', m('dendrocopos major').matched, 'scientific');
  eq('the common name is preferred when both could match', m('nagy fakopancs').matched, 'common');
  // Forgiven typos: still correct, but flagged so the UI can show the spelling.
  const typo = m('nagy fakopnacs');
  ok('a transposed pair is forgiven', typo.ok);
  eq('and reported as inexact', typo.exact, false);
  eq('with the right spelling to show', typo.expected, 'Nagy fakopáncs');
  ok('a single wrong letter in a binomial is forgiven', m('Dendrocopos maior').ok);
  ok('a species with no common name still matches on scientific', matchAnswer('lissotriton montandoni', NO_COMMON).ok);
}

console.log('\\nmatchAnswer — the player does not know it');
{
  eq('empty', matchAnswer('', WOODPECKER).ok, false);
  eq('whitespace only', matchAnswer('   ', WOODPECKER).ok, false);
  eq('null', matchAnswer(null, WOODPECKER).ok, false);
  // The important one: fuzziness must not blur two real species together.
  eq('a DIFFERENT species never passes', matchAnswer('Lissotriton montandoni', NEWT).ok, false);
  eq('nor the other way round', matchAnswer('Lissotriton vulgaris', NO_COMMON).ok, false);
  eq('the genus alone is not the species', matchAnswer('Dendrocopos', WOODPECKER).ok, false);
  eq('an unrelated word', matchAnswer('badger', WOODPECKER).ok, false);
  eq('a card with no names at all', matchAnswer('anything', {}).ok, false);
  eq('no card', matchAnswer('anything', null).ok, false);
}

console.log('\\nmatchAnswer — the boundary');
{
  // 'Smooth Newt' normalises to 'smooth newt' (11 chars) → 2 edits forgiven.
  ok('two edits inside an 11-char name pass', matchAnswer('smoth newt', NEWT).ok);
  ok('three edits do not', matchAnswer('smth nwt', NEWT).ok === false);
  // Short names get no slack at all, so a one-letter slip is a miss — by
  // design: at that length one letter is often a different word.
  eq('a 4-letter name is exact-only', matchAnswer('nemt', { common: 'Newt', scientific: 'X' }).ok, false);
  eq('…and matches when spelled right', matchAnswer('newt', { common: 'Newt', scientific: 'X' }).ok, true);
}

console.log('\\nnormalizeName — every script keeps its letters');
{
  // These used to normalise to '' — so typing the name exactly was a miss.
  eq('Cyrillic survives', normalizeName('Серая ворона'), 'серая ворона');
  eq('Cyrillic breve/diaeresis fold like Latin accents', normalizeName('Ёж Й'), 'еж и');
  // Compared decomposed: NFKD splits the voiced mark off ブ, on both sides alike.
  eq('katakana survives, long-vowel mark included', normalizeName('ハシブトガラス・コーラー'), 'ハシブトガラス コーラー'.normalize('NFKD'));
  eq('Greek survives', normalizeName('Κοκκινολαίμης'), 'κοκκινολαιμης');
  eq('full-width letters fold to plain', normalizeName('Ｂｌａｃｋｂｉｒｄ'), 'blackbird');
  eq('ß, æ, ø and ł fold', normalizeName('Weißstorch Ærø Łabędź'), 'weissstorch aero labedz');
  eq('CJK punctuation separates', normalizeName('白鶺鴒（亜種）、'), '白鶺鴒');
}

console.log('\\nalignEdits');
{
  eq('a swapped pair is one edit', alignEdits('fakopnacs', 'fakopancs').distance, 1);
  eq('identical', alignEdits('newt', 'newt').distance, 0);
  eq('edits are charged to the letters they changed', alignEdits('westernx', 'easternx').perChar, [1, 1, 0, 0, 0, 0, 0, 0]);
  eq('an extra letter at the end is still charged somewhere', alignEdits('newts', 'newt').perChar.reduce((x, y) => x + y, 0), 1);
}

console.log('\\nmatchAnswer — a look-alike is not a typo');
{
  const E_MEADOWLARK = { taxonId: 1, common: 'Eastern Meadowlark', scientific: 'Sturnella magna' };
  const W_MEADOWLARK = { taxonId: 2, common: 'Western Meadowlark', scientific: 'Sturnella neglecta' };
  // Two edits in a 7-letter word: a different word, whatever the total allows.
  eq('Western for Eastern Meadowlark', matchAnswer('Western Meadowlark', E_MEADOWLARK).ok, false);
  eq('Western for Eastern Bluebird', matchAnswer('Western Bluebird', { common: 'Eastern Bluebird', scientific: 'Sialia sialis' }).ok, false);
  eq('Northern for Southern', matchAnswer('Northern Flicker', { common: 'Southern Flicker', scientific: 'X y' }).ok, false);
  eq('Parus minor for Parus major', matchAnswer('Parus minor', { common: 'Great Tit', scientific: 'Parus major' }).ok, false);
  // Real slips inside those same names still pass.
  ok('a swapped pair inside "Eastern" is forgiven', matchAnswer('Eastren Meadowlark', E_MEADOWLARK).ok);
  ok('a dropped letter in the long word is forgiven', matchAnswer('Eastern Meadowlrk', E_MEADOWLARK).ok);
  ok('run together without the space', matchAnswer('easternmeadowlark', E_MEADOWLARK).ok);
  eq('…but not run together AND the look-alike', matchAnswer('westernmeadowlark', E_MEADOWLARK).ok, false);
  // With the other species in play, an answer that fits it as well is a miss.
  const X = { taxonId: 3, common: 'Larus argentatus', scientific: 'Larus argentatus' };
  const Y = { taxonId: 4, common: 'Larus argenteus', scientific: 'Larus argenteus' };
  ok('alone, a two-edit near-miss on a long word passes', matchAnswer('Larus argenteus', X).ok);
  eq('with the species it actually names in the pool, it does not', matchAnswer('Larus argenteus', X, [X, Y]).ok, false);
  ok('the target itself in the pool changes nothing', matchAnswer('Eastren Meadowlark', E_MEADOWLARK, [E_MEADOWLARK]).ok);
  ok('an exact answer stands whatever is in the pool', matchAnswer('Eastern Meadowlark', E_MEADOWLARK, [W_MEADOWLARK]).ok);
  ok('a slip nearer the target than any other still passes', matchAnswer('Eastren Meadowlark', E_MEADOWLARK, [W_MEADOWLARK]).ok);
}

console.log('\\nmatchAnswer — other scripts');
{
  const CROW = { common: 'Серая ворона', scientific: 'Corvus cornix' };
  ok('Russian, typed exactly', matchAnswer('Серая ворона', CROW).ok);
  ok('Russian, lower case', matchAnswer('серая ворона', CROW).ok);
  ok('Russian, one slip in a long word', matchAnswer('Серая варона', CROW).ok);
  const JUNGLE = { common: 'ハシブトガラス', scientific: 'Corvus macrorhynchos' };
  ok('Japanese, typed exactly', matchAnswer('ハシブトガラス', JUNGLE).ok);
  eq('Japanese: one character off is another crow, not a slip', matchAnswer('ハシボソガラス', JUNGLE).ok, false);
  ok('the scientific name still works for a Japanese card', matchAnswer('Corvus macrorhynchos', JUNGLE).ok);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
  stdio: 'inherit',
});
