// Tests for the pure quiz helpers in src/quiz.js (similar-distractor picking).
//   node scripts/test-quiz.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'quiz.js');
const code = babel.transformFileSync(file, {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const m = { exports: {} };
new Function('module', 'exports', 'require', code)(m, m.exports, require);
const { sharedAncestorDepth, pickSimilarDistractors, buildPickRound } = m.exports;

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok   ' + name);
  } catch (e) {
    fail++;
    console.log('  FAIL ' + name + '  =>  ' + e.message);
  }
}

// Taxonomy fixtures. Ancestry is kingdom→…→genus (ids), card's own taxonId is
// the species. Two roses share genus (…,10,20,30); daisy shares only kingdom.
const rose1 = { taxonId: 101, scientific: 'Rosa one', ancestry: [1, 10, 20, 30] };
const rose2 = { taxonId: 102, scientific: 'Rosa two', ancestry: [1, 10, 20, 30] };
const appleTree = { taxonId: 201, scientific: 'Malus x', ancestry: [1, 10, 20, 31] }; // same family (…20), diff genus
const oak = { taxonId: 301, scientific: 'Quercus x', ancestry: [1, 10, 25, 40] }; // same order (…10), diff family
const daisy = { taxonId: 401, scientific: 'Bellis x', ancestry: [1, 11, 50, 60] }; // same kingdom only
const spider = { taxonId: 501, scientific: 'Araneus x', ancestry: [2, 70, 80, 90] }; // different kingdom

t('sharedAncestorDepth: counts leading matches', () => {
  assert.equal(sharedAncestorDepth([1, 10, 20, 30], [1, 10, 20, 31]), 3);
  assert.equal(sharedAncestorDepth([1, 10, 20, 30], [1, 10, 20, 30]), 4);
  assert.equal(sharedAncestorDepth([1, 10], [2, 10]), 0);
  assert.equal(sharedAncestorDepth([], [1, 2]), 0);
});

t('prefers same genus over anything else', () => {
  const out = pickSimilarDistractors(rose1, [spider, daisy, oak, rose2], 1);
  assert.equal(out.length, 1);
  assert.equal(out[0].taxonId, rose2.taxonId, 'should pick the other rose');
});

t('orders by closeness: genus, family, order, kingdom', () => {
  const out = pickSimilarDistractors(rose1, [spider, daisy, oak, appleTree, rose2], 4);
  assert.deepEqual(
    out.map((c) => c.taxonId),
    [rose2.taxonId, appleTree.taxonId, oak.taxonId, daisy.taxonId]
  );
});

t('never includes the answer taxon', () => {
  const out = pickSimilarDistractors(rose1, [rose1, rose2, oak], 5);
  assert.equal(out.some((c) => c.taxonId === rose1.taxonId), false);
});

t('de-duplicates by taxon (one card per taxon)', () => {
  const dupRose = { ...rose2 }; // same taxonId as rose2
  const out = pickSimilarDistractors(rose1, [rose2, dupRose, oak], 5);
  const ids = out.map((c) => c.taxonId);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate taxa');
});

t('widens to unrelated only when nothing closer exists', () => {
  // Only a spider available (different kingdom) — must still return it.
  const out = pickSimilarDistractors(rose1, [spider], 1);
  assert.equal(out.length, 1);
  assert.equal(out[0].taxonId, spider.taxonId);
});

t('returns fewer than requested if pool is small', () => {
  const out = pickSimilarDistractors(rose1, [oak], 4);
  assert.equal(out.length, 1);
});

t('count <= 0 or no answer returns empty', () => {
  assert.deepEqual(pickSimilarDistractors(rose1, [oak], 0), []);
  assert.deepEqual(pickSimilarDistractors(null, [oak], 3), []);
});

t('missing ancestry degrades gracefully (treated as depth 0)', () => {
  const noAnc = { taxonId: 999, scientific: 'Mystery', ancestry: [] };
  const answerNoAnc = { taxonId: 1000, scientific: 'Answer', ancestry: [] };
  const out = pickSimilarDistractors(answerNoAnc, [noAnc, rose2], 2);
  assert.equal(out.length, 2, 'still returns candidates');
});

t('deterministic ordering with seeded rng for ties', () => {
  // appleTree and a sibling share the same depth with rose1; a fixed rng keeps
  // ordering stable/predictable.
  const sib = { taxonId: 202, scientific: 'Malus y', ancestry: [1, 10, 20, 31] };
  const rng = () => 0.5; // constant → stable tiebreak
  const out = pickSimilarDistractors(rose1, [appleTree, sib], 2, rng);
  assert.equal(out.length, 2);
});

// --- buildPickRound ---
// Each similar species carries its OWN curated photo set (`photos`), mirroring
// fetchTaxonPhotosByIds output — distractors must use official photos too.
const pickCard = { taxonId: 1, scientific: 'Danaus plexippus', common: 'Monarch' };
const curated = ['cur1.jpg', 'cur2.jpg'];
const similar = [
  { taxonId: 2, name: 'Limenitis archippus', common: 'Viceroy', photos: ['d1a.jpg', 'd1b.jpg'] },
  { taxonId: 3, name: 'Danaus gilippus', common: 'Queen', photos: ['d2a.jpg'] },
  { taxonId: 4, name: 'Dione vanillae', common: 'Gulf Frit', photos: ['d3a.jpg', 'd3b.jpg'] },
  { taxonId: 5, name: 'Extra', common: 'Extra', photos: ['d4a.jpg'] },
];
const allCuratedPhotos = new Set([...curated, 'd1a.jpg', 'd1b.jpg', 'd2a.jpg', 'd3a.jpg', 'd3b.jpg', 'd4a.jpg']);
const rng0 = () => 0; // deterministic

t('buildPickRound: 4 options, exactly one correct', () => {
  const r = buildPickRound({ card: pickCard, correctPhotos: curated, similar, rng: rng0 });
  assert.ok(r, 'round built');
  assert.equal(r.options.length, 4);
  assert.equal(r.options.filter((o) => o.correct).length, 1);
  assert.equal(r.name, 'Monarch');
});

t('buildPickRound: correct option uses a CURATED photo (not user photo)', () => {
  const r = buildPickRound({ card: pickCard, correctPhotos: curated, similar, rng: rng0 });
  const correct = r.options.find((o) => o.correct);
  assert.ok(curated.includes(correct.photo), 'correct photo is from curated set');
  assert.equal(correct.taxonId, pickCard.taxonId);
});

t('buildPickRound: correct photo is drawn from the front of the curated list', () => {
  // iNat returns taxon_photos in curator rank order, and past the first few
  // they turn into detail shots — a larva, a leaf underside, a pressed
  // specimen — that nobody can name in a quarter-screen tile. Only the front of
  // the list is eligible (PICK_PHOTO_DEPTH in src/quiz.js).
  const deep = ['c1.jpg', 'c2.jpg', 'c3.jpg', 'c4.jpg', 'c5.jpg', 'c6.jpg', 'c7.jpg', 'c8.jpg'];
  const front = new Set(deep.slice(0, 4));
  const seen = new Set();
  for (let seed = 0; seed < 200; seed++) {
    // A different deterministic stream per seed, so the shuffle lands
    // everywhere it is able to.
    let n = seed;
    const rng = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
    const r = buildPickRound({ card: pickCard, correctPhotos: deep, similar, rng });
    assert.ok(r, 'round built');
    const photo = r.options.find((o) => o.correct).photo;
    assert.ok(front.has(photo), 'drew ' + photo + ', from past the front of the list');
    seen.add(photo);
  }
  // …and it still varies within the front, or the cap would be hiding a
  // constant choice.
  assert.ok(seen.size > 1, 'the draw still varies');
});

t('buildPickRound: EVERY tile uses an official curated photo', () => {
  const r = buildPickRound({ card: pickCard, correctPhotos: curated, similar, rng: rng0 });
  for (const o of r.options) {
    assert.ok(allCuratedPhotos.has(o.photo), `tile photo ${o.photo} is a curated photo`);
  }
});

t('buildPickRound: every option carries a display name', () => {
  const r = buildPickRound({ card: pickCard, correctPhotos: curated, similar, rng: rng0 });
  assert.equal(r.options.every((o) => typeof o.name === 'string' && o.name.length > 0), true);
  assert.equal(r.options.find((o) => o.correct).name, 'Monarch');
  const commons = { 2: 'Viceroy', 3: 'Queen', 4: 'Gulf Frit', 5: 'Extra' };
  for (const o of r.options.filter((x) => !x.correct)) {
    assert.equal(o.name, commons[o.taxonId], 'distractor uses common name');
  }
});

t('buildPickRound: distractor name falls back to scientific when no common', () => {
  const noCommon = [
    { taxonId: 2, name: 'Aaa bbb', photos: ['d1.jpg'] },
    { taxonId: 3, name: 'Ccc ddd', photos: ['d2.jpg'] },
    { taxonId: 4, name: 'Eee fff', photos: ['d3.jpg'] },
  ];
  const r = buildPickRound({ card: pickCard, correctPhotos: curated, similar: noCommon, rng: rng0 });
  for (const o of r.options.filter((x) => !x.correct)) {
    assert.ok(o.name && o.name.includes(' '), 'used scientific name');
  }
});

t('buildPickRound: distractors are other taxa with distinct photos', () => {
  const r = buildPickRound({ card: pickCard, correctPhotos: curated, similar, rng: rng0 });
  const photos = r.options.map((o) => o.photo);
  assert.equal(new Set(photos).size, 4, 'all photos distinct');
  const distractorIds = r.options.filter((o) => !o.correct).map((o) => o.taxonId);
  assert.equal(distractorIds.includes(pickCard.taxonId), false);
});

t('buildPickRound: null when no curated photo', () => {
  assert.equal(buildPickRound({ card: pickCard, correctPhotos: [], similar, rng: rng0 }), null);
});

t('buildPickRound: null when too few similar species', () => {
  const tooFew = similar.slice(0, 2);
  assert.equal(buildPickRound({ card: pickCard, correctPhotos: curated, similar: tooFew, rng: rng0 }), null);
});

t('buildPickRound: skips similar species that have no curated photos', () => {
  // Two have photos, two are empty → only 2 usable distractors → null (need 3).
  const someEmpty = [
    { taxonId: 2, name: 'A', common: 'A', photos: ['d1.jpg'] },
    { taxonId: 3, name: 'B', common: 'B', photos: [] },
    { taxonId: 4, name: 'C', common: 'C', photos: ['d3.jpg'] },
    { taxonId: 5, name: 'D', common: 'D', photos: [] },
  ];
  assert.equal(buildPickRound({ card: pickCard, correctPhotos: curated, similar: someEmpty, rng: rng0 }), null);
});

t('buildPickRound: excludes a similar entry that is the target taxon', () => {
  const withSelf = [{ taxonId: 1, name: 'self', photos: ['self.jpg'] }, ...similar];
  const r = buildPickRound({ card: pickCard, correctPhotos: curated, similar: withSelf, rng: rng0 });
  const selfAsDistractor = r.options.find((o) => !o.correct && o.photo === 'self.jpg');
  assert.equal(selfAsDistractor, undefined);
});

t('buildPickRound: falls back to scientific name when no common name', () => {
  const r = buildPickRound({ card: { taxonId: 9, scientific: 'Bombus sp' }, correctPhotos: curated, similar, rng: rng0 });
  assert.equal(r.name, 'Bombus sp');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
