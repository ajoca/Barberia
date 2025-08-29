const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const axios = require('axios');
const moment = require('moment');
const cron = require('node-cron');
require('dotenv').config();

const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    MessageType,
    MessageOptions,
    Mimetype
} = require('baileys');

const app = express();
const PORT = process.env.PORT || 8002;

// Middleware
app.use(cors());
app.use(express.json());

// WhatsApp connection variables
let sock = null;
let qrCode = null;
let isConnected = false;
let connectionStatus = 'disconnected';
let phoneNumber = null;

// Session directory
const SESSION_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Message templates
const TEMPLATES = {
    appointment_confirmed: (data) => `🎉 *Cita Confirmada - Elite Barbershop* 💈

¡Hola ${data.client_name}!

Tu cita ha sido confirmada:
📅 *Fecha*: ${data.date}
⏰ *Hora*: ${data.time}
✂️ *Servicio*: ${data.service_name}
👨‍🦲 *Barbero*: ${data.barber_name}
💰 *Precio*: $${data.price}

📍 *Dirección*: Elite Barbershop
Calle Principal #123

¡Te esperamos! Si necesitas cancelar o reprogramar, avísanos con anticipación.

_Elite Barbershop - Donde el estilo se encuentra con la tradición_ ✨`,

    appointment_reminder: (data) => `🔔 *Recordatorio de Cita - Elite Barbershop*

¡Hola ${data.client_name}!

Te recordamos que tienes una cita mañana:
📅 *Fecha*: ${data.date}
⏰ *Hora*: ${data.time}
✂️ *Servicio*: ${data.service_name}
👨‍🦲 *Barbero*: ${data.barber_name}

¡No faltes! Te esperamos en Elite Barbershop 💈`,

    appointment_cancelled: (data) => `❌ *Cita Cancelada - Elite Barbershop*

Hola ${data.client_name},

Tu cita para ${data.service_name} del ${data.date} a las ${data.time} ha sido cancelada.

Puedes reagendar cuando gustes a través de nuestra app o llamándonos.

¡Esperamos verte pronto! 😊`,

    barber_new_appointment: (data) => `📱 *Nueva Cita - Elite Barbershop*

¡${data.barber_name}!

Tienes una nueva cita:
👤 *Cliente*: ${data.client_name}
📅 *Fecha*: ${data.date}
⏰ *Hora*: ${data.time}
✂️ *Servicio*: ${data.service_name}
💰 *Precio*: $${data.price}

¡Revisa tu agenda y prepárate! 💪`
};

// Initialize WhatsApp connection
async function initializeWhatsApp() {
    try {
        console.log('🔄 Initializing WhatsApp connection...');
        
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
        
        sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            logger: {
                level: 'silent',
                child: () => ({
                    level: 'silent',
                    info: () => {},
                    error: () => {},
                    warn: () => {},
                    debug: () => {},
                    trace: () => {}
                })
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('📱 QR Code received, generating image...');
                qrCode = await QRCode.toDataURL(qr);
                connectionStatus = 'qr_code_ready';
            }
            
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
                console.log('❌ Connection closed due to:', lastDisconnect?.error, ', reconnecting:', shouldReconnect);
                
                isConnected = false;
                phoneNumber = null;
                connectionStatus = 'disconnected';
                qrCode = null;
                
                if (shouldReconnect) {
                    setTimeout(() => initializeWhatsApp(), 3000);
                }
            } else if (connection === 'open') {
                console.log('✅ WhatsApp connected successfully!');
                isConnected = true;
                connectionStatus = 'connected';
                qrCode = null;
                
                // Get phone number
                if (sock?.user?.id) {
                    phoneNumber = sock.user.id.split(':')[0];
                    console.log(`📞 Connected as: ${phoneNumber}`);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);
        
    } catch (error) {
        console.error('❌ Error initializing WhatsApp:', error);
        connectionStatus = 'error';
        setTimeout(() => initializeWhatsApp(), 5000);
    }
}

// Send WhatsApp message
async function sendWhatsAppMessage(phoneNumber, message, templateType = 'custom', appointmentId = null) {
    try {
        if (!isConnected || !sock) {
            throw new Error('WhatsApp not connected');
        }

        // Format phone number (ensure it has country code)
        let formattedNumber = phoneNumber.replace(/\D/g, '');
        if (!formattedNumber.startsWith('52') && formattedNumber.length === 10) {
            formattedNumber = '52' + formattedNumber; // Mexico country code
        }
        formattedNumber += '@s.whatsapp.net';

        // Send message
        await sock.sendMessage(formattedNumber, { text: message });

        // Log to database (if needed)
        try {
            await axios.post(`${process.env.API_BASE_URL}/whatsapp/messages`, {
                to_phone: phoneNumber,
                message: message,
                template_type: templateType,
                status: 'sent',
                appointment_id: appointmentId,
                sent_at: new Date().toISOString()
            });
        } catch (dbError) {
            console.warn('⚠️ Failed to log message to database:', dbError.message);
        }

        console.log(`✅ Message sent to ${phoneNumber}`);
        return { success: true, message: 'Message sent successfully' };

    } catch (error) {
        console.error('❌ Error sending WhatsApp message:', error);
        
        // Log failed message
        try {
            await axios.post(`${process.env.API_BASE_URL}/whatsapp/messages`, {
                to_phone: phoneNumber,
                message: message,
                template_type: templateType,
                status: 'failed',
                appointment_id: appointmentId,
                error: error.message,
                created_at: new Date().toISOString()
            });
        } catch (dbError) {
            console.warn('⚠️ Failed to log error to database:', dbError.message);
        }

        return { success: false, error: error.message };
    }
}

// API Routes

// Get connection status
app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        status: connectionStatus,
        phone_number: phoneNumber,
        qr_code: qrCode,
        session_active: isConnected
    });
});

// Get QR code for connection
app.get('/qr', (req, res) => {
    if (qrCode) {
        res.json({ qr_code: qrCode, status: connectionStatus });
    } else {
        res.json({ 
            qr_code: null, 
            status: connectionStatus,
            message: connectionStatus === 'connected' ? 'Already connected' : 'QR code not available'
        });
    }
});

// Send message
app.post('/send-message', async (req, res) => {
    try {
        const { phone, message, template_type, appointment_id } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message are required' });
        }

        const result = await sendWhatsAppMessage(phone, message, template_type, appointment_id);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('❌ Send message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send appointment notification
app.post('/send-appointment-notification', async (req, res) => {
    try {
        const { type, appointment_data } = req.body;
        
        if (!type || !appointment_data) {
            return res.status(400).json({ error: 'Type and appointment_data are required' });
        }

        const template = TEMPLATES[type];
        if (!template) {
            return res.status(400).json({ error: 'Invalid template type' });
        }

        const message = template(appointment_data);
        
        // Send to client
        let results = [];
        if (appointment_data.client_phone) {
            const clientResult = await sendWhatsAppMessage(
                appointment_data.client_phone, 
                message, 
                type, 
                appointment_data.appointment_id
            );
            results.push({ recipient: 'client', ...clientResult });
        }

        // Send to barber if it's a new appointment
        if (type === 'barber_new_appointment' && appointment_data.barber_phone) {
            const barberMessage = TEMPLATES.barber_new_appointment(appointment_data);
            const barberResult = await sendWhatsAppMessage(
                appointment_data.barber_phone, 
                barberMessage, 
                'barber_new_appointment', 
                appointment_data.appointment_id
            );
            results.push({ recipient: 'barber', ...barberResult });
        }

        res.json({ 
            success: true, 
            message: 'Notifications sent',
            results: results
        });

    } catch (error) {
        console.error('❌ Send appointment notification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Disconnect WhatsApp
app.post('/disconnect', async (req, res) => {
    try {
        if (sock) {
            await sock.logout();
        }
        
        // Clear session files
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
        
        isConnected = false;
        phoneNumber = null;
        connectionStatus = 'disconnected';
        qrCode = null;
        sock = null;
        
        res.json({ message: 'WhatsApp disconnected successfully' });
    } catch (error) {
        console.error('❌ Disconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reconnect WhatsApp
app.post('/reconnect', async (req, res) => {
    try {
        if (sock) {
            try {
                await sock.logout();
            } catch (e) {
                console.log('Previous session logout failed, continuing...');
            }
        }
        
        // Clear session and reconnect
        if (fs.existsSync(SESSION_DIR)) {
            fs.rmSync(SESSION_DIR, { recursive: true, force: true });
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
        
        isConnected = false;
        phoneNumber = null;
        connectionStatus = 'connecting';
        qrCode = null;
        sock = null;
        
        setTimeout(() => initializeWhatsApp(), 1000);
        
        res.json({ message: 'Reconnection initiated' });
    } catch (error) {
        console.error('❌ Reconnect error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'whatsapp-service',
        timestamp: new Date().toISOString(),
        whatsapp_connected: isConnected
    });
});

// Schedule reminders (runs every hour)
cron.schedule('0 * * * *', async () => {
    console.log('🔄 Checking for appointment reminders...');
    
    try {
        // Get appointments that need reminders (24 hours before)
        const response = await axios.get(`${process.env.API_BASE_URL}/appointments/reminders`);
        const appointments = response.data;
        
        for (const appointment of appointments) {
            const reminderData = {
                client_name: appointment.client_name,
                date: moment(appointment.scheduled_at).format('DD/MM/YYYY'),
                time: moment(appointment.scheduled_at).format('HH:mm'),
                service_name: appointment.service_name,
                barber_name: appointment.barber_name
            };
            
            if (appointment.client_phone) {
                await sendWhatsAppMessage(
                    appointment.client_phone,
                    TEMPLATES.appointment_reminder(reminderData),
                    'appointment_reminder',
                    appointment.appointment_id
                );
            }
        }
        
        console.log(`✅ Processed ${appointments.length} reminder notifications`);
    } catch (error) {
        console.error('❌ Error processing reminders:', error);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp service running on port ${PORT}`);
    console.log(`📱 Admin panel: http://localhost:${PORT}/status`);
    
    // Initialize WhatsApp connection
    initializeWhatsApp();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Shutting down WhatsApp service...');
    if (sock) {
        try {
            await sock.end();
        } catch (error) {
            console.error('Error during shutdown:', error);
        }
    }
    process.exit(0);
});