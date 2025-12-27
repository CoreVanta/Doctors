const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Twilio Configuration
const accountSid = 'AC45a599b11744179644b0417f7ee74674';
const authToken = 'd4dff0de6991854e5ec2aa631a231153';
const client = require('twilio')(accountSid, authToken);

// Twilio WhatsApp Sandbox Number
const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886';

/**
 * Trigger 1: Send confirmation on booking creation
 */
exports.sendBookingConfirmation = functions.firestore
    .document('bookings/{bookingId}')
    .onCreate(async (snap, context) => {
        const newValue = snap.data();
        const phoneNumber = newValue.phone;

        // Ensure phone number has country code (default to +20 for Egypt)
        const formattedPhone = phoneNumber.startsWith('+')
            ? phoneNumber
            : `+20${phoneNumber.replace(/^0+/, '')}`;

        const whatsappNumber = `whatsapp:${formattedPhone}`;

        try {
            await client.messages.create({
                from: TWILIO_WHATSAPP_FROM,
                to: whatsappNumber,
                body: `مرحباً ${newValue.name}! تم تأكيد حجزك ليوم ${newValue.date}. رقم دورك: #${newValue.queueNumber}. الوقت المتوقع: ${newValue.estimatedTime}.`
            });
            console.log(`Booking confirmation sent to ${whatsappNumber}`);
        } catch (error) {
            console.error('Twilio WhatsApp Error:', error.message);
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
                const phoneNumber = nextPatient.phone;

                // Ensure phone number has country code
                const formattedPhone = phoneNumber.startsWith('+')
                    ? phoneNumber
                    : `+20${phoneNumber.replace(/^0+/, '')}`;

                const whatsappNumber = `whatsapp:${formattedPhone}`;

                try {
                    await client.messages.create({
                        from: TWILIO_WHATSAPP_FROM,
                        to: whatsappNumber,
                        body: `مرحباً ${nextPatient.name}، الطبيب الآن يخدم المريض #${after.queueNumber}. أنت التالي (#${nextPatient.queueNumber}). يرجى التوجه للعيادة.`
                    });
                    console.log(`Next patient notification sent to ${whatsappNumber}`);
                } catch (error) {
                    console.error('Twilio WhatsApp Error:', error.message);
                }
            }
        }
    });
