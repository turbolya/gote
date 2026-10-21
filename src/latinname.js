// The optional Latin-name line under a common name in the game modes.
//
// Pure (no React), so scripts/test-latinname.js can check every case in node.
//
// One rule, in one place: when the setting is on, the scientific name is shown
// under the common name wherever a species is named in a game. It is NOT shown
// when there is nothing to put under — a card with no common name already shows
// its scientific name AS the name, and printing it twice is noise — nor when the
// two strings are the same.

/**
 * @param {object} o
 * @param {boolean} o.show        the "Show Latin names" setting
 * @param {string}  o.common      the common name, if any
 * @param {string}  o.scientific  the scientific (Latin) name
 * @returns {string|null} the line to show under the name, or null for none
 */
export function latinLine({ show = false, common = null, scientific = null } = {}) {
  if (!show || !common || !scientific) return null;
  const c = String(common).trim();
  const s = String(scientific).trim();
  if (!c || !s || c.toLowerCase() === s.toLowerCase()) return null;
  return s;
}
