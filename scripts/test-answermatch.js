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
import { normalizeName, levenshtein, maxEdits, matchAnswer } from ${JSON.stringify(src)};

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

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
  stdio: 'inherit',
});
