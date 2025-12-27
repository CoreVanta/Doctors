import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Calendar, User, Phone, Clock, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addMinutes } from 'date-fns';

const Booking = () => {
    const [formData, setFormData] = useState({ name: '', phone: '', date: format(new Date(), 'yyyy-MM-dd') });
    const [loading, setLoading] = useState(false);
    const [bookingConfirmed, setBookingConfirmed] = useState(null);
    const [stats, setStats] = useState({ totalBooked: 0, estimatedWait: 0 });

    useEffect(() => {
        // Fetch current bookings for the selected date to show stats
        const q = query(collection(db, 'bookings'), where('date', '==', formData.date));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setStats({
                totalBooked: snapshot.size,
                estimatedWait: snapshot.size * 15 // 15 mins per patient
            });
        });
        return () => unsubscribe();
    }, [formData.date]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Get the next queue number
            const q = query(
                collection(db, 'bookings'),
                where('date', '==', formData.date),
                orderBy('queueNumber', 'desc'),
                limit(1)
            );
            const snapshot = await getDocs(q);
            let nextQueueNumber = 1;
            if (!snapshot.empty) {
                nextQueueNumber = snapshot.docs[0].data().queueNumber + 1;
            }

            const bookingData = {
                ...formData,
                queueNumber: nextQueueNumber,
                status: 'pending',
                timestamp: new Date(),
                estimatedTime: format(addMinutes(new Date(), stats.estimatedWait), 'HH:mm')
            };

            const docRef = await addDoc(collection(db, 'bookings'), bookingData);
            setBookingConfirmed({ id: docRef.id, ...bookingData });
        } catch (error) {
            console.error("Error adding booking: ", error);
            alert("Error booking appointment. Please try again.");
        }
        setLoading(false);
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
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Confirmed!</h2>
                    <p className="text-slate-600 mb-8">Your appointment has been scheduled successfully.</p>

                    <div className="bg-slate-50 rounded-xl p-6 mb-8 text-left space-y-4">
                        <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">Queue Number</span>
                            <span className="font-bold text-medical-600 text-xl">#{bookingConfirmed.queueNumber}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200 pb-2">
                            <span className="text-slate-500">Scheduled Time</span>
                            <span className="font-semibold">{bookingConfirmed.estimatedTime}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Date</span>
                            <span className="font-semibold">{bookingConfirmed.date}</span>
                        </div>
                    </div>

                    <p className="text-sm text-slate-500 mb-8 italic">
                        A confirmation message has been sent to {bookingConfirmed.phone} via WhatsApp.
                    </p>

                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full btn-primary"
                    >
                        Back to Home
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen py-12 px-6">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Book an Appointment</h1>
                    <p className="text-slate-600">Quick and easy booking in less than a minute.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Stats / Info */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="medical-card bg-medical-600 text-white border-none">
                            <h3 className="text-lg font-semibold mb-2">Live Availability</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <User className="w-5 h-5 opacity-80" />
                                    <span>{stats.totalBooked} Patients Today</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Clock className="w-5 h-5 opacity-80" />
                                    <span>{stats.estimatedWait} min Estimated Wait</span>
                                </div>
                            </div>
                        </div>
                        <div className="medical-card">
                            <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-medical-600" /> Clinic Info
                            </h4>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Open Mon-Sat: 9 AM - 6 PM<br />
                                Location: 123 Health Ave, Medical City<br />
                                Emergency: (555) 012-3456
                            </p>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="lg:col-span-2">
                        <div className="medical-card">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            required
                                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-transparent transition-all outline-none"
                                            placeholder="Enter your full name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">WhatsApp Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="tel"
                                            required
                                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-transparent transition-all outline-none"
                                            placeholder="+1 (123) 456-7890"
                                            value={formData.phone}
                                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="date"
                                            required
                                            min={format(new Date(), 'yyyy-MM-dd')}
                                            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-medical-500 focus:border-transparent transition-all outline-none"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full btn-primary py-4 text-lg flex justify-center items-center gap-2"
                                >
                                    {loading ? 'Processing...' : 'Confirm Booking'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Booking;
