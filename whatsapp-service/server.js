const { makeWASocket, useMultiFileAuthState, DisconnectReason, generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const QRCode = require('qrcode-terminal');
const { createClient } = require('redis');
const winston = require('winston');
const moment = require('moment');
require('dotenv').config();

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'whatsapp-service.log' })
  ]
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// WhatsApp connection state
let sock = null;
let qrCode = null;
let connectionState = 'disconnected';
let connectedPhone = null;
let lastConnection = null;

// Redis client for session persistence
let redisClient = null;

// Initialize Redis
async function initRedis() {
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
    await redisClient.connect();
    logger.info('Redis connected successfully');
  } catch (error) {
    logger.error('Redis connection failed:', error);
    // Continue without Redis for basic functionality
  }
}

// Initialize WhatsApp connection
async function initWhatsApp() {
  try {
    logger.info('Initializing WhatsApp connection...');
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ['Elite Barbershop', 'Chrome', '1.0.0'],
      defaultQueryTimeoutMs: 60000,
    });

    // Connection update handler
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrCode = qr;
        logger.info('New QR code generated');
        
        // Store QR in Redis with expiration
        if (redisClient) {
          await redisClient.setEx('whatsapp:qr', 60, qr);
        }
        
        // Display QR in terminal for debugging
        QRCode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        connectionState = 'disconnected';
        connectedPhone = null;
        qrCode = null;
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        logger.info(`Connection closed. Reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          setTimeout(initWhatsApp, 5000);
        }
      } else if (connection === 'open') {
        connectionState = 'connected';
        connectedPhone = sock.user?.id?.split(':')[0] || 'unknown';
        lastConnection = new Date().toISOString();
        qrCode = null;
        
        logger.info(`WhatsApp connected successfully as ${connectedPhone}`);
        
        // Clear QR from Redis
        if (redisClient) {
          await redisClient.del('whatsapp:qr');
        }
        
        // Notify FastAPI about connection
        try {
          await axios.post(`${FASTAPI_URL}/api/whatsapp/connection-status`, {
            connected: true,
            phone: connectedPhone,
            timestamp: lastConnection
          });
        } catch (error) {
          logger.error('Failed to notify FastAPI about connection:', error.message);
        }
      }
    });

    // Message handler
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type === 'notify') {
        for (const message of messages) {
          if (!message.key.fromMe && message.message) {
            await handleIncomingMessage(message);
          }
        }
      }
    });

    // Save credentials when updated
    sock.ev.on('creds.update', saveCreds);

  } catch (error) {
    logger.error('WhatsApp initialization error:', error);
    setTimeout(initWhatsApp, 10000);
  }
}

// Handle incoming messages
async function handleIncomingMessage(message) {
  try {
    const phoneNumber = message.key.remoteJid.replace('@s.whatsapp.net', '');
    const messageText = message.message?.conversation || 
                       message.message?.extendedTextMessage?.text || '';

    logger.info(`Received message from ${phoneNumber}: ${messageText}`);

    // Forward to FastAPI for processing
    try {
      const response = await axios.post(`${FASTAPI_URL}/api/whatsapp/incoming-message`, {
        phone_number: phoneNumber,
        message: messageText,
        message_id: message.key.id,
        timestamp: message.messageTimestamp
      });

      // Send auto-reply if provided
      if (response.data.reply) {
        await sendMessage(phoneNumber, response.data.reply);
      }
    } catch (error) {
      logger.error('Error forwarding message to FastAPI:', error.message);
      
      // Send default response
      await sendMessage(phoneNumber, 
        'Gracias por contactar Elite Barbershop. En breve te responderemos. 💈'
      );
    }

  } catch (error) {
    logger.error('Error handling incoming message:', error);
  }
}

// Send WhatsApp message
async function sendMessage(phoneNumber, text, templateData = null) {
  try {
    if (!sock || connectionState !== 'connected') {
      throw new Error('WhatsApp not connected');
    }

    // Format phone number
    const jid = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@s.whatsapp.net`;
    
    // Replace template variables if provided
    let messageText = text;
    if (templateData) {
      Object.keys(templateData).forEach(key => {
        const placeholder = `{${key}}`;
        messageText = messageText.replace(new RegExp(placeholder, 'g'), templateData[key]);
      });
    }
    
    // Send message
    await sock.sendMessage(jid, { text: messageText });
    
    logger.info(`Message sent to ${phoneNumber}: ${messageText}`);
    
    // Log to database
    try {
      await axios.post(`${FASTAPI_URL}/api/whatsapp/message-log`, {
        to_phone: phoneNumber,
        message: messageText,
        status: 'sent',
        template_data: templateData
      });
    } catch (error) {
      logger.error('Failed to log message to database:', error.message);
    }
    
    return { success: true, message: 'Message sent successfully' };
    
  } catch (error) {
    logger.error(`Error sending message to ${phoneNumber}:`, error);
    
    // Log failed message
    try {
      await axios.post(`${FASTAPI_URL}/api/whatsapp/message-log`, {
        to_phone: phoneNumber,
        message: text,
        status: 'failed',
        error: error.message
      });
    } catch (logError) {
      logger.error('Failed to log failed message:', logError.message);
    }
    
    return { success: false, error: error.message };
  }
}

// Send template-based messages
async function sendTemplateMessage(phoneNumber, templateType, templateData) {
  const templates = {
    appointment_confirmed: "¡Hola {client_name}! Tu cita para {service_name} con {barber_name} ha sido confirmada para el {date} a las {time}. Te esperamos en Elite Barbershop. 💈",
    appointment_reminder: "🔔 Recordatorio: Tienes una cita mañana a las {time} para {service_name} con {barber_name}. ¡Te esperamos en Elite Barbershop!",
    appointment_cancelled: "Hola {client_name}, lamentamos informarte que tu cita para {service_name} el {date} ha sido cancelada. Por favor contacta con nosotros para reagendar.",
    review_request: "¡Hola {client_name}! Esperamos que hayas disfrutado tu {service_name} con {barber_name}. Nos encantaría conocer tu opinión. ⭐",
    appointment_created: "¡Hola {client_name}! Has agendado una cita para {service_name} con {barber_name} el {date} a las {time}. Te confirmaremos pronto.",
    barber_new_appointment: "Nueva cita recibida: {service_name} con {client_name} el {date} a las {time}. ¡Revisa tu agenda!"
  };

  const template = templates[templateType];
  if (!template) {
    throw new Error(`Template not found: ${templateType}`);
  }

  return await sendMessage(phoneNumber, template, templateData);
}

// API Routes

// Get connection status
app.get('/status', (req, res) => {
  res.json({
    connected: connectionState === 'connected',
    phone_number: connectedPhone,
    last_connection: lastConnection,
    qr_available: !!qrCode
  });
});

// Get QR code
app.get('/qr', async (req, res) => {
  try {
    let currentQR = qrCode;
    
    // Try to get from Redis if not in memory
    if (!currentQR && redisClient) {
      currentQR = await redisClient.get('whatsapp:qr');
    }
    
    res.json({ qr: currentQR });
  } catch (error) {
    logger.error('Error getting QR code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send message
app.post('/send', async (req, res) => {
  try {
    const { phone_number, message, template_type, template_data } = req.body;
    
    if (!phone_number || (!message && !template_type)) {
      return res.status(400).json({ error: 'Phone number and message/template required' });
    }
    
    let result;
    if (template_type) {
      result = await sendTemplateMessage(phone_number, template_type, template_data);
    } else {
      result = await sendMessage(phone_number, message, template_data);
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Send message API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send bulk messages
app.post('/send-bulk', async (req, res) => {
  try {
    const { recipients, message, template_type, template_data } = req.body;
    
    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'Recipients array required' });
    }
    
    const results = [];
    
    for (const recipient of recipients) {
      try {
        let result;
        const recipientData = { ...template_data, ...recipient };
        
        if (template_type) {
          result = await sendTemplateMessage(recipient.phone_number, template_type, recipientData);
        } else {
          result = await sendMessage(recipient.phone_number, message, recipientData);
        }
        
        results.push({
          phone_number: recipient.phone_number,
          ...result
        });
        
        // Add delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        results.push({
          phone_number: recipient.phone_number,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({ results });
  } catch (error) {
    logger.error('Bulk send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Disconnect WhatsApp
app.post('/disconnect', async (req, res) => {
  try {
    if (sock) {
      await sock.logout();
    }
    connectionState = 'disconnected';
    connectedPhone = null;
    qrCode = null;
    
    logger.info('WhatsApp disconnected manually');
    res.json({ message: 'Disconnected successfully' });
  } catch (error) {
    logger.error('Disconnect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    whatsapp_status: connectionState,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Message statistics
app.get('/stats', async (req, res) => {
  try {
    // Get message stats from Redis or database
    const stats = {
      messages_sent_today: 0,
      messages_sent_week: 0,
      messages_sent_month: 0,
      connection_uptime: lastConnection ? moment().diff(moment(lastConnection), 'hours') : 0,
      status: connectionState
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule appointment notifications
app.post('/schedule-notifications', async (req, res) => {
  try {
    const { appointments } = req.body;
    
    if (!appointments || !Array.isArray(appointments)) {
      return res.status(400).json({ error: 'Appointments array required' });
    }
    
    for (const appointment of appointments) {
      const { client_phone, client_name, barber_name, service_name, scheduled_at, notification_type } = appointment;
      
      const templateData = {
        client_name,
        barber_name,
        service_name,
        date: moment(scheduled_at).format('DD/MM/YYYY'),
        time: moment(scheduled_at).format('HH:mm')
      };
      
      // Send immediate notification
      await sendTemplateMessage(client_phone, notification_type, templateData);
      
      // Schedule reminder for 24 hours before (in production, use a job queue)
      if (notification_type === 'appointment_confirmed') {
        const reminderTime = moment(scheduled_at).subtract(24, 'hours');
        if (reminderTime.isAfter(moment())) {
          // This would be handled by a job scheduler in production
          logger.info(`Reminder scheduled for ${reminderTime.format()} for appointment ${appointment.id}`);
        }
      }
    }
    
    res.json({ message: 'Notifications scheduled successfully' });
  } catch (error) {
    logger.error('Schedule notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Express error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function startServer() {
  try {
    await initRedis();
    await initWhatsApp();
    
    app.listen(PORT, () => {
      logger.info(`WhatsApp service running on port ${PORT}`);
      logger.info(`FastAPI URL: ${FASTAPI_URL}`);
      logger.info('Service started successfully');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  if (sock) {
    await sock.end();
  }
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  if (sock) {
    await sock.end();
  }
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  process.exit(0);
});

startServer();