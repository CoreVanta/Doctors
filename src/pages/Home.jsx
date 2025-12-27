import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Calendar, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const Home = () => {
    const { t, i18n } = useTranslation();
    const [doctorProfile, setDoctorProfile] = useState({
        name: 'Dr. Ahmed Hassan',
        specialty: 'General Practitioner',
        bio: 'Experienced physician dedicated to providing quality healthcare.',
        photoUrl: ''
    });
    const [services, setServices] = useState([
        { id: '1', nameEn: 'General Consultation', nameAr: 'استشارة عامة', price: '$50', descEn: 'Comprehensive health check and prescription.', descAr: 'فحص صحي شامل ووصفة طبية.' },
        { id: '2', nameEn: 'Follow-up Visit', nameAr: 'زيارة متابعة', price: '$30', descEn: 'Review of previous conditions and treatment progress.', descAr: 'مراجعة الحالات السابقة والتقدم في العلاج.' },
        { id: '3', nameEn: 'Special Procedures', nameAr: 'إجراءات خاصة', price: 'From $100', descEn: 'Minor surgical procedures and specialized tests.', descAr: 'عمليات جراحية صغرى واختبارات متخصصة.' },
        { id: '4', nameEn: 'Prescription Renewal', nameAr: 'تجديد الوصفة', price: '$20', descEn: 'Quick renewal of ongoing medications.', descAr: 'تجديد سريع للأدوية المستمرة.' }
    ]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Use getDoc instead of onSnapshot for better performance (data doesn't change often)
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, 'settings', 'clinic_settings');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.doctorProfile) {
                        setDoctorProfile(data.doctorProfile);
                    }
                    if (data.services && data.services.length > 0) {
                        setServices(data.services);
                    }
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

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
                        {/* Doctor Profile Image */}
                        <div className="mb-8 flex justify-center">
                            <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-medical-500 shadow-2xl">
                                <img
                                    src={doctorProfile.photoUrl || '/doctor-default.png'}
                                    alt={doctorProfile.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-4 leading-tight">
                            {doctorProfile.name}
                        </h1>
                        <p className="text-2xl text-medical-600 font-semibold mb-6">
                            {doctorProfile.specialty}
                        </p>
                        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
                            {doctorProfile.bio}
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
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${services.length > 2 ? 'lg:grid-cols-4' : services.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
                        {services.map((service) => (
                            <motion.div
                                key={service.id}
                                whileHover={{ y: -5 }}
                                className="medical-card flex flex-col justify-between"
                            >
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                                        {i18n.language === 'ar' ? service.nameAr : service.nameEn}
                                    </h3>
                                    <p className="text-slate-600 text-sm mb-4">
                                        {i18n.language === 'ar' ? service.descAr : service.descEn}
                                    </p>
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
                        <Link to="/privacy-policy" className="text-slate-400 hover:text-white transition-colors">
                            {t('privacy_policy.title')}
                        </Link>
                        <Link to="/terms-of-use" className="text-slate-400 hover:text-white transition-colors">
                            {t('terms_of_use.title')}
                        </Link>
                        <Link to="/login" className="text-slate-400 hover:text-white transition-colors">{t('nav.doctor_portal')}</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;
