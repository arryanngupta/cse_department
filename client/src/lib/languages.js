// client/src/lib/languages.js
//
// The languages offered by the site's translation switcher.
//
// Codes are Google Translate widget codes, because that is what drives the
// translation (`includedLanguages` in index.html must list exactly these, or an
// option appears in the menu and does nothing when chosen).
//
// Each entry carries both the endonym — the language's name in its own script —
// and the English name. A switcher that lists only English names is unusable by
// the person who most needs it: someone who cannot read English is looking for
// "हिन्दी", not "Hindi".
//
// Deliberately no flags. A flag stands for a country, not a language: Hindi is
// not the flag of India any more than Spanish is the flag of Spain, and picking
// one flag for Arabic, Bengali or Punjabi means telling several nations their
// language belongs to someone else.

/** Language groups, in menu order. */
export const LANGUAGE_GROUPS = [
  {
    id: 'indian',
    label: 'Indian languages',
    languages: [
      { code: 'hi', endonym: 'हिन्दी', english: 'Hindi' },
      { code: 'bn', endonym: 'বাংলা', english: 'Bengali' },
      { code: 'mr', endonym: 'मराठी', english: 'Marathi' },
      { code: 'te', endonym: 'తెలుగు', english: 'Telugu' },
      { code: 'ta', endonym: 'தமிழ்', english: 'Tamil' },
      { code: 'gu', endonym: 'ગુજરાતી', english: 'Gujarati' },
      { code: 'kn', endonym: 'ಕನ್ನಡ', english: 'Kannada' },
      { code: 'ml', endonym: 'മലയാളം', english: 'Malayalam' },
      { code: 'pa', endonym: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
      { code: 'or', endonym: 'ଓଡ଼ିଆ', english: 'Odia' },
      { code: 'as', endonym: 'অসমীয়া', english: 'Assamese' },
      { code: 'ur', endonym: 'اردو', english: 'Urdu', rtl: true },
    ],
  },
  {
    id: 'international',
    label: 'International',
    languages: [
      { code: 'fr', endonym: 'Français', english: 'French' },
      { code: 'de', endonym: 'Deutsch', english: 'German' },
      { code: 'es', endonym: 'Español', english: 'Spanish' },
      { code: 'pt', endonym: 'Português', english: 'Portuguese' },
      { code: 'ru', endonym: 'Русский', english: 'Russian' },
      { code: 'ar', endonym: 'العربية', english: 'Arabic', rtl: true },
      { code: 'zh-CN', endonym: '中文', english: 'Chinese (Simplified)' },
      { code: 'ja', endonym: '日本語', english: 'Japanese' },
    ],
  },
];

/** English is the source language, so it is the reset option, not a translation. */
export const SOURCE_LANGUAGE = { code: 'en', endonym: 'English', english: 'English' };

/** Every selectable language, flattened. */
export const ALL_LANGUAGES = [
  SOURCE_LANGUAGE,
  ...LANGUAGE_GROUPS.flatMap((g) => g.languages),
];

/** Comma-separated codes for the Google Translate `includedLanguages` option. */
export const INCLUDED_LANGUAGE_CODES = ALL_LANGUAGES.map((l) => l.code).join(',');

export const findLanguage = (code) =>
  ALL_LANGUAGES.find((l) => l.code === code) || SOURCE_LANGUAGE;

/**
 * The active language, read from the cookie Google Translate sets.
 *
 * The cookie looks like `googtrans=/en/hi` (source/target) or `/en/en` when
 * translation has been reset. Reading it rather than keeping our own state
 * means the switcher shows the right language after a reload, and stays
 * correct if the user changes it through Google's own UI.
 */
export const readActiveLanguage = () => {
  try {
    const raw = document.cookie
      .split('; ')
      .find((c) => c.startsWith('googtrans='));
    if (!raw) return SOURCE_LANGUAGE.code;

    const target = decodeURIComponent(raw.split('=')[1] || '').split('/')[2];
    if (!target) return SOURCE_LANGUAGE.code;

    return ALL_LANGUAGES.some((l) => l.code === target)
      ? target
      : SOURCE_LANGUAGE.code;
  } catch {
    // Cookies blocked: assume untranslated rather than guessing.
    return SOURCE_LANGUAGE.code;
  }
};
