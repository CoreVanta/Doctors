import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDocs } from 'firebase/firestore';
import {
    Users, CheckCircle2, PlayCircle, SkipForward, ArrowRight,
    ExternalLink, FileText, Clipboard, Search, Plus, Calendar,
    History, Upload, X, Eye, Settings, Clock, Save, Shield, MapPin, PhoneCall, Info,
    Phone, FolderOpen, ChevronRight, ChevronLeft, Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { enUS, arSA } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ProfileServicesManager from '../components/ProfileServicesManager';

// REPLACE THIS with your Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyK_DSjFavVCsE0DH49qxke-NVR8Nq_nFP3saZD86VKGIQ1TDPxIF3WTmwz995Oa46tGw/exec';

// Helper for Google Drive Preview Links
const formatDrivePreview = (url, forceIframe = false) => {
    if (!url || !url.includes('drive.google.com')) return url;

    let fileId = '';
    if (url.includes('/file/d/')) {
        fileId = url.split('/file/d/')[1].split('/')[0];
    } else if (url.includes('id=')) {
        fileId = url.split('id=')[1].split('&')[0];
    }

    if (!fileId) return url;

    // Use THUMBNAIL for images (safer, avoids 403 errors in console)
    if (!forceIframe) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }

    // Use PREVIEW for others (PDFs) - this is what causes 403 if not logged in
    return `https://drive.google.com/file/d/${fileId}/preview`;
};

const Dashboard = () => {
    const { t, i18n } = useTranslation();
    const currentLocale = i18n.language === 'ar' ? arSA : enUS;
    const navigate = useNavigate();
    const [bookings, setBookings] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [clinicalNotes, setClinicalNotes] = useState('');
    const [driveLink, setDriveLink] = useState('');
    const [nextAppointment, setNextAppointment] = useState('');
    const [patientHistory, setPatientHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [visibleRecordId, setVisibleRecordId] = useState(null); // To load iframes on demand
    const [isUploading, setIsUploading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showProfileManager, setShowProfileManager] = useState(false);
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
        mapIframeUrl: '',
        doctorProfile: {
            name: 'Dr. Ahmed Hassan',
            specialty: 'General Practitioner',
            bio: 'Experienced physician dedicated to providing quality healthcare.',
            photoUrl: ''
        },
        services: [
            { id: '1', nameEn: 'General Consultation', nameAr: 'استشارة عامة', price: '$50', descEn: 'Comprehensive health check and prescription.', descAr: 'فحص صحي شامل ووصفة طبية.' },
            { id: '2', nameEn: 'Follow-up Visit', nameAr: 'زيارة متابعة', price: '$30', descEn: 'Review of previous conditions and treatment progress.', descAr: 'مراجعة الحالات السابقة والتقدم في العلاج.' },
            { id: '3', nameEn: 'Special Procedures', nameAr: 'إجراءات خاصة', price: 'From $100', descEn: 'Minor surgical procedures and specialized tests.', descAr: 'عمليات جراحية صغرى واختبارات متخصصة.' },
            { id: '4', nameEn: 'Prescription Renewal', nameAr: 'تجديد الوصفة', price: '$20', descEn: 'Quick renewal of ongoing medications.', descAr: 'تجديد سريع للأدوية المستمرة.' }
        ]
    });

    const todaysDate = format(new Date(), 'yyyy-MM-dd');

    useEffect(() => {
        // Fetch Settings
        const fetchSettings = async () => {
            const docRef = doc(db, 'settings', 'clinic_settings');
            const docSnap = await getDocs(query(collection(db, 'settings'), where('id', '==', 'clinic_settings')));
            // Using getDocs for simplicity if id is used, but ideally use direct doc()
            // Let's use direct doc
            onSnapshot(doc(db, 'settings', 'clinic_settings'), (snapshot) => {
                if (snapshot.exists()) {
                    setSettings(prev => ({ ...prev, ...snapshot.data() }));
                }
            });
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        const q = query(
            collection(db, 'bookings'),
            where('date', '==', todaysDate)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort in-memory to avoid needing a Firestore composite index
            data.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0));

            setBookings(data);
        });

        return () => unsubscribe();
    }, [todaysDate]);

    const selectPatient = async (patient) => {
        // Autosave current patient if any data changed
        const hasChanges = selectedPatient && (
            clinicalNotes !== (selectedPatient.notes || '') ||
            driveLink !== (selectedPatient.googleDriveLink || '') ||
            nextAppointment !== (selectedPatient.nextAppointment || '')
        );

        if (hasChanges) {
            await handleSaveDraft(false);
        }

        setSelectedPatient(patient);
        setClinicalNotes(patient.notes || '');
        setDriveLink(patient.googleDriveLink || '');
        setNextAppointment(patient.nextAppointment || '');
        fetchHistory(patient.phone);
    };

    const handleSaveDraft = async (showNotification = true) => {
        if (!selectedPatient) return;
        try {
            const docRef = doc(db, 'bookings', selectedPatient.id);
            await updateDoc(docRef, {
                notes: clinicalNotes,
                googleDriveLink: driveLink,
                nextAppointment: nextAppointment,
                updatedAt: Timestamp.now()
            });
            if (showNotification) alert("Draft saved successfully.");
        } catch (err) {
            console.error("Save Draft Error:", err);
            if (showNotification) alert("Save failed: " + err.message);
        }
    };

    const fetchHistory = async (phone) => {
        try {
            const q = query(
                collection(db, 'bookings'),
                where('phone', '==', phone),
                where('status', '==', 'completed')
            );
            const snapshot = await getDocs(q);
            const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort history by date AND updatedAt for precision
            history.sort((a, b) => {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                if (dateA !== dateB) return dateB - dateA;

                const timeA = a.updatedAt?.toMillis() || 0;
                const timeB = b.updatedAt?.toMillis() || 0;
                return timeB - timeA;
            });
            setPatientHistory(history);
        } catch (err) {
            console.error("Error fetching history:", err);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            await updateDoc(doc(db, 'settings', 'clinic_settings'), settings);
            alert("Clinic Settings updated successfully!");
            setShowSettings(false);
        } catch (err) {
            // If doc doesn't exist, create it
            try {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(doc(db, 'settings', 'clinic_settings'), settings);
                alert("Clinic Settings created and saved!");
                setShowSettings(false);
            } catch (innerErr) {
                console.error("Save Settings Error:", err);
                alert("Failed to save settings.");
            }
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedPatient) return;

        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes('YOUR_GOOGLE_SCRIPT')) {
            alert("Please set your Google Script URL in Dashboard.jsx first!");
            return;
        }

        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Content = reader.result.split(',')[1];

                const payload = {
                    name: file.name,
                    type: file.type,
                    base64: base64Content,
                    phone: selectedPatient.phone
                };

                // 1. Upload via POST
                console.log("Sending file to Drive bridge...");
                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: JSON.stringify(payload)
                });

                // 2. Fetch link via JSONP (Bypasses CORS for Apps Script)
                console.log("Upload sent, fetching new link via JSONP...");

                // Definition of a globally accessible callback is required for JSONP
                window.handleDriveResponse = (result) => {
                    console.log("JSONP Response received:", result);
                    if (result.status === 'success') {
                        setDriveLink(result.previewUrl);
                        alert("File uploaded and linked successfully!");
                    } else {
                        console.error("Link retrieval failed:", result);
                        alert("File uploaded but link retrieval failed. Please try again or check your Drive.");
                    }
                    setIsUploading(false);
                };

                const script = document.createElement('script');
                script.src = `${GOOGLE_SCRIPT_URL}?phone=${encodeURIComponent(selectedPatient.phone)}&callback=handleDriveResponse&t=${Date.now()}`;

                script.onerror = () => {
                    console.error("JSONP Script load error");
                    setIsUploading(false);
                    alert("Communication error with Google. Please try saving and refreshing.");
                };

                document.body.appendChild(script);
                // Clean up script tag after execution
                setTimeout(() => script.remove(), 10000);
            };
        } catch (err) {
            console.error("Upload Error:", err);
            alert("Upload failed. Check console for details.");
            setIsUploading(false);
        }
    };

    const updateStatus = async (bookingId, newStatus) => {
        try {
            const docRef = doc(db, 'bookings', bookingId);
            await updateDoc(docRef, {
                status: newStatus,
                updatedAt: Timestamp.now()
            });

            // If we're calling a patient, select them automatically
            if (newStatus === 'calling') {
                const patient = bookings.find(b => b.id === bookingId);
                selectPatient(patient);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedPatient) return;
        try {
            const docRef = doc(db, 'bookings', selectedPatient.id);
            const finalData = {
                notes: clinicalNotes,
                googleDriveLink: driveLink,
                nextAppointment: nextAppointment,
                status: 'completed',
                updatedAt: Timestamp.now()
            };

            await updateDoc(docRef, finalData);

            // Re-fetch history for the patient to ensure it's up to date
            if (selectedPatient.phone) fetchHistory(selectedPatient.phone);

            // Update local state for current bookings
            const updatedBookings = bookings.map(b =>
                b.id === selectedPatient.id ? { ...b, ...finalData } : b
            );
            setBookings(updatedBookings);

            setSelectedPatient(null);
            setClinicalNotes('');
            setDriveLink('');
            setNextAppointment('');
            alert(t('dashboard.consultation_saved'));
        } catch (err) {
            console.error("Save Notes Error:", err);
            alert("Failed to save final notes: " + err.message);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        const isRtl = i18n.language === 'ar';

        printWindow.document.write(`
            <html>
                <head>
                    <title>${t('dashboard.print_pres')} - ${selectedPatient.name}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Noto+Sans+Arabic:wght@400;700&display=swap');
                        body { 
                            font-family: 'Inter', 'Noto Sans Arabic', sans-serif; 
                            padding: 40px; 
                            line-height: 1.6; 
                            color: #1e293b;
                            direction: ${isRtl ? 'rtl' : 'ltr'};
                            text-align: ${isRtl ? 'right' : 'left'};
                        }
                        .header { border-bottom: 2px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; }
                        .clinic-name { font-size: 24px; font-weight: bold; color: #0369a1; }
                        .patient-info { margin-bottom: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; padding: 20px; rounded: 12px; }
                        .info-item { font-size: 14px; }
                        .info-label { font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px; display: block; }
                        .notes-section { white-space: pre-wrap; margin-top: 30px; font-size: 16px; min-height: 400px; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; }
                        .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; pt: 20px; font-size: 12px; color: #94a3b8; }
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="clinic-name">${settings.clinicAddress.split(',')[0] || t('dashboard.title')}</div>
                        <div style="font-size: 12px; color: #64748b;">${settings.clinicAddress} | ${settings.clinicPhone}</div>
                    </div>
                    
                    <div class="patient-info">
                        <div class="info-item">
                            <span class="info-label">${t('labels.full_name')}</span>
                            <strong>${selectedPatient.name}</strong>
                        </div>
                        <div class="info-item">
                            <span class="info-label">${t('booking.schedule.office_hours')}</span>
                            <strong>${format(new Date(), 'yyyy-MM-dd HH:mm')}</strong>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Phone</span>
                            <strong>${selectedPatient.phone}</strong>
                        </div>
                    </div>
                    
                    <div class="notes-section">
                        <h3 style="margin-top: 0; color: #0ea5e9;">${t('dashboard.notes_title')}</h3>
                        ${clinicalNotes || t('dashboard.no_notes')}
                    </div>
                    
                    <div class="footer">
                        <p>${t('dashboard.consultation_saved')}</p>
                    </div>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const currentPatient = bookings.find(b => b.status === 'calling');
    const nextUp = bookings.find(b => b.status === 'pending');

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r rtl:border-r-0 rtl:border-l border-slate-200 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3 rtl:flex-row-reverse">
                    <div className="bg-medical-600 p-2 rounded-lg">
                        <Users className="text-white w-6 h-6" />
                    </div>
                    <h2 className="font-bold text-slate-900 text-lg">{t('dashboard.sidebar.queue')}</h2>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-3">
                    {bookings.map((booking) => (
                        <div
                            key={booking.id}
                            onClick={() => selectPatient(booking)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer ${selectedPatient?.id === booking.id
                                ? 'bg-medical-50 border-medical-200 ring-2 ring-medical-100'
                                : 'bg-white border-slate-100 hover:border-medical-200'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-1 rtl:flex-row-reverse">
                                <span className="text-xs font-bold text-medical-600">#{booking.queueNumber}</span>
                                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${booking.status === 'calling' ? 'bg-orange-100 text-orange-600' :
                                    booking.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {t(`live_queue.status.${booking.status}`)}
                                </span>
                            </div>
                            <h4 className="font-bold text-slate-800 truncate rtl:text-right">{booking.name}</h4>
                            <p className="text-xs text-slate-500 rtl:text-right">{booking.estimatedTime}</p>
                        </div>
                    ))}
                    {bookings.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">{t('live_queue.empty')}</p>}
                </div>

                <div className="p-4 border-t border-slate-100 space-y-4">
                    <div className="flex justify-center">
                        <LanguageSwitcher />
                    </div>
                    <button
                        onClick={() => setShowProfileManager(true)}
                        className="w-full py-2 px-4 bg-medical-500 hover:bg-medical-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <User className="w-4 h-4" />
                        Profile & Services
                    </button>
                    <button
                        onClick={() => auth.signOut()}
                        className="w-full py-2 text-slate-500 hover:text-red-500 text-sm font-medium"
                    >
                        {t('dashboard.sidebar.logout')}
                    </button>
                </div>
            </div>

            {/* Main Panel */}
            <div className="flex-grow flex flex-col overflow-hidden">
                {/* Header Control */}
                <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
                            <p className="text-slate-500 text-sm font-medium">{format(new Date(), 'EEEE, MMMM do', { locale: currentLocale })}</p>
                        </div>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-medical-50 text-medical-700 rounded-xl hover:bg-medical-100 transition-all border border-medical-100 font-bold text-sm"
                        >
                            <Settings className="w-4 h-4" />
                            <span>{t('dashboard.settings_btn')}</span>
                        </button>
                    </div>

                    <div className="flex gap-3">
                        {nextUp && (
                            <button
                                onClick={() => updateStatus(nextUp.id, 'calling')}
                                className="btn-primary flex items-center gap-2"
                            >
                                <PlayCircle className="w-5 h-5" /> {t('dashboard.call_next')} (#{nextUp.queueNumber})
                            </button>
                        )}
                        {currentPatient && (
                            <button
                                onClick={() => updateStatus(currentPatient.id, 'completed')}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" /> {t('dashboard.mark_completed')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Workspace */}
                <div className="flex-grow p-8 overflow-y-auto">
                    {selectedPatient ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-7xl mx-auto space-y-8"
                        >
                            <div className="flex justify-between items-end bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                <div className="space-y-1 text-left rtl:text-right">
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">{selectedPatient.name}</h2>
                                    <div className="flex items-center gap-4 text-slate-500 font-medium">
                                        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs">
                                            <Clipboard className="w-3.5 h-3.5 text-medical-600" /> {t('live_queue.title').split(' ')[0]} #{selectedPatient.queueNumber}
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs">
                                            <Phone className="w-3.5 h-3.5 text-medical-600" /> {selectedPatient.phone}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right rtl:text-left bg-medical-50 border border-medical-100 p-4 rounded-2xl min-w-[150px]">
                                    <span className="text-[10px] text-medical-600 uppercase font-black tracking-widest block mb-1">{t('live_queue.scheduled_for')}</span>
                                    <p className="text-2xl font-black text-slate-900 leading-none">{selectedPatient.estimatedTime}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* Left Side - Clinical Documentation (7/12 columns) */}
                                <div className="lg:col-span-7 space-y-8">
                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm h-full">
                                        <div className="flex items-center justify-between mb-6">
                                            <label htmlFor="clinicalNotes" className="text-lg font-bold text-slate-800 flex items-center gap-3">
                                                <div className="bg-medical-100 p-2 rounded-xl">
                                                    <FileText className="w-5 h-5 text-medical-600" />
                                                </div>
                                                {t('dashboard.notes_title')}
                                            </label>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase animate-pulse flex items-center gap-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                {t('dashboard.autosave')}
                                            </div>
                                        </div>
                                        <textarea
                                            id="clinicalNotes"
                                            name="clinicalNotes"
                                            rows={18}
                                            className="w-full p-6 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none resize-none bg-slate-50/50 focus:bg-white text-slate-700 font-medium text-base leading-relaxed placeholder:text-slate-300 rtl:text-right"
                                            placeholder={t('dashboard.notes_placeholder')}
                                            value={clinicalNotes}
                                            onChange={(e) => setClinicalNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Right Side - Records & Actions (5/12 columns) */}
                                <div className="lg:col-span-5 space-y-8">
                                    {/* Records Section */}
                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                        <label className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
                                            <div className="bg-orange-100 p-2 rounded-xl">
                                                <FolderOpen className="w-5 h-5 text-orange-600" />
                                            </div>
                                            {t('dashboard.records_title')}
                                        </label>

                                        <div className="space-y-6">
                                            <div className="flex gap-3">
                                                <div className="relative flex-grow group">
                                                    <ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-medical-500 transition-colors w-5 h-5 rtl:right-4 rtl:left-auto" />
                                                    <input
                                                        id="driveLink"
                                                        name="driveLink"
                                                        type="url"
                                                        className="w-full pl-12 pr-4 rtl:pr-12 rtl:pl-4 py-4 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none bg-slate-50/50 focus:bg-white text-sm"
                                                        placeholder={t('dashboard.drive_link_placeholder')}
                                                        value={driveLink}
                                                        onChange={(e) => setDriveLink(e.target.value)}
                                                    />
                                                </div>
                                                <label className={`cursor-pointer flex items-center justify-center w-14 h-14 rounded-2xl border-2 border-dashed border-slate-200 hover:border-medical-500 hover:bg-medical-50 transition-all shrink-0 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    <Upload className="w-6 h-6 text-slate-400 hover:text-medical-600" />
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={handleFileUpload}
                                                        accept="image/*,.pdf"
                                                    />
                                                </label>
                                            </div>

                                            {isUploading && (
                                                <div className="bg-medical-50 p-4 rounded-xl border border-medical-100 flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full bg-medical-500 animate-ping" />
                                                    <span className="text-xs text-medical-600 font-bold uppercase tracking-wider">Uploading to Secure Drive...</span>
                                                </div>
                                            )}

                                            {/* Preview Card */}
                                            {driveLink ? (
                                                <div className="rounded-[1.5rem] overflow-hidden border border-slate-100 bg-slate-100 relative group aspect-video shadow-inner flex items-center justify-center">
                                                    {driveLink.includes('drive.google.com') ? (
                                                        <div className="w-full h-full flex items-center justify-center bg-slate-50">
                                                            <img
                                                                src={formatDrivePreview(driveLink)}
                                                                className="max-h-full max-w-full object-contain mx-auto transition-transform group-hover:scale-110 duration-700"
                                                                alt="Patient Record Preview"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.parentElement.innerHTML = `
                                                                        <div class="p-8 text-center bg-white w-full h-full flex flex-col items-center justify-center">
                                                                            <div class="bg-red-50 w-16 h-16 rounded-3xl flex items-center justify-center mb-4">
                                                                                <svg class="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                                            </div>
                                                                            <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-4">PDF Document Detected</p>
                                                                            <a href="${driveLink}" target="_blank" rel="noopener noreferrer" class="bg-slate-900 text-white py-3 px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">Open Record</a>
                                                                        </div>
                                                                    `;
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="p-8 text-center">
                                                            <p className="text-xs text-slate-400 font-bold">External link provided. No preview available.</p>
                                                            <a href={driveLink} target="_blank" rel="noopener noreferrer" className="mt-2 text-medical-600 hover:underline font-bold text-xs inline-block">Open Resource</a>
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
                                                        <span className="text-xs text-white font-bold uppercase tracking-wider">Record Preview</span>
                                                        <a href={driveLink} target="_blank" rel="noopener noreferrer" className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-white/30 transition-all">Original</a>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="aspect-video bg-slate-50 rounded-[1.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
                                                    <FolderOpen className="w-10 h-10 mb-2 opacity-20" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">No Records Linked</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Next Appt & Quick Actions */}
                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-8">
                                        <div>
                                            <label htmlFor="nextAppt" className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 rtl:flex-row-reverse rtl:justify-end">
                                                <Calendar className="w-4 h-4 text-medical-600" />
                                                {t('dashboard.next_app')}
                                            </label>
                                            <div className="relative">
                                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none rtl:right-4 rtl:left-auto" />
                                                <input
                                                    id="nextAppt"
                                                    name="nextAppt"
                                                    type="date"
                                                    className="w-full pl-12 pr-4 rtl:pr-12 rtl:pl-4 py-4 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500 transition-all outline-none bg-slate-50/50 focus:bg-white font-bold text-slate-700"
                                                    value={nextAppointment}
                                                    onChange={(e) => setNextAppointment(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-8 border-t border-slate-50">
                                            <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-widest rtl:text-right">{t('dashboard.quick_actions')}</h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                <button
                                                    onClick={() => setShowHistory(true)}
                                                    className="group w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-medical-600 transition-all duration-300"
                                                >
                                                    <div className="flex items-center gap-3 rtl:flex-row-reverse">
                                                        <div className="bg-white p-2 rounded-lg group-hover:bg-medical-500 text-medical-600 group-hover:text-white transition-colors">
                                                            <History className="w-5 h-5" />
                                                        </div>
                                                        <div className="text-left rtl:text-right">
                                                            <span className="block text-xs font-bold text-slate-700 group-hover:text-white">{t('dashboard.med_history')}</span>
                                                            <span className="block text-[10px] text-slate-400 group-hover:text-medical-200 uppercase font-black">{patientHistory.length} {t('dashboard.records_found')}</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-white rtl:rotate-180" />
                                                </button>

                                                <button onClick={handlePrint} className="group w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-900 transition-all duration-300">
                                                    <div className="flex items-center gap-3 rtl:flex-row-reverse">
                                                        <div className="bg-white p-2 rounded-lg group-hover:bg-slate-800 text-slate-400 group-hover:text-white transition-colors">
                                                            <Printer className="w-5 h-5" />
                                                        </div>
                                                        <div className="text-left rtl:text-right">
                                                            <span className="block text-xs font-bold text-slate-700 group-hover:text-white">{t('dashboard.print_pres')}</span>
                                                            <span className="block text-[10px] text-slate-400 group-hover:text-slate-500 uppercase font-black">{t('dashboard.print_hint')}</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-white rtl:rotate-180" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Control Bar */}
                            <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] border border-slate-100 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.05)] flex justify-between items-center z-10">
                                <button
                                    onClick={() => handleSaveDraft(true)}
                                    className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all font-black text-xs uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> {t('dashboard.save_draft')}
                                </button>
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={() => setSelectedPatient(null)}
                                        className="text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-red-500 transition-colors"
                                    >
                                        {t('dashboard.exit_session')}
                                    </button>
                                    <button
                                        onClick={handleSaveNotes}
                                        className="bg-medical-600 hover:bg-medical-700 text-white px-12 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-medical-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                                    >
                                        <CheckCircle2 className="w-5 h-5" /> {t('dashboard.complete_con')}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Clipboard className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">{t('dashboard.no_patient')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* History Modal */}
            <AnimatePresence>
                {showHistory && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 rtl:text-right">{t('dashboard.med_history')}</h3>
                                    <p className="text-sm text-slate-500 rtl:text-right">{selectedPatient?.name}</p>
                                </div>
                                <button
                                    onClick={() => setShowHistory(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                                >
                                    <X className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>

                            <div className="flex-grow overflow-y-auto p-6 space-y-6">
                                {patientHistory.length === 0 ? (
                                    <div className="text-center py-12 text-slate-400">
                                        {t('dashboard.no_history')}
                                    </div>
                                ) : (
                                    patientHistory.map((item) => (
                                        <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                                            <div className="flex justify-between items-start mb-3 rtl:flex-row-reverse">
                                                <div className="flex items-center gap-2 rtl:flex-row-reverse">
                                                    <Calendar className="w-4 h-4 text-medical-600" />
                                                    <span className="font-bold text-slate-700">{item.date}</span>
                                                </div>
                                                <span className="text-[10px] uppercase font-black bg-green-100 text-green-600 px-2 py-0.5 rounded-full">{t('live_queue.status.completed')}</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-slate-100 mb-3 text-sm text-slate-600 whitespace-pre-wrap relative rtl:text-right">
                                                {item.notes || t('dashboard.no_notes')}
                                                {item.nextAppointment && (
                                                    <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-2 text-medical-600 font-bold text-[10px] uppercase rtl:flex-row-reverse">
                                                        <Calendar className="w-3 h-3" /> {t('dashboard.next_app')}: {item.nextAppointment}
                                                    </div>
                                                )}
                                            </div>
                                            {item.googleDriveLink && (
                                                <div className="mt-3">
                                                    <div className="flex gap-4 mb-2">
                                                        <a
                                                            href={item.googleDriveLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-2 text-xs font-bold text-medical-600 hover:underline rtl:flex-row-reverse"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> {t('dashboard.open_file')}
                                                        </a>
                                                        <button
                                                            onClick={() => setVisibleRecordId(visibleRecordId === item.id ? null : item.id)}
                                                            className="text-xs font-bold text-slate-500 hover:text-medical-600 flex items-center gap-1 rtl:flex-row-reverse"
                                                        >
                                                            <Eye className="w-3 h-3" /> {visibleRecordId === item.id ? t('dashboard.hide_preview') : t('dashboard.show_preview')}
                                                        </button>
                                                    </div>

                                                    {visibleRecordId === item.id && item.googleDriveLink.includes('drive.google.com') && (
                                                        <div className="border border-slate-200 rounded-lg overflow-hidden min-h-[150px] bg-white shadow-inner flex items-center justify-center">
                                                            <img
                                                                src={formatDrivePreview(item.googleDriveLink)}
                                                                className="max-h-[300px] w-auto object-contain"
                                                                alt="History Record"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.nextSibling.style.display = 'block';
                                                                }}
                                                            />
                                                            <iframe
                                                                src={formatDrivePreview(item.googleDriveLink, true)}
                                                                className="w-full h-[300px] hidden"
                                                                title="History PDF Preview"
                                                            ></iframe>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Clinic Settings Modal */}
            <AnimatePresence>
                {showSettings && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-medical-600 text-white">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-5 h-5" />
                                    <h3 className="text-xl font-bold">{t('dashboard.settings_btn')}</h3>
                                </div>
                                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-medical-700 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-white" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveSettings} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="text-left rtl:text-right">
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">{t('dashboard.patients_hour')}</label>
                                        <select
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-medical-500 outline-none"
                                            value={60 / settings.intervalMinutes}
                                            onChange={(e) => setSettings({ ...settings, intervalMinutes: 60 / parseInt(e.target.value) })}
                                        >
                                            <option value="2">2 ({t('booking.status.minutes').split(' ')[0]} 30)</option>
                                            <option value="3">3 ({t('booking.status.minutes').split(' ')[0]} 20)</option>
                                            <option value="4">4 ({t('booking.status.minutes').split(' ')[0]} 15)</option>
                                            <option value="6">6 ({t('booking.status.minutes').split(' ')[0]} 10)</option>
                                            <option value="12">12 ({t('booking.status.minutes').split(' ')[0]} 5)</option>
                                        </select>
                                    </div>
                                    <div className="text-left rtl:text-right">
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">{t('dashboard.daily_cap')}</label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-medical-500 outline-none"
                                            value={settings.dailyLimit}
                                            onChange={(e) => setSettings({ ...settings, dailyLimit: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3 text-left rtl:text-right">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">{t('dashboard.weekly_schedule')}</label>
                                    {Object.entries(settings.dailySchedules).map(([day, schedule]) => (
                                        <div key={day} className={`p-3 rounded-xl border transition-all flex items-center gap-4 ${schedule.isOpen ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newSchedules = { ...settings.dailySchedules };
                                                    newSchedules[day].isOpen = !newSchedules[day].isOpen;
                                                    setSettings({ ...settings, dailySchedules: newSchedules });
                                                }}
                                                className={`w-12 h-6 rounded-full relative transition-colors ${schedule.isOpen ? 'bg-medical-500' : 'bg-slate-300'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${schedule.isOpen ? 'right-1' : 'left-1'}`} />
                                            </button>

                                            <span className="font-bold text-slate-700 w-20 rtl:text-right">{t(`days.${day.toLowerCase()}`)}</span>

                                            {schedule.isOpen ? (
                                                <div className="flex-grow flex items-center gap-2 rtl:flex-row-reverse">
                                                    <input
                                                        type="time"
                                                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs outline-none"
                                                        value={schedule.startTime}
                                                        onChange={(e) => {
                                                            const newSchedules = { ...settings.dailySchedules };
                                                            newSchedules[day].startTime = e.target.value;
                                                            setSettings({ ...settings, dailySchedules: newSchedules });
                                                        }}
                                                    />
                                                    <span className="text-slate-400">{t('dashboard.to')}</span>
                                                    <input
                                                        type="time"
                                                        className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs outline-none"
                                                        value={schedule.endTime}
                                                        onChange={(e) => {
                                                            const newSchedules = { ...settings.dailySchedules };
                                                            newSchedules[day].endTime = e.target.value;
                                                            setSettings({ ...settings, dailySchedules: newSchedules });
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">{t('booking.schedule.closed')}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-100 text-left rtl:text-right">
                                    <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-2 rtl:flex-row-reverse rtl:justify-end">
                                        <Info className="w-3 h-3" /> {t('dashboard.clinic_info')}
                                    </label>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">{t('booking.schedule.location')}</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rtl:right-3 rtl:left-auto" />
                                            <input
                                                type="text"
                                                placeholder="Street Name, Building, Floor..."
                                                className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2 border border-slate-200 rounded-lg text-sm transition-all focus:ring-2 focus:ring-medical-500 outline-none"
                                                value={settings.clinicAddress}
                                                onChange={(e) => setSettings({ ...settings, clinicAddress: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">{t('booking.schedule.phone')}</label>
                                        <div className="relative">
                                            <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rtl:right-3 rtl:left-auto" />
                                            <input
                                                type="text"
                                                placeholder="+20 1xx xxx xxxx"
                                                className="w-full pl-10 pr-4 rtl:pr-10 rtl:pl-4 py-2 border border-slate-200 rounded-lg text-sm transition-all focus:ring-2 focus:ring-medical-500 outline-none"
                                                value={settings.clinicPhone}
                                                onChange={(e) => setSettings({ ...settings, clinicPhone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="text-left rtl:text-right">
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase flex items-center justify-between rtl:flex-row-reverse">
                                            <span>{t('dashboard.map_link')}</span>
                                            <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="text-medical-600 hover:underline lowercase font-normal italic">{t('dashboard.get_link')}</a>
                                        </label>
                                        <textarea
                                            placeholder={t('dashboard.map_placeholder')}
                                            rows={2}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs transition-all focus:ring-2 focus:ring-medical-500 outline-none resize-none rtl:text-right"
                                            value={settings.mapIframeUrl}
                                            onChange={(e) => {
                                                // Minimal extraction if they paste the whole iframe tag
                                                let val = e.target.value;
                                                if (val.includes('src="')) {
                                                    val = val.split('src="')[1].split('"')[0];
                                                }
                                                setSettings({ ...settings, mapIframeUrl: val });
                                            }}
                                        />
                                        <p className="text-[9px] text-slate-400 mt-1">{t('dashboard.map_hint')}</p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex gap-3 rtl:flex-row-reverse">
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(false)}
                                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                                    >
                                        {t('labels.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-medical-600 text-white rounded-xl font-bold hover:bg-medical-700 shadow-lg shadow-medical-200 flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> {t('labels.save')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Profile & Services Manager Modal */}
            {showProfileManager && (
                <ProfileServicesManager
                    settings={settings}
                    setSettings={setSettings}
                    onClose={() => setShowProfileManager(false)}
                />
            )}
        </div>
    );
};

export default Dashboard;
