// Tests for the study screen's photo choice (src/studyphoto.js) and the shared
// species key (src/mastery.js). Pure, so it runs in plain node via a small ESM
// wrapper (same approach as test-mastery.js).
//
// The rule that matters most here is the LEAK GUARD: while a mastered species'
// official photo is being fetched, the player's own photo must not be on screen.
// It used to be one branch of a conditional expression inside a component, which
// meant it could only be checked by reading it. Breaking it would show up as a
// brief flicker, on a screen full of legitimate loading states, only for
// mastered species, and only with an option that is off by default.

const path = require('path');
const { execFileSync } = require('child_process');

const photo = path.join(__dirname, '..', 'src', 'studyphoto.js');
const mastery = path.join(__dirname, '..', 'src', 'mastery.js');

const script = `
import { wantsFreshPhoto, pickFreshPhoto, studyPhoto, studyCredit, showsOwnPhoto } from ${JSON.stringify(photo)};
import { speciesKey, isMastered } from ${JSON.stringify(mastery)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

const CARD = { taxonId: 42, scientific: 'Bufo bufo', image: 'own.jpg' };
const masteredAlways = () => true;
const masteredNever = () => false;

console.log('\\nspeciesKey');
{
  eq('taxon id wins, as a string', speciesKey(CARD), '42');
  eq('id 0 is a real id, not missing', speciesKey({ taxonId: 0, scientific: 'X' }), '0');
  eq('falls back to the scientific name', speciesKey({ scientific: 'Bufo bufo' }), 'Bufo bufo');
  eq('null id falls back too', speciesKey({ taxonId: null, scientific: 'Bufo bufo' }), 'Bufo bufo');
  eq('nothing usable', speciesKey({}), null);
  eq('no card', speciesKey(null), null);
}

console.log('\\nwantsFreshPhoto');
{
  eq('mastered + option on', wantsFreshPhoto({ freshPhotos: true, card: CARD, isMastered: masteredAlways }), true);
  eq('option off', wantsFreshPhoto({ freshPhotos: false, card: CARD, isMastered: masteredAlways }), false);
  eq('not mastered', wantsFreshPhoto({ freshPhotos: true, card: CARD, isMastered: masteredNever }), false);
  eq('no card', wantsFreshPhoto({ freshPhotos: true, card: null, isMastered: masteredAlways }), false);
  eq('no lookup supplied', wantsFreshPhoto({ freshPhotos: true, card: CARD }), false);
  eq('no arguments at all', wantsFreshPhoto(), false);
  // The lookup must be asked under the key the tallies are stored under.
  let askedWith = 'never called';
  wantsFreshPhoto({ freshPhotos: true, card: CARD, isMastered: (k) => { askedWith = k; return true; } });
  eq('asks under speciesKey', askedWith, '42');
  // And it must agree with a real tally, not just a stub.
  const tallies = { '42': { known: 9, missed: 1 } };
  eq('agrees with a real mastered tally',
    wantsFreshPhoto({ freshPhotos: true, card: CARD, isMastered: (k) => isMastered(tallies[k]) }), true);
  eq('agrees with a real unmastered tally',
    wantsFreshPhoto({ freshPhotos: true, card: CARD, isMastered: (k) => isMastered({ known: 1, missed: 0 }[k]) }), false);
}

console.log('\\npickFreshPhoto');
{
  eq('picks by the supplied random', pickFreshPhoto(['a','b','c','d'], () => 0.5), 'c');
  eq('first at 0', pickFreshPhoto(['a','b','c'], () => 0), 'a');
  eq('last just under 1', pickFreshPhoto(['a','b','c'], () => 0.999), 'c');
  eq('exactly 1.0 does not run off the end', pickFreshPhoto(['a','b','c'], () => 1), 'c');
  eq('single photo', pickFreshPhoto(['only'], () => 0.7), 'only');
  eq('empty list', pickFreshPhoto([], () => 0), null);
  eq('not a list', pickFreshPhoto(null), null);
  eq('junk random', pickFreshPhoto(['a','b'], () => NaN), 'a');
  // Every element must be reachable, or "varies each appearance" is a lie.
  const seen = new Set();
  for (let i = 0; i < 1000; i++) seen.add(pickFreshPhoto(['a','b','c','d']));
  eq('reaches every photo over many draws', [...seen].sort().join(''), 'abcd');
}

console.log('\\nstudyPhoto — the leak guard');
{
  // THE rule: fresh wanted but not resolved => nothing on screen.
  eq('own photo is NOT shown while fetching',
    studyPhoto({ wantsFresh: true, freshResolved: false, freshUri: null, ownImage: 'own.jpg' }),
    { uri: null, loading: true });
  // Even if a uri somehow arrived without the resolved flag, still nothing.
  eq('unresolved wins over a stray uri',
    studyPhoto({ wantsFresh: true, freshResolved: false, freshUri: 'fresh.jpg', ownImage: 'own.jpg' }),
    { uri: null, loading: true });
  eq('the fresh photo once resolved',
    studyPhoto({ wantsFresh: true, freshResolved: true, freshUri: 'fresh.jpg', ownImage: 'own.jpg' }),
    { uri: 'fresh.jpg', loading: false });
  // Offline / no curated photos: better a memorised picture than a blank card.
  eq('falls back to the own photo when the fetch found nothing',
    studyPhoto({ wantsFresh: true, freshResolved: true, freshUri: null, ownImage: 'own.jpg' }),
    { uri: 'own.jpg', loading: false });
  eq('nothing at all is not a loading state',
    studyPhoto({ wantsFresh: true, freshResolved: true, freshUri: null, ownImage: null }),
    { uri: null, loading: false });
}

console.log('\\nstudyPhoto — the ordinary path');
{
  eq('own photo when fresh is not wanted',
    studyPhoto({ wantsFresh: false, ownImage: 'own.jpg' }),
    { uri: 'own.jpg', loading: false });
  eq('never loading when fresh is not wanted',
    studyPhoto({ wantsFresh: false, freshResolved: false, ownImage: 'own.jpg' }),
    { uri: 'own.jpg', loading: false });
  eq('a card with no photo',
    studyPhoto({ wantsFresh: false, ownImage: null }),
    { uri: null, loading: false });
  eq('no arguments at all', studyPhoto(), { uri: null, loading: false });
}

console.log('\\nend to end: a species crossing the mastery threshold');
{
  // 4 correct — below MASTERY_MIN_CORRECT, so the player's own photo stays.
  const notYet = { '42': { known: 4, missed: 0 } };
  const wantA = wantsFreshPhoto({ freshPhotos: true, card: CARD, isMastered: (k) => isMastered(notYet[k]) });
  eq('below the threshold: still the own photo',
    studyPhoto({ wantsFresh: wantA, freshResolved: !wantA, ownImage: CARD.image }),
    { uri: 'own.jpg', loading: false });

  // One more correct answer crosses it: the own photo must go immediately, and
  // only come back if the fetch turns up nothing.
  const now = { '42': { known: 5, missed: 0 } };
  const wantB = wantsFreshPhoto({ freshPhotos: true, card: CARD, isMastered: (k) => isMastered(now[k]) });
  eq('crossing it flips the decision', wantB, true);
  eq('and the own photo goes immediately',
    studyPhoto({ wantsFresh: wantB, freshResolved: false, ownImage: CARD.image }),
    { uri: null, loading: true });
  eq('replaced once the official photo arrives',
    studyPhoto({ wantsFresh: wantB, freshResolved: true, freshUri: 'official.jpg', ownImage: CARD.image }),
    { uri: 'official.jpg', loading: false });
}

console.log('\\nshowsOwnPhoto');
{
  eq('the own photo is the own photo', showsOwnPhoto({ photoUri: 'own.jpg', ownImage: 'own.jpg' }), true);
  eq('an official photo is not', showsOwnPhoto({ photoUri: 'official.jpg', ownImage: 'own.jpg' }), false);
  eq('nothing on screen yet is not (a fresh photo still loading)', showsOwnPhoto({ photoUri: null, ownImage: 'own.jpg' }), false);
  eq('no own photo and none shown is not either, not a match of two nulls', showsOwnPhoto({ photoUri: null, ownImage: null }), false);
  eq('no arguments is safe', showsOwnPhoto(), false);
  eq('agrees with studyPhoto: not wanted, own photo',
    showsOwnPhoto({ photoUri: studyPhoto({ wantsFresh: false, ownImage: 'own.jpg' }).uri, ownImage: 'own.jpg' }), true);
  eq('agrees with studyPhoto: wanted and resolved, official photo',
    showsOwnPhoto({ photoUri: studyPhoto({ wantsFresh: true, freshResolved: true, freshUri: 'official.jpg', ownImage: 'own.jpg' }).uri, ownImage: 'own.jpg' }), false);
  eq('agrees with studyPhoto: wanted but offline, back to the own photo',
    showsOwnPhoto({ photoUri: studyPhoto({ wantsFresh: true, freshResolved: true, freshUri: null, ownImage: 'own.jpg' }).uri, ownImage: 'own.jpg' }), true);
  eq('agrees with studyPhoto: wanted and still fetching, nothing yet',
    showsOwnPhoto({ photoUri: studyPhoto({ wantsFresh: true, freshResolved: false, ownImage: 'own.jpg' }).uri, ownImage: 'own.jpg' }), false);
}

console.log('\\nstudyCredit');
{
  const registry = { 'official.jpg': '© Official Photographer (CC BY)' };
  const lookup = (u) => registry[u] || null;
  const own = '© Own Photographer (CC BY-NC)';
  const base = { ownImage: 'own.jpg', ownCredit: own, lookupCredit: lookup };

  eq('the own photo carries the own credit',
    studyCredit({ ...base, photoUri: 'own.jpg' }), own);
  eq('an official photo carries its own photographer, not the cards',
    studyCredit({ ...base, photoUri: 'official.jpg' }), '© Official Photographer (CC BY)');
  eq('an official photo is never given the own credit',
    studyCredit({ ...base, photoUri: 'official.jpg' }) === own, false);
  eq('an official photo with no filed credit shows none, not the cards',
    studyCredit({ ...base, photoUri: 'unfiled.jpg' }), null);
  eq('nothing on screen yet, nothing credited (the fetch is pending)',
    studyCredit({ ...base, photoUri: null }), null);
  eq('the fallback to the own photo (offline) credits the own photo',
    studyCredit({ ...base, photoUri: studyPhoto({ wantsFresh: true, freshResolved: true, freshUri: null, ownImage: 'own.jpg' }).uri }), own);
  eq('an own photo with no credit (an older cached deck) shows none',
    studyCredit({ ...base, ownCredit: null, photoUri: 'own.jpg' }), null);
  eq('no registry to ask: an official photo shows none',
    studyCredit({ photoUri: 'official.jpg', ownImage: 'own.jpg', ownCredit: own }), null);
  eq('no arguments at all is safe', studyCredit(), null);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
  stdio: 'inherit',
});
