// Other names for a species, for the typing question.
//
// iNaturalist stores many names per species, each tagged with a language:
// Alcedo atthis is "Common Kingfisher", "Eurasian Kingfisher" and "River
// Kingfisher" in English, and the API hands back only the first of them as the
// species' `preferred_common_name`. gote shows that one on the card — and used to
// accept only it when TYPED, so "River Kingfisher" was marked wrong for a bird
// iNaturalist itself calls that.
//
// Pure (no React Native, no network) so scripts/test-altnames.js can run it
// against real response shapes.

// iNaturalist tags a name with the BASE language ('pt', 'zh', 'ja'), while the
// app's locale can carry a region ('pt-BR', 'en-GB', 'zh-CN').
const baseLanguage = (locale) => String(locale || '').split(/[-_]/)[0].toLowerCase();

/**
 * The names a player could reasonably type for a taxon, from the `names` array
 * of GET /v1/taxa?id=…&all_names=true.
 *
 * Keeps names that are
 *   • in the language the player studies in (so a French-speaking deck does not
 *     start accepting the English names it never shows),
 *   • not marked invalid (iNaturalist flags retired and misapplied names),
 *   • not a scientific name — the matcher already takes those from the card.
 *
 * @param {Array<{name:string, locale?:string, lexicon?:string, is_valid?:boolean}>} names
 * @param {string} locale  the app's species-name language
 * @returns {string[]} distinct names, first-listed first
 */
export function alternateNamesFrom(names, locale) {
  if (!Array.isArray(names)) return [];
  const lang = baseLanguage(locale);
  if (!lang) return [];
  const seen = new Set();
  const out = [];
  for (const n of names) {
    if (!n || typeof n.name !== 'string') continue;
    if (n.is_valid === false) continue;
    if (n.locale === 'sci' || /scientific/i.test(n.lexicon || '')) continue;
    if (baseLanguage(n.locale) !== lang) continue;
    const name = n.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}
