// Minimal iNaturalist API client — uses the v2 API.
// Docs: https://api.inaturalist.org/v2/docs/  (observations + taxa endpoints)
//
// We fetch a user's PUBLIC observations by username (no login required),
// then turn each observation that has both a photo and an identified taxon
// into a flashcard { image, common, scientific, ... }.
//
// v2 NOTE: unlike v1, the v2 API returns ONLY a `uuid` per record unless you
// pass a `fields` parameter selecting exactly which fields you want (a
// URL-encoded JSON object, with nested objects for nested fields). The
// FIELDS_* constants below declare what each call needs.

const API = 'https://api.inaturalist.org/v2/observations';
const TAXA_API = 'https://api.inaturalist.org/v2/taxa';
const SIMILAR_API =
  'https://api.inaturalist.org/v2/identifications/similar_species';
// iNaturalist asks API clients to identify themselves.
const USER_AGENT = 'Gote/1.0 (personal flashcard study app)';

const PER_PAGE = 200; // API maximum
const PAGE_LIMIT = 25; // hard safety cap => max 5000 observations scanned
const MAX_CACHE = 1000; // most cards we keep cached per account

// v2 field selections (serialized to the `fields` query param). Request only
// what each consumer needs, to keep responses small.
const FIELDS_OBSERVATION = {
  id: true,
  observed_on: true,
  updated_at: true,
  quality_grade: true,
  photos: { url: true },
  taxon: {
    name: true,
    rank: true,
    rank_level: true,
    iconic_taxon_name: true,
    preferred_common_name: true,
    ancestor_ids: true,
  },
};

const FIELDS_TAXON_PHOTOS = {
  taxon_photos: { photo: { url: true, medium_url: true } },
};

const FIELDS_TAXON_DETAIL = {
  name: true,
  rank: true,
  preferred_common_name: true,
  wikipedia_url: true,
  wikipedia_summary: true,
  observations_count: true,
  taxon_photos: { photo: { url: true, medium_url: true } },
  ancestors: { rank: true, name: true, preferred_common_name: true },
};

const FIELDS_SIMILAR = {
  taxon: {
    id: true,
    name: true,
    preferred_common_name: true,
    default_photo: { medium_url: true, square_url: true, url: true },
  },
};

const HEADERS = { Accept: 'application/json', 'User-Agent': USER_AGENT };

// Serialize a field selection for the v2 `fields` query param value.
function fieldsValue(fields) {
  return encodeURIComponent(JSON.stringify(fields));
}

// Best-effort GET returning the `results` array (empty on any failure). Used by
// the non-critical taxa/similar lookups, which should degrade quietly.
async function getResults(url) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// Best-effort GET of the v2 taxa endpoint for one or more ids. Returns the
// results array. Centralizes URL building so callers don't reassemble it.
function fetchTaxaResults(idOrIds, { locale, fields, perPage } = {}) {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  const params = [];
  if (perPage) params.push(`per_page=${perPage}`);
  if (locale) params.push(`locale=${encodeURIComponent(locale)}`);
  params.push(`fields=${fieldsValue(fields)}`);
  return getResults(
    `${TAXA_API}/${ids.map(encodeURIComponent).join(',')}?${params.join('&')}`
  );
}

// Extract de-duplicated, size-normalized photo URLs from a taxon's curated
// `taxon_photos`, capped to `max`.
function photoUrlsFrom(taxon, max) {
  const urls = ((taxon && taxon.taxon_photos) || [])
    .map((tp) => tp.photo)
    .filter((p) => p && (p.medium_url || p.url))
    .map((p) => p.medium_url || toMediumPhoto(p.url));
  return [...new Set(urls)].slice(0, max);
}

// iNat photo URLs come back sized as ".../<id>/<size>.jpg" where <size> is one
// of square|small|medium|large|original. Swap in whatever size we need.
function setPhotoSize(url, size) {
  if (!url) return url;
  return url.replace(/\/(square|small|medium|large|original)\./, `/${size}.`);
}

function toMediumPhoto(url) {
  return setPhotoSize(url, 'medium');
}

// Upscale a photo URL to a high-resolution version for the fullscreen viewer.
export function toLargePhoto(url) {
  return setPhotoSize(url, 'large');
}

// Sentence-case a name: first letter uppercase, the rest lowercase. Unicode-
// aware (handles accented characters like Hungarian "ő", unlike a \w regex,
// which would wrongly uppercase the letter after each accented character).
function sentenceCase(str) {
  const s = String(str || '').trim();
  if (!s) return s;
  const chars = [...s]; // split by code point, not UTF-16 unit
  return chars[0].toLocaleUpperCase() + chars.slice(1).join('').toLocaleLowerCase();
}

function observationToCard(obs) {
  const photo = obs.photos && obs.photos[0];
  const taxon = obs.taxon;
  if (!photo || !photo.url || !taxon || !taxon.name) return null;

  return {
    id: String(obs.id),
    taxonId: taxon.id,
    image: toMediumPhoto(photo.url),
    common: commonName(taxon),
    scientific: taxon.name,
    rank: taxon.rank || '',
    // Numeric rank depth (species=10, subspecies=5, genus=20, …). Used by the
    // "identified to species" filter: species-or-finer means rankLevel <= 10.
    rankLevel: typeof taxon.rank_level === 'number' ? taxon.rank_level : null,
    iconic: taxon.iconic_taxon_name || null,
    // Ordered kingdom→…→species ancestor taxon ids; used to pick taxonomically
    // similar multiple-choice distractors (shared deeper ancestor = closer kin).
    ancestry: Array.isArray(taxon.ancestor_ids) ? taxon.ancestor_ids : [],
    observedOn: obs.observed_on || null,
    // Cache/sync metadata:
    updatedAt: obs.updated_at || null, // server's last-modified, for incremental
    qualityGrade: obs.quality_grade || null, // for the research-grade local filter
  };
}

// Fisher–Yates shuffle (returns a new array).
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- pure helpers (exported for unit tests) ----------------------------------

// Is a card identified to an exact species (or finer — subspecies/variety/
// form)? Uses numeric rank_level: species=10, subspecies/variety/form < 10,
// genus/family/etc. > 10. Falls back to the rank string if rank_level is
// missing (e.g. very old cached cards).
function isSpeciesOrFiner(card) {
  if (typeof card.rankLevel === 'number') return card.rankLevel <= 10;
  return (
    card.rank === 'species' ||
    card.rank === 'subspecies' ||
    card.rank === 'variety' ||
    card.rank === 'form'
  );
}

// Apply the local display filters to cached cards. These used to be query
// params; making them local means toggling them never re-downloads.
//   - researchGrade:  keep only research-grade cards identified to species
//   - speciesOnly:    keep only cards identified to species (any grade)
//   - perSpecies:     keep one card per taxon (first wins)
export function applyFilters(
  cards,
  { perSpecies = true, researchGrade = false, speciesOnly = false } = {}
) {
  let out = cards;
  if (researchGrade) {
    out = out.filter((c) => c.qualityGrade === 'research' && isSpeciesOrFiner(c));
  } else if (speciesOnly) {
    // Looser than research-grade: exact species identification, any quality.
    out = out.filter(isSpeciesOrFiner);
  }
  if (perSpecies) {
    const seen = new Set();
    out = out.filter((c) => {
      if (seen.has(c.taxonId)) return false;
      seen.add(c.taxonId);
      return true;
    });
  }
  return out;
}

// Merge freshly fetched cards into the cached set (both keyed by card id).
// Incoming cards overwrite existing ones (updates); new ids are added. Result is
// sorted by observedOn desc (newest first), then capped to `max`.
export function mergeCards(existing, incoming, max = MAX_CACHE) {
  const byId = new Map();
  for (const c of existing) byId.set(c.id, c);
  for (const c of incoming) byId.set(c.id, c); // overwrite/insert
  const merged = [...byId.values()];
  merged.sort((a, b) => {
    const ao = a.observedOn || '';
    const bo = b.observedOn || '';
    if (ao === bo) return Number(b.id) - Number(a.id);
    return ao < bo ? 1 : -1;
  });
  return merged.slice(0, max);
}

// The newest `updated_at` across a set of cards — the watermark for the next
// incremental sync. Returns the original ISO string (which the API accepts as
// `updated_since`). Compares by parsed time, not lexically, because iNat
// timestamps carry varying timezone offsets and string-comparing those would
// pick the wrong one and risk missing updates.
export function newestUpdatedAt(cards) {
  let newest = null;
  let newestMs = -Infinity;
  for (const c of cards) {
    if (!c.updatedAt) continue;
    const ms = Date.parse(c.updatedAt);
    if (!Number.isNaN(ms) && ms > newestMs) {
      newestMs = ms;
      newest = c.updatedAt;
    }
  }
  return newest;
}

// --- network -----------------------------------------------------------------

// Internal: page through the observations endpoint, converting to cards. When
// `updatedSince` is set we ask only for observations changed since then (the
// incremental path); otherwise it's a full scan.
async function fetchObservationCards(username, { locale, updatedSince, max, onProgress } = {}) {
  const clean = String(username || '').trim();
  if (!clean) throw new Error('Please enter an iNaturalist username.');

  let page = 1;
  let total = Infinity;
  const cards = [];
  const cap = max || MAX_CACHE;

  while (cards.length < cap && page <= PAGE_LIMIT) {
    // For incremental sync, order by updated_at so we can stop early once we've
    // seen everything changed since the watermark.
    const order = updatedSince ? 'updated_at' : 'observed_on';
    const url =
      `${API}?user_id=${encodeURIComponent(clean)}` +
      `&photos=true&per_page=${PER_PAGE}&page=${page}` +
      `&order_by=${order}&order=desc` +
      (locale ? `&locale=${encodeURIComponent(locale)}` : '') +
      (updatedSince ? `&updated_since=${encodeURIComponent(updatedSince)}` : '') +
      `&fields=${fieldsValue(FIELDS_OBSERVATION)}`;

    let res;
    try {
      res = await fetch(url, { headers: HEADERS });
    } catch (e) {
      throw new Error('Network error — check your internet connection.');
    }

    if (res.status === 404 || res.status === 422) {
      throw new Error(`No iNaturalist user named "${clean}" was found.`);
    }
    if (!res.ok) {
      throw new Error(`iNaturalist API error (status ${res.status}).`);
    }

    const data = await res.json();
    total = data.total_results || 0;

    if (total === 0 && page === 1 && !updatedSince) {
      throw new Error(
        `No observations found for "${clean}". Double-check the username.`
      );
    }

    const results = data.results || [];
    if (results.length === 0) break;

    for (const obs of results) {
      const card = observationToCard(obs);
      if (card) cards.push(card);
    }

    if (onProgress) onProgress(Math.min(page * PER_PAGE, total), total);

    if (page * PER_PAGE >= total) break;
    page++;
  }

  return cards;
}

/**
 * Full download of a user's observations as flashcards (used for the first load
 * of an account, or a forced refresh). Returns ALL cards with cache metadata;
 * perSpecies/researchGrade are applied later as local filters via applyFilters.
 *
 * @param {string} username
 * @param {object} opts  { locale, max, onProgress }
 * @returns {Promise<Array>} card objects
 */
export async function fetchCards(username, opts = {}) {
  const { locale, max, onProgress } = opts;
  const cards = await fetchObservationCards(username, { locale, max, onProgress });
  if (cards.length === 0) {
    throw new Error(
      `Found observations for "${String(username).trim()}", but none had both ` +
        `a photo and an identified species to quiz on.`
    );
  }
  return cards;
}

/**
 * Incremental sync: fetch only observations created/updated since `updatedSince`
 * (an ISO timestamp). Returns the changed/new cards (possibly empty). Never
 * throws "no observations" — an empty result just means nothing changed.
 *
 * @param {string} username
 * @param {object} opts  { locale, updatedSince, onProgress }
 * @returns {Promise<Array>} changed card objects
 */
export async function fetchUpdatedCards(username, opts = {}) {
  const { locale, updatedSince, onProgress } = opts;
  if (!updatedSince) {
    // No watermark → behave like a full fetch.
    return fetchObservationCards(username, { locale, onProgress });
  }
  return fetchObservationCards(username, { locale, updatedSince, onProgress });
}

// Sentence-cased common name from a taxon, or null when it has none.
function commonName(taxon) {
  return taxon && taxon.preferred_common_name
    ? sentenceCase(taxon.preferred_common_name)
    : null;
}

/**
 * Fetch iNaturalist's curated representative photos for a taxon (the ones shown
 * on the species page). Best-effort: returns [] on any error.
 *
 * @param {number|string} taxonId
 * @param {number} max  cap on how many photo URLs to return
 * @returns {Promise<string[]>} medium-size photo URLs
 */
export async function fetchTaxonPhotos(taxonId, max = 8) {
  if (taxonId == null) return [];
  const [taxon] = await fetchTaxaResults(taxonId, { fields: FIELDS_TAXON_PHOTOS });
  return taxon ? photoUrlsFrom(taxon, max) : [];
}

/**
 * Fetch the species most commonly confused with a taxon (iNat's "similar
 * species") — the distractor pool for the "Pick the right one" game. Returns the
 * candidate taxa (id + names) only; the game fetches each one's CURATED photos
 * separately so distractors use the same official species-page images as the
 * correct answer. Best-effort: returns [] on any error.
 *
 * @param {number|string} taxonId
 * @param {string} locale  language for common names (matches the deck's locale)
 * @returns {Promise<Array<{taxonId:number, name:string, common:string|null}>>}
 */
export async function fetchSimilarSpecies(taxonId, locale) {
  if (taxonId == null) return [];
  const url =
    `${SIMILAR_API}?taxon_id=${encodeURIComponent(taxonId)}` +
    (locale ? `&locale=${encodeURIComponent(locale)}` : '') +
    `&fields=${fieldsValue(FIELDS_SIMILAR)}`;
  const results = await getResults(url);
  return results
    .map((r) => r.taxon)
    .filter((t) => t && t.id)
    .map((t) => ({ taxonId: t.id, name: t.name, common: commonName(t) }));
}

/**
 * Batch-fetch iNaturalist's curated representative photos for several taxa in
 * one request. Returns a map { [taxonId]: [photoUrl, …] }. Best-effort: missing
 * or failed taxa simply get an empty array. iNat accepts up to 30 ids/call.
 *
 * @param {Array<number|string>} ids
 * @param {number} maxPer  cap on photos per taxon
 * @returns {Promise<Object<string, string[]>>}
 */
export async function fetchTaxonPhotosByIds(ids, maxPer = 6) {
  const list = [...new Set((ids || []).filter((x) => x != null))];
  const out = {};
  for (let i = 0; i < list.length; i += 30) {
    const chunk = list.slice(i, i + 30);
    const results = await fetchTaxaResults(chunk, {
      fields: FIELDS_TAXON_PHOTOS,
      perPage: 30,
    });
    for (const t of results) out[t.id] = photoUrlsFrom(t, maxPer);
  }
  return out;
}

/**
 * Full detail for one taxon, for the Lexicon detail page: curated photos,
 * named ancestors, wikipedia summary, common/scientific names, observation
 * count. Best-effort: returns null on error.
 *
 * @param {number|string} taxonId
 * @param {string} locale  language for common names
 */
export async function fetchTaxonDetail(taxonId, locale) {
  if (taxonId == null) return null;
  const [t] = await fetchTaxaResults(taxonId, {
    locale,
    fields: FIELDS_TAXON_DETAIL,
  });
  if (!t) return null;

  const ancestors = (t.ancestors || [])
    .filter((a) => a && a.name)
    .map((a) => ({ rank: a.rank, name: a.name, common: commonName(a) }));

  // Strip the HTML tags iNat includes in the summary.
  const summary = t.wikipedia_summary
    ? String(t.wikipedia_summary).replace(/<[^>]+>/g, '').trim()
    : null;

  return {
    id: t.id,
    scientific: t.name,
    common: commonName(t),
    rank: t.rank || '',
    photos: photoUrlsFrom(t),
    ancestors,
    summary,
    wikipediaUrl: t.wikipedia_url || null,
    observationsCount: t.observations_count || null,
  };
}
