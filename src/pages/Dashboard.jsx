import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDocs } from 'firebase/firestore';
import {
    Users, CheckCircle2, PlayCircle, SkipForward, ArrowRight,
    ExternalLink, FileText, Clipboard, Search, Plus, Calendar,
    History, Upload, X, Eye, Settings, Clock, Save, Shield, MapPin, PhoneCall, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

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
            alert("Consultation completed and records saved permanentely.");
        } catch (err) {
            console.error("Save Notes Error:", err);
            alert("Failed to save final notes: " + err.message);
        }
    };

    const currentPatient = bookings.find(b => b.status === 'calling');
    const nextUp = bookings.find(b => b.status === 'pending');

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <div className="w-80 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="bg-medical-600 p-2 rounded-lg">
                        <Users className="text-white w-6 h-6" />
                    </div>
                    <h2 className="font-bold text-slate-900 text-lg">Daily Queue</h2>
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
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-medical-600">#{booking.queueNumber}</span>
                                <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${booking.status === 'calling' ? 'bg-orange-100 text-orange-600' :
                                    booking.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {booking.status}
                                </span>
                            </div>
                            <h4 className="font-bold text-slate-800 truncate">{booking.name}</h4>
                            <p className="text-xs text-slate-500">{booking.estimatedTime}</p>
                        </div>
                    ))}
                    {bookings.length === 0 && <p className="text-center text-slate-400 py-10 text-sm">No bookings for today.</p>}
                </div>

                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={() => auth.signOut()}
                        className="w-full py-2 text-slate-500 hover:text-red-500 text-sm font-medium"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Panel */}
            <div className="flex-grow flex flex-col overflow-hidden">
                {/* Header Control */}
                <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shadow-sm">
                    <div className="flex items-center gap-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Patient Consultation</h1>
                            <p className="text-slate-500 text-sm font-medium">{format(new Date(), 'EEEE, MMMM do')}</p>
                        </div>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-medical-50 text-medical-700 rounded-xl hover:bg-medical-100 transition-all border border-medical-100 font-bold text-sm"
                        >
                            <Settings className="w-4 h-4" />
                            <span>Clinic Settings</span>
                        </button>
                    </div>

                    <div className="flex gap-3">
                        {nextUp && (
                            <button
                                onClick={() => updateStatus(nextUp.id, 'calling')}
                                className="btn-primary flex items-center gap-2"
                            >
                                <PlayCircle className="w-5 h-5" /> Call Next Patient (#{nextUp.queueNumber})
                            </button>
                        )}
                        {currentPatient && (
                            <button
                                onClick={() => updateStatus(currentPatient.id, 'completed')}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <CheckCircle2 className="w-5 h-5" /> Mark Completed
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
                            className="max-w-4xl mx-auto space-y-8"
                        >
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-3xl font-bold text-slate-900">{selectedPatient.name}</h2>
                                    <p className="text-slate-500 flex items-center gap-2 mt-1">
                                        <Clipboard className="w-4 h-4" /> Queue #{selectedPatient.queueNumber} • {selectedPatient.phone}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-slate-400 uppercase font-bold tracking-widest">Booking Time</span>
                                    <p className="text-lg font-bold text-slate-700">{selectedPatient.estimatedTime}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <label htmlFor="clinicalNotes" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Clinical Notes</label>
                                        <textarea
                                            id="clinicalNotes"
                                            name="clinicalNotes"
                                            rows={10}
                                            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-500 transition-all outline-none resize-none bg-white"
                                            placeholder="Enter examination details, diagnosis, and treatment plan..."
                                            value={clinicalNotes}
                                            onChange={(e) => setClinicalNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Patient Records (Drive / Upload)</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-grow">
                                                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                                <input
                                                    id="driveLink"
                                                    name="driveLink"
                                                    type="url"
                                                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-500 transition-all outline-none"
                                                    placeholder="Drive Link or Auto-upload"
                                                    value={driveLink}
                                                    onChange={(e) => setDriveLink(e.target.value)}
                                                />
                                            </div>
                                            <label className={`cursor-pointer flex items-center justify-center px-4 rounded-xl border-2 border-dashed border-medical-200 hover:bg-medical-50 transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                                <Upload className="w-5 h-5 text-medical-600" />
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={handleFileUpload}
                                                    accept="image/*,.pdf"
                                                />
                                            </label>
                                        </div>
                                        {isUploading && <p className="text-[10px] text-medical-600 mt-1 animate-pulse font-bold">Uploading to Drive...</p>}

                                        {/* Embedded Preview */}
                                        {driveLink && (
                                            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden min-h-[200px] bg-slate-100 relative group flex items-center justify-center">
                                                {driveLink.includes('drive.google.com') ? (
                                                    <div className="w-full">
                                                        <img
                                                            src={formatDrivePreview(driveLink)}
                                                            className="max-h-[400px] w-auto object-contain mx-auto"
                                                            alt="Patient Record Preview"
                                                            onError={(e) => {
                                                                // If thumbnail fails (e.g. PDF), show a 'View Document' button instead of automatic iframe
                                                                e.target.style.display = 'none';
                                                                e.target.parentElement.innerHTML = `
                                                                    <div class="p-12 text-center">
                                                                        <div class="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                                                                            <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                                                                        </div>
                                                                        <p class="text-xs text-slate-500 font-bold mb-4">PDF Document Detected</p>
                                                                        <a href="${driveLink}" target="_blank" rel="noopener noreferrer" class="btn-primary py-2 px-6 text-xs inline-block">Open PDF in New Tab</a>
                                                                    </div>
                                                                `;
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-slate-400">Preview not available for this link type</p>
                                                )}
                                                <div className="absolute inset-x-0 bottom-0 bg-slate-900/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
                                                    <span className="text-[10px] text-white font-medium">Record Preview</span>
                                                    <a href={driveLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-medical-200 font-bold hover:underline">Open Original</a>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label htmlFor="nextAppt" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Next Appointment</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                            <input
                                                id="nextAppt"
                                                name="nextAppt"
                                                type="date"
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-500 transition-all outline-none"
                                                value={nextAppointment}
                                                onChange={(e) => setNextAppointment(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-medical-50 rounded-xl p-6 border border-medical-100">
                                        <h4 className="font-bold text-medical-800 mb-2 flex items-center gap-2">
                                            <FileText className="w-5 h-5" /> Quick Actions
                                        </h4>
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => setShowHistory(true)}
                                                className="w-full text-left text-sm py-2 px-3 rounded-lg hover:bg-white transition-colors text-slate-600 border border-transparent hover:border-medical-200 flex items-center gap-2"
                                            >
                                                <History className="w-4 h-4" /> View Medical History ({patientHistory.length})
                                            </button>
                                            <button className="w-full text-left text-sm py-2 px-3 rounded-lg hover:bg-white transition-colors text-slate-600 border border-transparent hover:border-medical-200 flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Print Prescription
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200 flex justify-between items-center gap-3">
                                <button
                                    onClick={() => handleSaveDraft(true)}
                                    className="px-6 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all font-bold text-sm"
                                >
                                    Save Draft
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setSelectedPatient(null)}
                                        className="px-6 py-2 text-slate-500 font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveNotes}
                                        className="btn-primary px-8"
                                    >
                                        Save & Complete Consultation
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Clipboard className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">Select a patient from the queue to start consultation</p>
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
                                    <h3 className="text-xl font-bold text-slate-900">Medical History</h3>
                                    <p className="text-sm text-slate-500">{selectedPatient?.name}</p>
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
                                        No previous records found for this patient.
                                    </div>
                                ) : (
                                    patientHistory.map((item) => (
                                        <div key={item.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-medical-600" />
                                                    <span className="font-bold text-slate-700">{item.date}</span>
                                                </div>
                                                <span className="text-[10px] uppercase font-black bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Completed</span>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border border-slate-100 mb-3 text-sm text-slate-600 whitespace-pre-wrap relative">
                                                {item.notes || "No clinical notes provided."}
                                                {item.nextAppointment && (
                                                    <div className="mt-2 pt-2 border-t border-slate-50 flex items-center gap-2 text-medical-600 font-bold text-[10px] uppercase">
                                                        <Calendar className="w-3 h-3" /> Next Appointment: {item.nextAppointment}
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
                                                            className="inline-flex items-center gap-2 text-xs font-bold text-medical-600 hover:underline"
                                                        >
                                                            <ExternalLink className="w-3 h-3" /> Open full file
                                                        </a>
                                                        <button
                                                            onClick={() => setVisibleRecordId(visibleRecordId === item.id ? null : item.id)}
                                                            className="text-xs font-bold text-slate-500 hover:text-medical-600 flex items-center gap-1"
                                                        >
                                                            <Eye className="w-3 h-3" /> {visibleRecordId === item.id ? 'Hide Preview' : 'Show Preview'}
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
                                    <h3 className="text-xl font-bold">Clinic Settings</h3>
                                </div>
                                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-medical-700 rounded-full transition-colors">
                                    <X className="w-6 h-6 text-white" />
                                </button>
                            </div>

                            <form onSubmit={handleSaveSettings} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Patients / Hour</label>
                                        <select
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-medical-500 outline-none"
                                            value={60 / settings.intervalMinutes}
                                            onChange={(e) => setSettings({ ...settings, intervalMinutes: 60 / parseInt(e.target.value) })}
                                        >
                                            <option value="2">2 (Every 30m)</option>
                                            <option value="3">3 (Every 20m)</option>
                                            <option value="4">4 (Every 15m)</option>
                                            <option value="6">6 (Every 10m)</option>
                                            <option value="12">12 (Every 5m)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Daily Capacity</label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-medical-500 outline-none"
                                            value={settings.dailyLimit}
                                            onChange={(e) => setSettings({ ...settings, dailyLimit: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Weekly Schedule & Hours</label>
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

                                            <span className="font-bold text-slate-700 w-20">{day}</span>

                                            {schedule.isOpen ? (
                                                <div className="flex-grow flex items-center gap-2">
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
                                                    <span className="text-slate-400">to</span>
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
                                                <span className="text-slate-400 text-xs italic">Clinic Closed</span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                        <Info className="w-3 h-3" /> Clinic Public Info
                                    </label>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Clinic Address</label>
                                        <div className="relative">
                                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Street Name, Building, Floor..."
                                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm transition-all focus:ring-2 focus:ring-medical-500 outline-none"
                                                value={settings.clinicAddress}
                                                onChange={(e) => setSettings({ ...settings, clinicAddress: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Clinic Phone (Public)</label>
                                        <div className="relative">
                                            <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="+20 1xx xxx xxxx"
                                                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm transition-all focus:ring-2 focus:ring-medical-500 outline-none"
                                                value={settings.clinicPhone}
                                                onChange={(e) => setSettings({ ...settings, clinicPhone: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase flex items-center justify-between">
                                            <span>Google Maps IFrame Link</span>
                                            <a href="https://www.google.com/maps" target="_blank" rel="noreferrer" className="text-medical-600 hover:underline lowercase font-normal italic">Get Link</a>
                                        </label>
                                        <textarea
                                            placeholder='Paste the <iframe src="..."> here...'
                                            rows={2}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-xs transition-all focus:ring-2 focus:ring-medical-500 outline-none resize-none"
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
                                        <p className="text-[9px] text-slate-400 mt-1">Tip: Share {'>'} Embed a map {'>'} Copy HTML (only the URL inside src="")</p>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowSettings(false)}
                                        className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 bg-medical-600 text-white rounded-xl font-bold hover:bg-medical-700 shadow-lg shadow-medical-200 flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" /> Save Settings
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
