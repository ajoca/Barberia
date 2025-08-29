from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import logging

from models import Notification, NotificationCreate, NotificationTemplate, WhatsAppMessage
from database import get_database
from server import get_current_user, User, UserRole

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

# Notification templates
DEFAULT_TEMPLATES = {
    "appointment_confirmed": {
        "title": "Cita Confirmada",
        "message": "Tu cita para {service_name} con {barber_name} ha sido confirmada para el {date} a las {time}. ¡Te esperamos en Elite Barbershop! 💈"
    },
    "appointment_reminder": {
        "title": "Recordatorio de Cita",
        "message": "🔔 Recordatorio: Tienes una cita mañana a las {time} para {service_name} con {barber_name}. ¡Te esperamos!"
    },
    "appointment_cancelled": {
        "title": "Cita Cancelada",
        "message": "Tu cita para {service_name} el {date} ha sido cancelada. Puedes reagendar cuando gustes."
    },
    "review_request": {
        "title": "¿Cómo estuvo tu servicio?",
        "message": "Esperamos que hayas disfrutado tu {service_name} con {barber_name}. ¡Nos encantaría conocer tu opinión!"
    },
    "appointment_created": {
        "title": "Nueva Cita Agendada",
        "message": "Has agendado una cita para {service_name} con {barber_name} el {date} a las {time}. Estado: Pendiente de confirmación."
    },
    "barber_new_appointment": {
        "title": "Nueva Cita Recibida",
        "message": "Tienes una nueva cita: {service_name} con {client_name} el {date} a las {time}. ¡Revisa tu agenda!"
    }
}

async def create_notification(
    db: AsyncIOMotorDatabase,
    user_id: str,
    notification_type: str,
    template_data: Dict[str, Any],
    appointment_id: Optional[str] = None
):
    """Helper function to create a notification"""
    try:
        template = DEFAULT_TEMPLATES.get(notification_type)
        if not template:
            logging.warning(f"Template not found for type: {notification_type}")
            return None
        
        # Format message with template data
        title = template["title"]
        message = template["message"].format(**template_data)
        
        notification_data = {
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": notification_type,
            "data": {
                "appointment_id": appointment_id,
                **template_data
            },
            "is_read": False,
            "created_at": datetime.utcnow()
        }
        
        result = await db.notifications.insert_one(notification_data)
        logging.info(f"Notification created: {result.inserted_id}")
        
        return str(result.inserted_id)
        
    except Exception as e:
        logging.error(f"Error creating notification: {e}")
        return None

async def send_appointment_notifications(
    db: AsyncIOMotorDatabase,
    appointment: Dict[str, Any],
    notification_type: str
):
    """Send notifications for appointment events"""
    try:
        # Get related data
        client = await db.users.find_one({"_id": ObjectId(appointment["client_id"])})
        barber_doc = await db.barbers.find_one({"_id": ObjectId(appointment["barber_id"])})
        barber_user = await db.users.find_one({"_id": ObjectId(barber_doc["user_id"])}) if barber_doc else None
        service = await db.services.find_one({"_id": ObjectId(appointment["service_id"])})
        
        if not all([client, barber_user, service]):
            logging.warning("Missing data for appointment notifications")
            return
        
        # Format date and time
        scheduled_dt = appointment["scheduled_at"]
        date_str = scheduled_dt.strftime("%d/%m/%Y")
        time_str = scheduled_dt.strftime("%H:%M")
        
        template_data = {
            "client_name": client["name"],
            "barber_name": barber_user["name"],
            "service_name": service["name"],
            "date": date_str,
            "time": time_str,
            "price": appointment["total_price"]
        }
        
        # Send notification to client
        if notification_type in ["appointment_confirmed", "appointment_cancelled", "appointment_created"]:
            await create_notification(
                db, 
                appointment["client_id"],
                notification_type,
                template_data,
                str(appointment["_id"])
            )
        
        # Send notification to barber for new appointments
        if notification_type == "appointment_created":
            await create_notification(
                db,
                barber_doc["user_id"],
                "barber_new_appointment",
                template_data,
                str(appointment["_id"])
            )
        
        # Schedule reminder notification (24 hours before)
        if notification_type == "appointment_confirmed":
            # This would be handled by a background task scheduler in production
            # For now, we'll create the reminder immediately for demo purposes
            reminder_time = scheduled_dt - timedelta(hours=24)
            if reminder_time > datetime.utcnow():
                # In production, this would be queued for later execution
                pass
        
    except Exception as e:
        logging.error(f"Error sending appointment notifications: {e}")

@router.get("/", response_model=List[dict])
async def get_notifications(
    limit: int = 20,
    skip: int = 0,
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get notifications for the current user"""
    try:
        query = {"user_id": str(current_user.id)}
        if unread_only:
            query["is_read"] = False
        
        notifications = await db.notifications.find(query)\
            .sort("created_at", -1)\
            .skip(skip)\
            .limit(limit)\
            .to_list(length=limit)
        
        return [
            {
                "id": str(notification["_id"]),
                "title": notification["title"],
                "message": notification["message"],
                "type": notification["type"],
                "data": notification.get("data", {}),
                "is_read": notification["is_read"],
                "created_at": notification["created_at"]
            }
            for notification in notifications
        ]
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Mark a notification as read"""
    try:
        result = await db.notifications.update_one(
            {
                "_id": ObjectId(notification_id),
                "user_id": str(current_user.id)
            },
            {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")
        
        return {"message": "Notificación marcada como leída"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/mark-all-read")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Mark all notifications as read for the current user"""
    try:
        result = await db.notifications.update_many(
            {
                "user_id": str(current_user.id),
                "is_read": False
            },
            {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
        )
        
        return {
            "message": f"{result.modified_count} notificaciones marcadas como leídas"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get count of unread notifications"""
    try:
        count = await db.notifications.count_documents({
            "user_id": str(current_user.id),
            "is_read": False
        })
        
        return {"unread_count": count}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a notification"""
    try:
        result = await db.notifications.delete_one({
            "_id": ObjectId(notification_id),
            "user_id": str(current_user.id)
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Notificación no encontrada")
        
        return {"message": "Notificación eliminada"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/send-test")
async def send_test_notification(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Send a test notification (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden enviar notificaciones de prueba")
    
    try:
        notification_id = await create_notification(
            db,
            str(current_user.id),
            "test",
            {
                "service_name": "Corte de Prueba",
                "barber_name": "Barbero de Prueba",
                "date": "15/01/2025",
                "time": "14:30"
            }
        )
        
        return {
            "message": "Notificación de prueba enviada",
            "notification_id": notification_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Background task to send review requests
async def send_review_requests(db: AsyncIOMotorDatabase):
    """Send review requests for completed appointments after 24 hours"""
    try:
        # Get completed appointments from 24-48 hours ago that haven't been reviewed
        start_time = datetime.utcnow() - timedelta(hours=48)
        end_time = datetime.utcnow() - timedelta(hours=24)
        
        appointments = await db.appointments.find({
            "status": "completed",
            "scheduled_at": {"$gte": start_time, "$lte": end_time},
            "reviewed": {"$ne": True},
            "review_request_sent": {"$ne": True}
        }).to_list(length=None)
        
        for appointment in appointments:
            # Get related data
            client = await db.users.find_one({"_id": ObjectId(appointment["client_id"])})
            barber_doc = await db.barbers.find_one({"_id": ObjectId(appointment["barber_id"])})
            barber_user = await db.users.find_one({"_id": ObjectId(barber_doc["user_id"])}) if barber_doc else None
            service = await db.services.find_one({"_id": ObjectId(appointment["service_id"])})
            
            if all([client, barber_user, service]):
                template_data = {
                    "client_name": client["name"],
                    "barber_name": barber_user["name"],
                    "service_name": service["name"]
                }
                
                await create_notification(
                    db,
                    appointment["client_id"],
                    "review_request",
                    template_data,
                    str(appointment["_id"])
                )
                
                # Mark as review request sent
                await db.appointments.update_one(
                    {"_id": appointment["_id"]},
                    {"$set": {"review_request_sent": True}}
                )
        
        logging.info(f"Sent review requests for {len(appointments)} appointments")
        
    except Exception as e:
        logging.error(f"Error sending review requests: {e}")

@router.post("/send-review-requests")
async def trigger_review_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Manually trigger review request sending (admin only)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ejecutar esta acción")
    
    try:
        await send_review_requests(db)
        return {"message": "Solicitudes de reseña enviadas"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))