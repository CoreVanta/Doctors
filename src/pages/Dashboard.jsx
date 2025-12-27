import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDocs } from 'firebase/firestore';
import {
    Users, CheckCircle2, PlayCircle, SkipForward, ArrowRight,
    ExternalLink, FileText, Clipboard, Search, Plus, Calendar,
    History, Upload, X, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

// REPLACE THIS with your Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyK_DSjFavVCsE0DH49qxke-NVR8Nq_nFP3saZD86VKGIQ1TDPxIF3WTmwz995Oa46tGw/exec';

// Helper for Google Drive Preview Links
const formatDrivePreview = (url) => {
    if (!url || !url.includes('drive.google.com')) return url;
    // Handle various formats to ensure /preview
    if (url.includes('/file/d/')) {
        const fileId = url.split('/file/d/')[1].split('/')[0];
        return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    if (url.includes('id=')) {
        const fileId = url.split('id=')[1].split('&')[0];
        return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return url;
};

const Dashboard = () => {
    const [bookings, setBookings] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [clinicalNotes, setClinicalNotes] = useState('');
    const [driveLink, setDriveLink] = useState('');
    const [nextAppointment, setNextAppointment] = useState('');
    const [patientHistory, setPatientHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const todaysDate = format(new Date(), 'yyyy-MM-dd');

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
        // Autosave current patient if notes were changed
        if (selectedPatient && clinicalNotes !== (selectedPatient.notes || '')) {
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
            // Sort history by date descending
            history.sort((a, b) => new Date(b.date) - new Date(a.date));
            setPatientHistory(history);
        } catch (err) {
            console.error("Error fetching history:", err);
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

            // Update local state to reflect changes in history immediately next time
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
                <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Patient Consultation</h1>
                        <p className="text-slate-500 text-sm">{format(new Date(), 'EEEE, MMMM do')}</p>
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
                                        {driveLink && driveLink.includes('drive.google.com') && (
                                            <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden aspect-video bg-slate-100 relative group">
                                                <iframe
                                                    src={formatDrivePreview(driveLink)}
                                                    className="w-full h-full"
                                                    title="Drive Preview"
                                                    allow="autoplay"
                                                ></iframe>
                                                <div className="absolute inset-x-0 bottom-0 bg-slate-900/60 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
                                                    <span className="text-[10px] text-white">Live Preview from Drive</span>
                                                    <a href={driveLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-medical-200 font-bold hover:underline">Open Full Tab</a>
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
                                            <div className="bg-white p-3 rounded-lg border border-slate-100 mb-3 text-sm text-slate-600 whitespace-pre-wrap">
                                                {item.notes || "No clinical notes provided."}
                                            </div>
                                            {item.googleDriveLink && (
                                                <div className="mt-3">
                                                    <a
                                                        href={item.googleDriveLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 text-xs font-bold text-medical-600 hover:underline mb-2"
                                                    >
                                                        <ExternalLink className="w-3 h-3" /> Open in New Tab
                                                    </a>
                                                    {item.googleDriveLink.includes('drive.google.com') && (
                                                        <div className="border border-slate-200 rounded-lg overflow-hidden aspect-video bg-white">
                                                            <iframe
                                                                src={formatDrivePreview(item.googleDriveLink)}
                                                                className="w-full h-full border-0"
                                                                title="History Preview"
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
        </div>
    );
};

export default Dashboard;
