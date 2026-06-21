// Shared game constants.

// Default iNaturalist account loaded on a fresh install, so people without their
// own account can play right away. 'loarie' (an iNaturalist co-founder) has a
// large, well-identified set of public observations. Users can change this to
// their own username in Settings.
export const DEFAULT_USERNAME = 'loarie';

// Speedrun ends after this many missed cards.
export const SPEEDRUN_LIVES = 3;

// Speedrun: how long each photo is shown before the choices appear automatically
// (timer starts once the photo has finished loading). A pie-countdown in the
// corner visualises it.
export const SPEEDRUN_VIEW_MS = 3000;

// --- Support / donations ---------------------------------------------------
// Ko-fi "Buy me a coffee" donation page.
export const KOFI_URL = 'https://ko-fi.com/goteapp';

// App Store "write a review" deep link. Empty until the app has an App Store id;
// then set to:  https://apps.apple.com/app/id<APP_ID>?action=write-review
export const APP_STORE_REVIEW_URL = '';

// Chance (0–1) that the support/review popup appears on a given launch.
export const SUPPORT_PROMPT_CHANCE = 0.1;

// Languages offered for species common names. The `code` is the iNaturalist
// `locale` query param; iNat returns each taxon's preferred common name in that
// language (falling back to the scientific name when none exists). This only
// affects the names on the cards — the app's own UI stays in English.
//
// This mirrors the locales iNaturalist itself offers. `name` is the English
// name (used for search), `native` the endonym (shown in the picker).
export const LANGUAGES = [
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans' },
  { code: 'sq', name: 'Albanian', native: 'Shqip' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'eu', name: 'Basque', native: 'Euskara' },
  { code: 'br', name: 'Breton', native: 'Brezhoneg' },
  { code: 'bg', name: 'Bulgarian', native: 'Български' },
  { code: 'ca', name: 'Catalan', native: 'Català' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', native: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', native: '繁體中文' },
  { code: 'hr', name: 'Croatian', native: 'Hrvatski' },
  { code: 'cs', name: 'Czech', native: 'Čeština' },
  { code: 'da', name: 'Danish', native: 'Dansk' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'en-GB', name: 'English (UK)', native: 'English (UK)' },
  { code: 'eo', name: 'Esperanto', native: 'Esperanto' },
  { code: 'et', name: 'Estonian', native: 'Eesti' },
  { code: 'fi', name: 'Finnish', native: 'Suomi' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'fr-CA', name: 'French (Canada)', native: 'Français (Canada)' },
  { code: 'gl', name: 'Galician', native: 'Galego' },
  { code: 'ka', name: 'Georgian', native: 'ქართული' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'el', name: 'Greek', native: 'Ελληνικά' },
  { code: 'he', name: 'Hebrew', native: 'עברית' },
  { code: 'hu', name: 'Hungarian', native: 'Magyar' },
  { code: 'is', name: 'Icelandic', native: 'Íslenska' },
  { code: 'id', name: 'Indonesian', native: 'Bahasa Indonesia' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'lv', name: 'Latvian', native: 'Latviešu' },
  { code: 'lt', name: 'Lithuanian', native: 'Lietuvių' },
  { code: 'lb', name: 'Luxembourgish', native: 'Lëtzebuergesch' },
  { code: 'mk', name: 'Macedonian', native: 'Македонски' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'nb', name: 'Norwegian Bokmål', native: 'Norsk bokmål' },
  { code: 'oc', name: 'Occitan', native: 'Occitan' },
  { code: 'pl', name: 'Polish', native: 'Polski' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português (Brasil)' },
  { code: 'ro', name: 'Romanian', native: 'Română' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'sr', name: 'Serbian', native: 'Српски' },
  { code: 'sk', name: 'Slovak', native: 'Slovenčina' },
  { code: 'sl', name: 'Slovenian', native: 'Slovenščina' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'es-MX', name: 'Spanish (Mexico)', native: 'Español (México)' },
  { code: 'sv', name: 'Swedish', native: 'Svenska' },
  { code: 'th', name: 'Thai', native: 'ไทย' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
  { code: 'uk', name: 'Ukrainian', native: 'Українська' },
  { code: 'vi', name: 'Vietnamese', native: 'Tiếng Việt' },
];

export const DEFAULT_LOCALE = 'en';

// Find a language entry by code (falls back to English).
export function languageByCode(code) {
  return LANGUAGES.find((l) => l.code === code) || LANGUAGES.find((l) => l.code === 'en');
}
