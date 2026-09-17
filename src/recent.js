// Which observations the menu's film strip shows. Pure, so
// scripts/test-recent.js can exercise it in plain node.
//
// "The latest five" sounds like a slice and is not quite one. Three things have
// to hold before a card can be a thumbnail, and each of them is a state the
// deck really reaches:
//
//   • it needs a photo — the strip is nothing but photos, and a card with no
//     image would be a grey hole in the middle of the row;
//   • it needs a date to be "latest" BY — iNaturalist's observed_on is optional
//     and plenty of observations have none;
//   • and the deck's order cannot simply be trusted. It arrives sorted newest
//     first (api.mergeCards), and every filter downstream preserves that, but
//     the strip would be quietly wrong rather than visibly broken if that ever
//     changed — so it sorts for itself.
//
// Cards WITHOUT a date are kept, ranked last. They are still observations; they
// just cannot claim to be the newest. Dropping them would empty the strip for
// anyone whose recent sightings happen to be undated.

// iNat's observed_on is a plain YYYY-MM-DD string, which sorts correctly as
// text — no Date parsing, and no timezone to get wrong.
const dateOf = (c) => (c && typeof c.observedOn === 'string' ? c.observedOn : '');

export function recentCards(cards, n = 5) {
  const usable = (Array.isArray(cards) ? cards : []).filter(
    (c) => c && c.taxonId != null && typeof c.image === 'string' && c.image.length > 0
  );
  // Stable sort (guaranteed since ES2019), so cards sharing a date — or sharing
  // the lack of one — keep the order the deck already put them in.
  const sorted = usable.slice().sort((a, b) => {
    const da = dateOf(a);
    const db = dateOf(b);
    if (da === db) return 0;
    if (!da) return 1; // undated sinks
    if (!db) return -1;
    return da < db ? 1 : -1; // newest first
  });
  const take = Math.max(0, Math.floor(Number(n) || 0));
  return sorted.slice(0, take);
}
