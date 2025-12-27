import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en.json';
import arTranslation from './locales/ar.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: enTranslation },
            ar: { translation: arTranslation }
        },
        fallbackLng: 'ar', // Default to Arabic as requested/standard for this project
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        }
    });

// Handle initial direction
const initialLang = i18n.language || 'ar';
document.documentElement.dir = initialLang.startsWith('ar') ? 'rtl' : 'ltr';
document.documentElement.lang = initialLang;

export default i18n;
