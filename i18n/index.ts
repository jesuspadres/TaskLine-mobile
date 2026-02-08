import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import en from './en.json';
import es from './es.json';

const i18n = new I18n({ en, es });

// Detect device locale and use language code (e.g. 'en', 'es')
const deviceLocale = getLocales()[0]?.languageCode ?? 'en';
i18n.locale = deviceLocale;

// Default to English when a translation is missing
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

export default i18n;
