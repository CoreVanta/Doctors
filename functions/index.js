const functions = require('firebase-functions');
const axios = require('axios');

// WhatsApp Cloud API Config
const WHATSAPP_TOKEN = 'YOUR_META_ACCESS_TOKEN';
const PHONE_NUMBER_ID = 'YOUR_PHONE_NUMBER_ID';
const API_URL = `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`;

/**
 * Trigger 1: Send confirmation on booking creation
 */
exports.sendBookingConfirmation = functions.firestore
    .document('bookings/{bookingId}')
    .onCreate(async (snap, context) => {
        const newValue = snap.data();
        const phoneNumber = newValue.phone.replace(/\D/g, ''); // Ensure digits only

        try {
            await axios.post(API_URL, {
                messaging_product: "whatsapp",
                to: phoneNumber,
                type: "template",
                template: {
                    name: "booking_confirmation",
                    language: { code: "en_US" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: newValue.name },
                                { type: "text", text: newValue.date },
                                { type: "text", text: `#${newValue.queueNumber}` },
                                { type: "text", text: newValue.estimatedTime }
                            ]
                        }
                    ]
                }
            }, {
                headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
            });
        } catch (error) {
            console.error('WhatsApp API Error:', error.response ? error.response.data : error.message);
        }
    });

/**
 * Trigger 2: Notify when turn is near
 * Logic: When status changes to 'calling', notify the next patient in queue
 */
exports.notifyNextPatient = functions.firestore
    .document('bookings/{bookingId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // If status changed to 'calling'
        if (before.status !== 'calling' && after.status === 'calling') {
            // Find the NEXT patient (pending and queueNumber = after.queueNumber + 1)
            const db = admin.firestore();
            const nextPatientSnap = await db.collection('bookings')
                .where('date', '==', after.date)
                .where('queueNumber', '==', after.queueNumber + 1)
                .where('status', '==', 'pending')
                .limit(1)
                .get();

            if (!nextPatientSnap.empty) {
                const nextPatient = nextPatientSnap.docs[0].data();
                const phoneNumber = nextPatient.phone.replace(/\D/g, '');

                await axios.post(API_URL, {
                    messaging_product: "whatsapp",
                    to: phoneNumber,
                    type: "text",
                    text: {
                        body: `Hello ${nextPatient.name}, the doctor is now serving #${after.queueNumber}. You are next in queue (#${nextPatient.queueNumber}). Please head to the clinic.`
                    }
                }, {
                    headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
                });
            }
        }
    });
