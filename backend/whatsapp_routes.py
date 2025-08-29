from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import logging
import httpx
import os

from models import WhatsAppMessage, WhatsAppStatus
from database import get_database
from server import get_current_user, User, UserRole

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

WHATSAPP_SERVICE_URL = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:8002")

@router.get("/status", response_model=WhatsAppStatus)
async def get_whatsapp_status():
    """Get WhatsApp connection status"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/status")
            data = response.json()
            
            return WhatsAppStatus(
                connected=data.get("connected", False),
                phone_number=data.get("phone_number"),
                last_connection=datetime.utcnow() if data.get("connected") else None,
                qr_code=data.get("qr_code"),
                session_active=data.get("session_active", False)
            )
    except Exception as e:
        logging.error(f"Error getting WhatsApp status: {e}")
        return WhatsAppStatus(
            connected=False,
            session_active=False
        )

@router.get("/qr-code")
async def get_qr_code(current_user: User = Depends(get_current_user)):
    """Get QR code for WhatsApp connection (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver el código QR")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{WHATSAPP_SERVICE_URL}/qr")
            return response.json()
    except Exception as e:
        logging.error(f"Error getting QR code: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener código QR")

@router.post("/reconnect")
async def reconnect_whatsapp(current_user: User = Depends(get_current_user)):
    """Reconnect WhatsApp (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden reconectar WhatsApp")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/reconnect")
            return response.json()
    except Exception as e:
        logging.error(f"Error reconnecting WhatsApp: {e}")
        raise HTTPException(status_code=500, detail="Error al reconectar WhatsApp")

@router.post("/disconnect")
async def disconnect_whatsapp(current_user: User = Depends(get_current_user)):
    """Disconnect WhatsApp (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden desconectar WhatsApp")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/disconnect")
            return response.json()
    except Exception as e:
        logging.error(f"Error disconnecting WhatsApp: {e}")
        raise HTTPException(status_code=500, detail="Error al desconectar WhatsApp")

@router.post("/send-message")
async def send_whatsapp_message(
    message_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Send WhatsApp message (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden enviar mensajes")
    
    try:
        phone = message_data.get("phone")
        message = message_data.get("message")
        template_type = message_data.get("template_type", "custom")
        
        if not phone or not message:
            raise HTTPException(status_code=400, detail="Teléfono y mensaje son requeridos")
        
        # Send via WhatsApp service
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/send-message", 
                json={
                    "phone": phone,
                    "message": message,
                    "template_type": template_type
                })
            
            result = response.json()
            
            # Log to database
            whatsapp_message = {
                "to_phone": phone,
                "message": message,
                "template_type": template_type,
                "status": "sent" if result.get("success") else "failed",
                "sent_at": datetime.utcnow() if result.get("success") else None,
                "created_at": datetime.utcnow()
            }
            
            await db.whatsapp_messages.insert_one(whatsapp_message)
            
            return result
            
    except Exception as e:
        logging.error(f"Error sending WhatsApp message: {e}")
        raise HTTPException(status_code=500, detail="Error al enviar mensaje")

@router.post("/send-appointment-notification")
async def send_appointment_notification(
    notification_data: dict,
    background_tasks: BackgroundTasks,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Send appointment notification via WhatsApp"""
    try:
        appointment_id = notification_data.get("appointment_id")
        notification_type = notification_data.get("type", "appointment_confirmed")
        
        if not appointment_id:
            raise HTTPException(status_code=400, detail="appointment_id es requerido")
        
        # Get appointment details
        appointment = await db.appointments.find_one({"_id": ObjectId(appointment_id)})
        if not appointment:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        
        # Get related data
        client = await db.users.find_one({"_id": ObjectId(appointment["client_id"])})
        barber_doc = await db.barbers.find_one({"_id": ObjectId(appointment["barber_id"])})
        barber_user = await db.users.find_one({"_id": ObjectId(barber_doc["user_id"])}) if barber_doc else None
        service = await db.services.find_one({"_id": ObjectId(appointment["service_id"])})
        
        if not all([client, barber_user, service]):
            raise HTTPException(status_code=400, detail="Datos de la cita incompletos")
        
        # Format appointment data
        scheduled_dt = appointment["scheduled_at"]
        appointment_data = {
            "appointment_id": str(appointment["_id"]),
            "client_name": client["name"],
            "client_phone": client["phone"],
            "barber_name": barber_user["name"],
            "barber_phone": barber_user.get("phone"),
            "service_name": service["name"],
            "date": scheduled_dt.strftime("%d/%m/%Y"),
            "time": scheduled_dt.strftime("%H:%M"),
            "price": appointment["total_price"]
        }
        
        # Send notification
        background_tasks.add_task(send_whatsapp_notification, notification_type, appointment_data, db)
        
        return {"message": "Notificación WhatsApp enviada", "appointment_id": appointment_id}
        
    except Exception as e:
        logging.error(f"Error sending appointment notification: {e}")
        raise HTTPException(status_code=500, detail="Error al enviar notificación")

async def send_whatsapp_notification(notification_type: str, appointment_data: dict, db: AsyncIOMotorDatabase):
    """Background task to send WhatsApp notification"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{WHATSAPP_SERVICE_URL}/send-appointment-notification",
                json={
                    "type": notification_type,
                    "appointment_data": appointment_data
                })
            
            result = response.json()
            
            # Log results to database
            for result_item in result.get("results", []):
                whatsapp_message = {
                    "to_phone": appointment_data.get("client_phone" if result_item["recipient"] == "client" else "barber_phone"),
                    "message": "Notificación de cita",
                    "template_type": notification_type,
                    "status": "sent" if result_item.get("success") else "failed",
                    "appointment_id": appointment_data["appointment_id"],
                    "sent_at": datetime.utcnow() if result_item.get("success") else None,
                    "created_at": datetime.utcnow()
                }
                
                await db.whatsapp_messages.insert_one(whatsapp_message)
                
    except Exception as e:
        logging.error(f"Error in background WhatsApp notification: {e}")

@router.get("/messages", response_model=List[dict])
async def get_whatsapp_messages(
    limit: int = 50,
    skip: int = 0,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get WhatsApp message history (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver mensajes")
    
    try:
        query = {}
        if status:
            query["status"] = status
        
        messages = await db.whatsapp_messages.find(query)\
            .sort("created_at", -1)\
            .skip(skip)\
            .limit(limit)\
            .to_list(length=limit)
        
        return [
            {
                "id": str(message["_id"]),
                "to_phone": message["to_phone"],
                "message": message.get("message", ""),
                "template_type": message["template_type"],
                "status": message["status"],
                "appointment_id": message.get("appointment_id"),
                "sent_at": message.get("sent_at"),
                "created_at": message["created_at"]
            }
            for message in messages
        ]
        
    except Exception as e:
        logging.error(f"Error getting WhatsApp messages: {e}")
        raise HTTPException(status_code=500, detail="Error al obtener mensajes")

@router.get("/appointments/reminders")
async def get_appointment_reminders(db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get appointments that need reminders (for WhatsApp service)"""
    try:
        # Get appointments 24 hours from now that haven't had reminders sent
        reminder_time = datetime.utcnow() + timedelta(hours=24)
        start_time = reminder_time - timedelta(minutes=30)
        end_time = reminder_time + timedelta(minutes=30)
        
        appointments = await db.appointments.find({
            "scheduled_at": {"$gte": start_time, "$lte": end_time},
            "status": {"$in": ["pending", "confirmed"]},
            "reminder_sent": {"$ne": True}
        }).to_list(length=None)
        
        reminders = []
        for appointment in appointments:
            # Get related data
            client = await db.users.find_one({"_id": ObjectId(appointment["client_id"])})
            barber_doc = await db.barbers.find_one({"_id": ObjectId(appointment["barber_id"])})
            barber_user = await db.users.find_one({"_id": ObjectId(barber_doc["user_id"])}) if barber_doc else None
            service = await db.services.find_one({"_id": ObjectId(appointment["service_id"])})
            
            if all([client, barber_user, service]):
                reminders.append({
                    "appointment_id": str(appointment["_id"]),
                    "client_name": client["name"],
                    "client_phone": client["phone"],
                    "barber_name": barber_user["name"],
                    "service_name": service["name"],
                    "scheduled_at": appointment["scheduled_at"]
                })
        
        # Mark reminders as sent
        if reminders:
            appointment_ids = [ObjectId(r["appointment_id"]) for r in reminders]
            await db.appointments.update_many(
                {"_id": {"$in": appointment_ids}},
                {"$set": {"reminder_sent": True}}
            )
        
        return reminders
        
    except Exception as e:
        logging.error(f"Error getting appointment reminders: {e}")
        return []

@router.post("/messages")
async def log_message(message_data: dict, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Log WhatsApp message (used by WhatsApp service)"""
    try:
        await db.whatsapp_messages.insert_one(message_data)
        return {"message": "Message logged successfully"}
    except Exception as e:
        logging.error(f"Error logging message: {e}")
        raise HTTPException(status_code=500, detail="Error logging message")