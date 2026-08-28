// Fixture data for E2E (Detox) test mode — see ./testMode.js. These stand in
// for the iNaturalist API responses so the whole app can be driven offline and
// deterministically. Only used when IS_E2E is true.

// A 1×1 transparent PNG so <Image> never needs the network. A #fragment is
// appended per photo to make URLs distinct (the quiz de-dupes photos by URL).
const IMG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const img = (taxonId, n) => `${IMG}#${taxonId}-${n}`;

// A small, stable deck spanning a few iconic groups. Each is research-grade and
// identified to species so every study filter keeps them. Ancestry shares a
// prefix within a group so taxonomic distractor-picking has something to work
// with.
export const E2E_CARDS = [
  ['European Robin', 'Erithacus rubecula', 'Aves', [1, 2, 3]],
  ['Barn Swallow', 'Hirundo rustica', 'Aves', [1, 2, 4]],
  ['Great Tit', 'Parus major', 'Aves', [1, 2, 5]],
  ['Common Blackbird', 'Turdus merula', 'Aves', [1, 2, 6]],
  ['Monarch', 'Danaus plexippus', 'Insecta', [1, 7, 8]],
  ['Western Honey Bee', 'Apis mellifera', 'Insecta', [1, 7, 9]],
  ['Seven-spot Ladybird', 'Coccinella septempunctata', 'Insecta', [1, 7, 10]],
  ['Common Daisy', 'Bellis perennis', 'Plantae', [11, 12, 13]],
].map(([common, scientific, iconic, anc], i) => {
  const taxonId = 1001 + i;
  return {
    id: `obs-${taxonId}`,
    taxonId,
    image: img(taxonId, 'card'),
    attribution: '(c) e2e tester, some rights reserved (CC BY-NC)',
    licenseCode: 'cc-by-nc',
    common,
    scientific,
    rank: 'species',
    rankLevel: 10,
    iconic,
    ancestry: [...anc, taxonId],
    observedOn: `2024-05-${String(i + 1).padStart(2, '0')}`,
    // Deterministic coords near Budapest so the card's location pin + map render.
    lat: 47.4979 + i * 0.01,
    lng: 19.0402 + i * 0.01,
    placeGuess: 'Budapest, Hungary',
    updatedAt: `2024-05-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    qualityGrade: 'research',
  };
});

const byId = new Map(E2E_CARDS.map((c) => [c.taxonId, c]));

// Curated photos for a taxon (distinct URLs so the picker can de-dupe).
export function e2eTaxonPhotos(taxonId, max = 8) {
  return [img(taxonId, 'a'), img(taxonId, 'b'), img(taxonId, 'c')].slice(0, max);
}

// Attribution for a fixture photo. Real photos carry one from iNaturalist and
// the fullscreen viewer shows it; fixtures never go through that parsing, so
// without this the credit footer would be untestable. src/api.js files these
// exactly the way it files the real ones.
export const e2eAttribution = (n) =>
  `(c) Fixture Photographer ${n + 1}, some rights reserved (CC BY)`;

// Curated photos for several taxa at once → { [taxonId]: [url, …] }.
export function e2eTaxonPhotosByIds(ids = [], maxPer = 6) {
  const out = {};
  for (const id of ids) out[id] = e2eTaxonPhotos(id, maxPer);
  return out;
}

// Default thumbnail per taxon → { [taxonId]: url }.
export function e2eTaxonThumbs(ids = []) {
  const out = {};
  for (const id of ids) out[id] = img(id, 'thumb');
  return out;
}

// "Similar species" distractor pool for "Pick the right one": four other taxa.
export function e2eSimilar(taxonId) {
  return E2E_CARDS.filter((c) => c.taxonId !== taxonId)
    .slice(0, 4)
    .map((c) => ({ taxonId: c.taxonId, name: c.scientific, common: c.common }));
}

// Full detail for the Lexicon detail page.
export function e2eDetail(taxonId) {
  const c = byId.get(taxonId) || E2E_CARDS[0];
  return {
    id: c.taxonId,
    scientific: c.scientific,
    common: c.common,
    rank: 'species',
    photos: e2eTaxonPhotos(c.taxonId),
    ancestors: [
      { rank: 'family', name: 'Testidae', common: null },
      { rank: 'genus', name: c.scientific.split(' ')[0], common: null },
    ],
    summary: `${c.common} (${c.scientific}) is a fixture species used for tests.`,
    wikipediaUrl: null,
    observationsCount: 1234,
  };
}

// Place search for the "Nearby species" location picker.
export function e2ePlaces() {
  return [
    { id: 9001, name: 'Test Park', lat: 47.5, lng: 19.05 },
    { id: 9002, name: 'Test Forest', lat: 47.6, lng: 19.1 },
  ];
}

// Nearby species: just reuse the deck (place-typical species).
export function e2eNearbyCards() {
  return E2E_CARDS.map((c) => ({ ...c, id: `taxon-${c.taxonId}` }));
}
