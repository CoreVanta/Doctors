import React from 'react';
import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    const toggleLanguage = () => {
        const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
        i18n.changeLanguage(nextLang);
        document.documentElement.dir = nextLang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = nextLang;

        // Force a small delay to ensure CSS transitions if any
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-bold text-xs border border-slate-200"
            title={i18n.language === 'ar' ? 'Switch to English' : 'تحويل للعربية'}
        >
            <Languages className="w-4 h-4 text-medical-600" />
            <span>{i18n.language === 'ar' ? 'English' : 'عربي'}</span>
        </button>
    );
};

export default LanguageSwitcher;
