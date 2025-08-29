# Elite Barbershop - WhatsApp Service

WhatsApp Business API integration service using Baileys for Elite Barbershop appointment notifications.

## Features

- ✅ WhatsApp Web connection with QR code authentication
- ✅ Automatic message templates for appointments
- ✅ Bulk message sending capabilities
- ✅ Session persistence with Redis
- ✅ Integration with FastAPI backend
- ✅ Comprehensive logging
- ✅ Health monitoring endpoints

## Installation

1. Install Node.js dependencies:
```bash
cd whatsapp-service
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configurations
```

3. Start the service:
```bash
npm start
# or for development
npm run dev
```

## API Endpoints

### Connection Management
- `GET /status` - Get WhatsApp connection status
- `GET /qr` - Get QR code for authentication
- `POST /disconnect` - Disconnect WhatsApp session

### Messaging
- `POST /send` - Send individual message
- `POST /send-bulk` - Send bulk messages
- `POST /schedule-notifications` - Schedule appointment notifications

### Monitoring
- `GET /health` - Service health check
- `GET /stats` - Message statistics

## Message Templates

### Appointment Confirmed
```
¡Hola {client_name}! Tu cita para {service_name} con {barber_name} ha sido confirmada para el {date} a las {time}. Te esperamos en Elite Barbershop. 💈
```

### Appointment Reminder
```
🔔 Recordatorio: Tienes una cita mañana a las {time} para {service_name} con {barber_name}. ¡Te esperamos en Elite Barbershop!
```

### Review Request
```
¡Hola {client_name}! Esperamos que hayas disfrutado tu {service_name} con {barber_name}. Nos encantaría conocer tu opinión. ⭐
```

## Usage Examples

### Send Template Message
```javascript
POST /send
{
  "phone_number": "+1234567890",
  "template_type": "appointment_confirmed",
  "template_data": {
    "client_name": "Juan Pérez",
    "service_name": "Corte de Cabello",
    "barber_name": "Carlos",
    "date": "15/01/2025",
    "time": "14:30"
  }
}
```

### Send Bulk Notifications
```javascript
POST /send-bulk
{
  "template_type": "appointment_reminder",
  "recipients": [
    {
      "phone_number": "+1234567890",
      "client_name": "Juan Pérez",
      "service_name": "Corte de Cabello",
      "barber_name": "Carlos",
      "time": "14:30"
    }
  ]
}
```

## Integration with FastAPI

The service automatically integrates with the FastAPI backend:

1. **Connection Status**: Notifies backend when WhatsApp connects/disconnects
2. **Message Logging**: Logs all sent messages to the database
3. **Incoming Messages**: Forwards received messages to backend for processing

## Error Handling

- Automatic reconnection on connection loss
- Message retry logic for failed sends
- Comprehensive error logging
- Graceful degradation when Redis is unavailable

## Production Considerations

1. **Session Persistence**: WhatsApp sessions are saved to `./auth_info` directory
2. **Rate Limiting**: Built-in delays between bulk messages
3. **Monitoring**: Health endpoints for service monitoring
4. **Logging**: Structured logging with Winston
5. **Graceful Shutdown**: Proper cleanup on service termination

## Security

- No API keys required (uses WhatsApp Web protocol)
- Session files should be secured and backed up
- Rate limiting to prevent spam
- Input validation for all endpoints

## Troubleshooting

### Common Issues

1. **QR Code Not Scanning**: Ensure WhatsApp Web is not open elsewhere
2. **Connection Drops**: Check internet connectivity and WhatsApp server status
3. **Messages Not Sending**: Verify phone number format (+countrycode)
4. **Session Lost**: Delete `./auth_info` and re-authenticate

### Logs

Service logs are written to:
- Console output
- `whatsapp-service.log` file

Monitor logs for connection status and error messages.