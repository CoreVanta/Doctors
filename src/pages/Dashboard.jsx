import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, addDoc } from 'firebase/firestore';
import {
    Users, CheckCircle2, PlayCircle, SkipForward, ArrowRight,
    ExternalLink, FileText, Clipboard, Search, Plus, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const Dashboard = () => {
    const [bookings, setBookings] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [clinicalNotes, setClinicalNotes] = useState('');
    const [driveLink, setDriveLink] = useState('');
    const [nextAppointment, setNextAppointment] = useState('');
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
                setSelectedPatient(patient);
                setClinicalNotes('');
                setDriveLink('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedPatient) return;
        try {
            const docRef = doc(db, 'bookings', selectedPatient.id);
            await updateDoc(docRef, {
                notes: clinicalNotes,
                googleDriveLink: driveLink,
                nextAppointment: nextAppointment,
                status: 'completed'
            });

            // Also save to a central 'patients' clinical history (optional logic can be added here)

            setSelectedPatient(null);
            setClinicalNotes('');
            setDriveLink('');
            setNextAppointment('');
            alert("Consultation completed and records saved.");
        } catch (err) {
            console.error(err);
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
                            onClick={() => setSelectedPatient(booking)}
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
                                        <label htmlFor="driveLink" className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Google Drive Records</label>
                                        <div className="relative">
                                            <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                            <input
                                                id="driveLink"
                                                name="driveLink"
                                                type="url"
                                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical-500 transition-all outline-none"
                                                placeholder="Paste PDF or Image link..."
                                                value={driveLink}
                                                onChange={(e) => setDriveLink(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 px-1">Link laboratory results or patient x-rays here.</p>
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
                                            <button className="w-full text-left text-sm py-2 px-3 rounded-lg hover:bg-white transition-colors text-slate-600 border border-transparent hover:border-medical-200">
                                                Print Prescription
                                            </button>
                                            <button className="w-full text-left text-sm py-2 px-3 rounded-lg hover:bg-white transition-colors text-slate-600 border border-transparent hover:border-medical-200">
                                                View History
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200 flex justify-end gap-3">
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
                        </motion.div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Clipboard className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-lg">Select a patient from the queue to start consultation</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
