import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, onSnapshot, serverTimestamp, doc } from 'firebase/firestore';
import { Calendar, User, Phone, Clock, CheckCircle2, ShieldCheck, MapPin, PhoneCall, Info, Clipboard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMinutes } from 'date-fns';
import { enUS, arSA } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';

const Booking = () => {
    const { t, i18n } = useTranslation();
    const currentLocale = i18n.language === 'ar' ? arSA : enUS;
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ name: '', phone: '', date: format(new Date(), 'yyyy-MM-dd') });
    const [loading, setLoading] = useState(false);
    const [bookingConfirmed, setBookingConfirmed] = useState(null);
    const [settings, setSettings] = useState({
        intervalMinutes: 10,
        dailyLimit: 20,
        dailySchedules: {
            'Monday': { isOpen: true, startTime: '09:00', endTime: '17:00' },
            'Tuesday': { isOpen: true, startTime: '09:00', endTime: '17:00' },
            'Wednesday': { isOpen: true, startTime: '09:00', endTime: '17:00' },
            'Thursday': { isOpen: true, startTime: '09:00', endTime: '17:00' },
            'Friday': { isOpen: false, startTime: '09:00', endTime: '17:00' },
            'Saturday': { isOpen: false, startTime: '09:00', endTime: '17:00' },
            'Sunday': { isOpen: true, startTime: '09:00', endTime: '17:00' }
        },
        clinicAddress: 'Clinic Address Here',
        clinicPhone: '+20 123 456 789',
        mapIframeUrl: ''
    });

    const formatTime = (timeStr) => {
        if (!timeStr) return '---';
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? (i18n.language === 'ar' ? 'م' : 'PM') : (i18n.language === 'ar' ? 'ص' : 'AM');
        const displayH = h % 12 || 12;
        return i18n.language === 'ar' ? `${displayH}:${minutes} ${ampm}` : `${displayH}:${minutes} ${ampm}`;
    };
    const [stats, setStats] = useState({ totalBooked: 0, estimatedWait: 0 });

    useEffect(() => {
        // Fetch Settings
        const fetchSettings = async () => {
            const docRef = doc(db, 'settings', 'clinic_settings');
            const docSnap = await getDocs(query(collection(db, 'settings'), where('id', '==', 'clinic_settings')));
            // Direct doc fetch for simplicity
            onSnapshot(doc(db, 'settings', 'clinic_settings'), (snapshot) => {
                if (snapshot.exists()) {
                    setSettings(prev => ({ ...prev, ...snapshot.data() }));
                }
            });
        };
        fetchSettings();

        // Fetch current bookings for the selected date to show stats
        const q = query(collection(db, 'bookings'), where('date', '==', formData.date));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setStats({
                totalBooked: snapshot.size,
                estimatedWait: snapshot.size * (settings.intervalMinutes || 15)
            });
        });
        return () => unsubscribe();
    }, [formData.date, settings.intervalMinutes]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log("Submit button clicked. Form data:", formData);
        setLoading(true);

        let isDone = false;

        // Timeout to prevent infinite "Processing"
        setTimeout(() => {
            if (!isDone) {
                console.warn("Firestore submission is taking too long (15s timeout reached)");
                setLoading(false);
                alert(t('booking.validation.timeout'));
            }
        }, 15000);

        try {
            // Get day name and schedule for the selected date
            const selectedDate = new Date(formData.date + 'T00:00:00');
            const dayName = format(selectedDate, 'EEEE'); // e.g., "Monday"
            const schedule = settings.dailySchedules?.[dayName];

            // Validate Day Schedule
            if (schedule && !schedule.isOpen) {
                alert(t('booking.validation.closed_day', { day: t(`days.${dayName.toLowerCase()}`) }));
                setLoading(false);
                return;
            }

            // Validate Capacity
            if (stats.totalBooked >= settings.dailyLimit) {
                alert(t('booking.validation.capacity'));
                setLoading(false);
                return;
            }

            console.log("Current stats for queue calculation:", stats);
            const nextQueueNumber = (stats.totalBooked || 0) + 1;

            // Calculate Dynamic Estimated Time
            const dailyStart = schedule?.startTime || '09:00';
            let baseTime = new Date(`${formData.date}T${dailyStart}`);
            const now = new Date();

            if (formData.date === format(now, 'yyyy-MM-dd') && now > baseTime) {
                baseTime = now;
            }
            const estimatedTime24 = format(addMinutes(baseTime, stats.totalBooked * settings.intervalMinutes), 'HH:mm');
            const dailyEnd = schedule?.endTime || '17:00';

            // Check if estimated time exceeds clinic hours
            if (estimatedTime24 > dailyEnd) {
                alert(t('booking.validation.hours_exceeded'));
                setLoading(false);
                return;
            }

            const estimatedTime = formatTime(estimatedTime24);

            const bookingData = {
                name: String(formData.name),
                phone: String(formData.phone),
                date: String(formData.date),
                queueNumber: Number(nextQueueNumber),
                status: 'pending',
                createdAt: new Date().toISOString(),
                estimatedTime: String(estimatedTime)
            };

            console.log("Attempting to write to collection 'bookings' with data:", bookingData);
            const docRef = await addDoc(collection(db, 'bookings'), bookingData);

            isDone = true;
            console.log("Success! Firestore Document ID:", docRef.id);

            // Send WhatsApp confirmation message
            try {
                const accountSid = 'AC45a599b11744179644b0417f7ee74674';
                const authToken = 'd4dff0de6991854e5ec2aa631a231153';
                const twilioNumber = 'whatsapp:+14155238886';

                // Format phone number
                const formattedPhone = formData.phone.startsWith('+')
                    ? formData.phone
                    : `+20${formData.phone.replace(/^0+/, '')}`;
                const whatsappNumber = `whatsapp:${formattedPhone}`;

                const message = `مرحباً ${bookingData.name}! تم تأكيد حجزك ليوم ${bookingData.date}. رقم دورك: #${bookingData.queueNumber}. الوقت المتوقع: ${bookingData.estimatedTime}.`;

                // Send via Twilio REST API
                const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        From: twilioNumber,
                        To: whatsappNumber,
                        Body: message
                    })
                });

                if (response.ok) {
                    console.log('WhatsApp message sent successfully!');
                } else {
                    const errorData = await response.json();
                    console.error('Twilio Error:', errorData);
                }
            } catch (whatsappError) {
                console.error('WhatsApp sending failed:', whatsappError);
                // Don't block booking if WhatsApp fails
            }

            setBookingConfirmed({ id: docRef.id, ...bookingData });
        } catch (error) {
            isDone = true;
            console.error("FIRESTORE ERROR DETECTED:", error);
            console.error("Error Code:", error.code);
            console.error("Error Message:", error.message);
            alert(t('booking.validation.db_error') + ": " + error.message);
        } finally {
            setLoading(false);
            console.log("handleSubmit execution completed.");
        }
    };

    if (bookingConfirmed) {
        return (
            <div className="min-h-screen bg-medical-50 flex items-center justify-center px-6">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="medical-card max-w-md w-full text-center py-10"
                >
                    <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('booking.success.title')}</h2>
                    <p className="text-slate-600 mb-8">{t('booking.success.desc')}</p>

                    <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left rtl:text-right space-y-4">
                        <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">{t('booking.success.queue_number')}</span>
                            <span className="font-bold text-medical-600 text-xl">#{bookingConfirmed.queueNumber}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">{t('booking.success.wait_time')}</span>
                            <span className="font-semibold">{bookingConfirmed.estimatedTime}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">{t('labels.preferred_date')}</span>
                            <span className="font-semibold">{bookingConfirmed.date}</span>
                        </div>
                    </div>

                    <p className="text-sm text-slate-500 mb-8 italic">
                        {t('booking.success.time_desc')}
                    </p>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full btn-primary"
                    >
                        {t('booking.success.back_home')}
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-12 px-6 bg-slate-50/50">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex justify-end mb-8">
                    <LanguageSwitcher />
                </div>
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">{t('booking.title')}</h1>
                    <p className="text-slate-500 text-lg">{t('booking.subtitle')}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                    {/* Main Form Section - Left Side on Desktop */}
                    <div className="lg:col-span-12 xl:col-span-8 order-2 xl:order-1">
                        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 md:p-12 border border-slate-100">
                            <h2 className="text-2xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                                <div className="bg-medical-100 p-2 rounded-xl">
                                    <Clipboard className="w-6 h-6 text-medical-600" />
                                </div>
                                {t('booking.patient_info')}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <label htmlFor="fullName" className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                                            {t('labels.full_name')}
                                        </label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-medical-500 transition-colors w-5 h-5 rtl:right-4 rtl:left-auto" />
                                            <input
                                                id="fullName"
                                                name="name"
                                                type="text"
                                                required
                                                className="w-full pl-12 pr-4 rtl:pr-12 rtl:pl-4 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none bg-slate-50/50 focus:bg-white text-slate-800"
                                                placeholder={t('booking.placeholder_name')}
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="whatsappNumber" className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">{t('labels.whatsapp_number')}</label>
                                        <div className="relative group">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-medical-500 transition-colors w-5 h-5 rtl:right-4 rtl:left-auto" />
                                            <input
                                                id="whatsappNumber"
                                                name="phone"
                                                type="tel"
                                                required
                                                className="w-full pl-12 pr-4 rtl:pr-12 rtl:pl-4 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none bg-slate-50/50 focus:bg-white text-slate-800"
                                                placeholder={t('booking.placeholder_phone')}
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="appointmentDate" className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">{t('labels.preferred_date')}</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-medical-500 transition-colors w-5 h-5 rtl:right-4 rtl:left-auto" />
                                        <input
                                            id="appointmentDate"
                                            name="date"
                                            type="date"
                                            required
                                            min={format(new Date(), 'yyyy-MM-dd')}
                                            className="w-full pl-12 pr-4 rtl:pr-12 rtl:pl-4 py-4 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none bg-slate-50/50 focus:bg-white text-slate-800 font-medium"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        />
                                    </div>
                                    <p className="mt-3 text-xs text-slate-400 font-medium flex items-center gap-2">
                                        <Info className="w-3 h-3 text-medical-400" /> {t('booking.date_hint')}
                                    </p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-medical-600 hover:bg-medical-700 text-white py-5 rounded-2xl text-xl font-bold transition-all shadow-xl shadow-medical-200 hover:scale-[1.01] active:scale-[0.99] flex justify-center items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                            {t('booking.processing')}
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-6 h-6" /> {t('booking.submit_btn')}
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Sidebar - Right Side on Desktop */}
                    <div className="lg:col-span-12 xl:col-span-4 space-y-8 order-1 xl:order-2">

                        {/* Clinic Details Card */}
                        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100">
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-medical-600" /> {t('booking.schedule.title')}
                                </h4>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${settings.dailySchedules?.[format(new Date(formData.date), 'EEEE')]?.isOpen ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                                    {settings.dailySchedules?.[format(new Date(formData.date), 'EEEE')]?.isOpen ? t('booking.schedule.open') : t('booking.schedule.closed')}
                                </span>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{t('booking.schedule.hours')}</span>
                                    <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                                        {settings.dailySchedules?.[format(new Date(formData.date), 'EEEE')]?.isOpen
                                            ? `${formatTime(settings.dailySchedules[format(new Date(formData.date), 'EEEE')].startTime)} - ${formatTime(settings.dailySchedules[format(new Date(formData.date), 'EEEE')].endTime)}`
                                            : '---'}
                                    </span>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-slate-50">
                                    <div className="flex gap-4">
                                        <div className="bg-slate-100 p-2 rounded-xl h-fit">
                                            <MapPin className="w-4 h-4 text-medical-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="block text-[10px] text-slate-400 font-bold uppercase">{t('booking.schedule.location')}</span>
                                            <span className="text-xs font-bold text-slate-700 leading-normal block">{settings.clinicAddress}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="bg-slate-100 p-2 rounded-xl h-fit">
                                            <PhoneCall className="w-4 h-4 text-medical-600" />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="block text-[10px] text-slate-400 font-bold uppercase">{t('booking.schedule.phone')}</span>
                                            <span className="text-xs font-bold text-slate-700">{settings.clinicPhone}</span>
                                        </div>
                                    </div>
                                </div>

                                {settings.mapIframeUrl && (
                                    <div className="mt-6 rounded-2xl overflow-hidden h-48 border border-slate-100 shadow-inner group">
                                        <iframe
                                            src={settings.mapIframeUrl}
                                            width="100%"
                                            height="100%"
                                            style={{ border: 0 }}
                                            allowFullScreen=""
                                            loading="lazy"
                                            referrerPolicy="no-referrer-when-downgrade"
                                            title={t('booking.schedule.location')}
                                            className="grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500"
                                        ></iframe>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Live Status Card - Moved to Bottom (Unified row) */}
                <div className="bg-medical-600 rounded-[2.5rem] mt-16 p-8 text-white shadow-2xl shadow-medical-200 relative overflow-hidden group">
                    <div className="absolute -right-10 -top-10 w-60 h-60 bg-white/10 rounded-full blur-3xl transition-transform group-hover:scale-150 duration-700" />
                    <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-medical-400/20 rounded-full blur-2xl" />

                    <div className="relative flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left rtl:md:text-right">
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black flex items-center gap-3 justify-center md:justify-start">
                                <Clock className="w-8 h-8 text-medical-200" /> {t('booking.status.title')}
                            </h3>
                            <p className="text-medical-100 font-medium text-sm">{t('booking.status.desc')}</p>
                        </div>

                        <div className="flex flex-wrap justify-center gap-6">
                            <div className="bg-white/10 backdrop-blur-md px-8 py-5 rounded-[2rem] border border-white/20 min-w-[180px]">
                                <span className="block text-white/60 text-[10px] uppercase font-black mb-1 tracking-widest text-center">{t('booking.status.patients_today')}</span>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-3xl font-black">{stats.totalBooked}</span>
                                    <span className="text-white/60 text-[10px] font-bold uppercase">{t('booking.status.total')}</span>
                                </div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md px-8 py-5 rounded-[2rem] border border-white/20 min-w-[180px]">
                                <span className="block text-white/60 text-[10px] uppercase font-black mb-1 tracking-widest text-center">{t('booking.status.estimated_wait')}</span>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span className="text-3xl font-black">{stats.estimatedWait}</span>
                                    <span className="text-white/60 text-[10px] font-bold uppercase">{t('booking.status.minutes')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Booking;
