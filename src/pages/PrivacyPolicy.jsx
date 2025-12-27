import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../components/LanguageSwitcher';

const PrivacyPolicy = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const isRtl = i18n.language === 'ar';

    const sections = [
        { title: t('privacy_policy.data_collection'), desc: t('privacy_policy.data_collection_desc') },
        { title: t('privacy_policy.data_usage'), desc: t('privacy_policy.data_usage_desc') },
        { title: t('privacy_policy.data_protection'), desc: t('privacy_policy.data_protection_desc') },
        { title: t('privacy_policy.third_party'), desc: t('privacy_policy.third_party_desc') },
    ];

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="max-w-3xl mx-auto">
                <button
                    onClick={() => navigate(-1)}
                    className="mb-8 flex items-center gap-2 text-slate-600 hover:text-medical-600 transition-colors"
                >
                    <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                    {isRtl ? 'العودة' : 'Back'}
                </button>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-8 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-medical-100 p-3 rounded-xl">
                                <Shield className="w-6 h-6 text-medical-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">{t('privacy_policy.title')}</h1>
                                <p className="text-sm text-slate-500">{t('privacy_policy.last_updated')}</p>
                            </div>
                        </div>
                        <LanguageSwitcher />
                    </div>

                    <div className="p-8 prose prose-slate max-w-none">
                        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                            {t('privacy_policy.intro')}
                        </p>

                        <div className="space-y-8">
                            {sections.map((section, idx) => (
                                <div key={idx} className="bg-slate-50 p-6 rounded-xl border border-slate-100 transition-all hover:border-medical-200">
                                    <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-medical-500" />
                                        {section.title}
                                    </h2>
                                    <p className="text-slate-600 leading-relaxed">
                                        {section.desc}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <footer className="mt-12 text-center text-slate-400 text-sm">
                    {t('home.footer_copy')}
                </footer>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
