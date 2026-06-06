// Pure helpers for the Lexicon (browsable list of all observed species).
// No React Native imports — unit-tested in scripts/test-lexicon.js.

// Genus is the first word of a scientific binomial ("Danaus plexippus" → genus
// "Danaus"). Kept for display (shown under names without a common name).
export function genusOf(card) {
  if (!card || !card.scientific) return null;
  return String(card.scientific).trim().split(/\s+/)[0] || null;
}

// Collapse a deck to one entry per taxon (first occurrence wins) for listing.
export function uniqueByTaxon(cards) {
  const seen = new Set();
  const out = [];
  for (const c of cards) {
    const key = c.taxonId != null ? c.taxonId : c.scientific;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

// Display name used in the table and search.
export function displayName(card) {
  return (card && (card.common || card.scientific)) || '';
}

// The key under which a card's gameplay tally is stored (mirrors App's
// recordResult: taxonId as string, falling back to the scientific name).
export function statsKey(card) {
  if (!card) return '';
  return card.taxonId != null ? String(card.taxonId) : card.scientific;
}

/**
 * Classify a species by how the user has done on it in games, using the
 * per-species tallies ({ known, missed }):
 *   'new'    — never appeared in a game yet
 *   'good'   — answered right more often than wrong
 *   'missed' — played, but missed at least as often as known
 *
 * @param {object} card
 * @param {object} speciesStats  { [statsKey]: { known, missed } }
 * @returns {'new'|'good'|'missed'}
 */
export function statusOf(card, speciesStats = {}) {
  const s = speciesStats[statsKey(card)];
  const known = (s && s.known) || 0;
  const missed = (s && s.missed) || 0;
  if (known + missed === 0) return 'new';
  return known > missed ? 'good' : 'missed';
}

/**
 * Filter + sort cards for the Lexicon table.
 *
 * @param {Array} cards
 * @param {object} opts
 *   - query:  case-insensitive substring match on common + scientific name
 *   - status: 'good' | 'missed' | 'new' | null  knowledge-status filter
 *   - speciesStats: per-species tallies (needed when `status` is set)
 *   - flagged: when true, keep only species whose taxon id is in `flags`
 *   - flags:   a Set (or array) of flagged taxon ids (strings)
 * @returns {Array} filtered cards sorted by display name (A→Z)
 */
export function filterCards(cards, opts = {}) {
  const { query = '', status = null, speciesStats = {}, flagged = false, flags = null } = opts;
  const q = query.trim().toLowerCase();
  const flagSet = flags instanceof Set ? flags : new Set(flags || []);

  let out = uniqueByTaxon(cards);

  if (q) {
    out = out.filter((c) => {
      const common = (c.common || '').toLowerCase();
      const sci = (c.scientific || '').toLowerCase();
      return common.includes(q) || sci.includes(q);
    });
  }

  if (status) {
    out = out.filter((c) => statusOf(c, speciesStats) === status);
  }

  if (flagged) {
    out = out.filter((c) => flagSet.has(String(c.taxonId)));
  }

  return out.slice().sort((a, b) =>
    displayName(a).localeCompare(displayName(b), undefined, {
      sensitivity: 'base',
    })
  );
}

// Counts per status across the whole deck — for the filter chip labels.
export function statusCounts(cards, speciesStats = {}) {
  const counts = { good: 0, missed: 0, new: 0 };
  for (const c of uniqueByTaxon(cards)) {
    counts[statusOf(c, speciesStats)] += 1;
  }
  return counts;
}
