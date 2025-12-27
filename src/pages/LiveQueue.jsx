import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Users, Clock, ArrowUpCircle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const LiveQueue = () => {
    const [bookings, setBookings] = useState([]);
    const [currentNumber, setCurrentNumber] = useState(0);
    const todaysDate = format(new Date(), 'yyyy-MM-dd');

    useEffect(() => {
        // Listen to today's bookings
        const q = query(
            collection(db, 'bookings'),
            where('date', '==', todaysDate),
            orderBy('queueNumber', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBookings(data);

            // Find the currently calling number (first "calling" or last "completed" + 1)
            const calling = data.find(b => b.status === 'calling');
            if (calling) {
                setCurrentNumber(calling.queueNumber);
            } else {
                const lastCompleted = [...data].reverse().find(b => b.status === 'completed');
                setCurrentNumber(lastCompleted ? lastCompleted.queueNumber : 0);
            }
        });

        return () => unsubscribe();
    }, [todaysDate]);

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-6">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4 italic">Live Queue Updates</h1>
                    <p className="text-slate-600">Track the current clinic status in real-time.</p>
                </div>

                {/* Current status card */}
                <div className="bg-medical-600 rounded-2xl p-10 text-white shadow-xl shadow-medical-200 mb-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Users className="w-32 h-32" />
                    </div>
                    <p className="text-medical-100 font-medium mb-2 uppercase tracking-widest">Now Serving</p>
                    <div className="text-8xl font-black mb-4">
                        #{currentNumber}
                    </div>
                    <div className="flex justify-center gap-8 mt-6">
                        <div className="text-center">
                            <span className="block text-2xl font-bold">{bookings.filter(b => b.status === 'pending').length}</span>
                            <span className="text-xs uppercase text-medical-100 font-semibold">Waiting</span>
                        </div>
                        <div className="h-10 w-px bg-medical-400 opacity-50"></div>
                        <div className="text-center">
                            <span className="block text-2xl font-bold">{bookings.filter(b => b.status === 'completed').length}</span>
                            <span className="text-xs uppercase text-medical-100 font-semibold">Completed</span>
                        </div>
                    </div>
                </div>

                {/* Queue List */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-900 px-2 mb-4">Upcoming Patients</h3>
                    <AnimatePresence mode="popLayout">
                        {bookings.filter(b => b.status === 'pending').map((booking, index) => (
                            <motion.div
                                key={booking.id}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 20, opacity: 0 }}
                                className={`medical-card flex justify-between items-center transition-all ${index === 0 ? 'bg-medical-50 border-medical-200' : ''}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${index === 0 ? 'bg-medical-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                        #{booking.queueNumber}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900">{booking.name}</h4>
                                        <p className="text-xs text-slate-500 uppercase font-semibold">Scheduled for {booking.estimatedTime}</p>
                                    </div>
                                </div>
                                {index === 0 && (
                                    <div className="bg-medical-100 text-medical-700 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                                        UP NEXT
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {bookings.filter(b => b.status === 'pending').length === 0 && (
                        <div className="text-center py-10 medical-card border-dashed">
                            <Info className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500">No pending appointments for today.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveQueue;
