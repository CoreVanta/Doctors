import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, Calendar, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const Home = () => {
    const { t } = useTranslation();
    const services = [
        { name: t('home.services.gen_con'), price: '$50', description: t('home.services.gen_con_desc') },
        { name: t('home.services.follow_up'), price: '$30', description: t('home.services.follow_up_desc') },
        { name: t('home.services.special'), price: t('home.from') + ' $100', description: t('home.services.special_desc') },
        { name: t('home.services.renewal'), price: '$20', description: t('home.services.renewal_desc') },
    ];

    return (
        <div className="flex flex-col min-h-screen">
            {/* Navbar */}
            <nav className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <Activity className="text-medical-600 w-8 h-8" />
                    <span className="text-xl font-bold text-slate-900 tracking-tight">MedicoQueue</span>
                </div>
                <div className="flex items-center gap-6">
                    <Link to="/live-queue" className="text-slate-600 hover:text-medical-600 font-medium">{t('nav.live_queue')}</Link>
                    <LanguageSwitcher />
                    <Link to="/booking" className="btn-primary">{t('nav.book_now')}</Link>
                </div>
            </nav>

            <main className="flex-grow">
                {/* Hero Section */}
                <section className="bg-gradient-to-b from-medical-50 to-white py-20 px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-4xl mx-auto"
                    >
                        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 leading-tight">
                            {t('home.hero_title')} <br />
                            <span className="text-medical-600">{t('home.hero_subtitle')}</span>
                        </h1>
                        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
                            {t('home.hero_desc')}
                        </p>
                        <div className="flex justify-center gap-4">
                            <Link to="/booking" className="btn-primary text-lg px-8 py-3 flex items-center gap-2">
                                {t('home.start_booking')} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                            </Link>
                            <Link to="/live-queue" className="btn-secondary text-lg px-8 py-3">
                                {t('home.view_live_queue')}
                            </Link>
                        </div>
                    </motion.div>
                </section>

                {/* Pricing Table Section */}
                <section className="py-20 px-6 max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">{t('home.our_services')}</h2>
                        <p className="text-slate-600">{t('home.pricing_desc')}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {services.map((service, index) => (
                            <motion.div
                                key={index}
                                whileHover={{ y: -5 }}
                                className="medical-card flex flex-col justify-between"
                            >
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">{service.name}</h3>
                                    <p className="text-slate-600 text-sm mb-4">{service.description}</p>
                                </div>
                                <div className="mt-4">
                                    <span className="text-2xl font-bold text-medical-600">{service.price}</span>
                                    <button className="w-full mt-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-700 font-medium">
                                        {t('home.details')}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>
            </main>

            <footer className="bg-slate-900 text-white py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2 text-white">
                        <Activity className="text-medical-400 w-8 h-8" />
                        <span className="text-xl font-bold">MedicoQueue</span>
                    </div>
                    <div className="text-slate-400 text-sm">
                        {t('home.footer_copy')}
                    </div>
                    <div className="flex gap-6">
                        <Link to="/login" className="text-slate-400 hover:text-white transition-colors">{t('nav.doctor_portal')}</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;
