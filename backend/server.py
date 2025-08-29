from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Annotated
import os
import bcrypt
import jwt
from bson import ObjectId
import logging
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "barbershop")
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-here")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Security
security = HTTPBearer()

app = FastAPI(title="Elite Barbershop API", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database dependency
async def get_database():
    return db

# Pydantic ObjectId handling
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v, handler=None):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId")
    
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.no_info_plain_validator_function(
            cls.validate,
            serialization=core_schema.to_string_ser_schema(),
        )

PyObjectIdAnnotation = Annotated[PyObjectId, Field()]

# Models
class UserRole:
    ADMIN = "admin"
    BARBER = "barber" 
    CLIENT = "client"

class AppointmentStatus:
    PENDING = "pending"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class User(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
    
    id: Optional[PyObjectIdAnnotation] = Field(alias="_id", default=None)
    phone: str
    name: str
    email: Optional[str] = None
    role: str = UserRole.CLIENT
    password_hash: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True

class UserCreate(BaseModel):
    phone: str
    name: str
    email: Optional[str] = None
    password: str
    role: str = UserRole.CLIENT

class UserLogin(BaseModel):
    phone: str
    password: str

class Barber(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
    
    id: Optional[PyObjectIdAnnotation] = Field(alias="_id", default=None)
    user_id: str
    specialties: List[str] = []
    bio: Optional[str] = None
    avatar_base64: Optional[str] = None
    schedule: Dict[str, Dict[str, str]] = Field(default_factory=dict)
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class BarberCreate(BaseModel):
    user_id: str
    specialties: List[str] = []
    bio: Optional[str] = None
    avatar_base64: Optional[str] = None
    schedule: Dict[str, Dict[str, str]] = Field(default_factory=dict)

class Service(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
    
    id: Optional[PyObjectIdAnnotation] = Field(alias="_id", default=None)
    name: str
    description: Optional[str] = None
    duration_minutes: int
    price: float
    category: Optional[str] = None
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int
    price: float
    category: Optional[str] = None

class Appointment(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
    
    id: Optional[PyObjectIdAnnotation] = Field(alias="_id", default=None)
    client_id: str
    barber_id: str
    service_id: str
    scheduled_at: datetime
    status: str = AppointmentStatus.PENDING
    notes: Optional[str] = None
    total_price: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AppointmentCreate(BaseModel):
    client_id: str
    barber_id: str
    service_id: str
    scheduled_at: datetime
    notes: Optional[str] = None

# Auth helpers
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    return jwt.encode(data, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**user)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Auth Routes
@app.post("/api/auth/register")
async def register_user(user_data: UserCreate):
    # Check if user already exists
    existing_user = await db.users.find_one({"phone": user_data.phone})
    if existing_user:
        raise HTTPException(status_code=400, detail="Usuario ya registrado con este teléfono")
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    user_dict = user_data.dict()
    user_dict["password_hash"] = hashed_password
    del user_dict["password"]
    user_dict["created_at"] = datetime.utcnow()
    
    result = await db.users.insert_one(user_dict)
    
    # Create barber profile if role is barber
    if user_data.role == UserRole.BARBER:
        barber_data = {
            "user_id": str(result.inserted_id),
            "specialties": [],
            "schedule": {},
            "active": True,
            "created_at": datetime.utcnow()
        }
        await db.barbers.insert_one(barber_data)
    
    # Generate token
    token = create_access_token({"sub": str(result.inserted_id)})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(result.inserted_id),
            "phone": user_data.phone,
            "name": user_data.name,
            "role": user_data.role
        }
    }

@app.post("/api/auth/login")
async def login_user(user_data: UserLogin):
    user = await db.users.find_one({"phone": user_data.phone})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Teléfono o contraseña incorrectos")
    
    if not user.get("active", True):
        raise HTTPException(status_code=401, detail="Cuenta desactivada")
    
    token = create_access_token({"sub": str(user["_id"])})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "phone": user["phone"],
            "name": user["name"],
            "role": user["role"]
        }
    }

# User Routes
@app.get("/api/users/profile")
async def get_user_profile(current_user: User = Depends(get_current_user)):
    user_dict = {
        "id": str(current_user.id),
        "phone": current_user.phone,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "created_at": current_user.created_at,
        "active": current_user.active
    }
    return user_dict

# Barber Routes
@app.get("/api/barbers", response_model=List[Dict[str, Any]])
async def get_barbers():
    barbers = []
    async for barber_doc in db.barbers.find({"active": True}):
        # Get user info for the barber
        user = await db.users.find_one({"_id": ObjectId(barber_doc["user_id"])})
        if user:
            barber_info = {
                "id": str(barber_doc["_id"]),
                "name": user["name"],
                "specialties": barber_doc.get("specialties", []),
                "bio": barber_doc.get("bio"),
                "avatar_base64": barber_doc.get("avatar_base64"),
                "schedule": barber_doc.get("schedule", {}),
                "user_id": str(user["_id"])
            }
            barbers.append(barber_info)
    return barbers

@app.get("/api/barbers/{barber_id}")
async def get_barber_by_id(barber_id: str):
    try:
        barber = await db.barbers.find_one({"_id": ObjectId(barber_id)})
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")
        
        user = await db.users.find_one({"_id": ObjectId(barber["user_id"])})
        if not user:
            raise HTTPException(status_code=404, detail="Usuario del barbero no encontrado")
        
        return {
            "id": str(barber["_id"]),
            "name": user["name"],
            "specialties": barber.get("specialties", []),
            "bio": barber.get("bio"),
            "avatar_base64": barber.get("avatar_base64"),
            "schedule": barber.get("schedule", {}),
            "user_id": str(user["_id"])
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/barbers/{barber_id}")
async def update_barber(barber_id: str, barber_data: BarberCreate, current_user: User = Depends(get_current_user)):
    try:
        # Check if user is admin or the barber themselves
        if current_user.role != UserRole.ADMIN:
            barber = await db.barbers.find_one({"_id": ObjectId(barber_id)})
            if not barber or barber["user_id"] != str(current_user.id):
                raise HTTPException(status_code=403, detail="No autorizado")
        
        update_data = barber_data.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        result = await db.barbers.update_one(
            {"_id": ObjectId(barber_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")
        
        return {"message": "Barbero actualizado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Service Routes
@app.get("/api/services")
async def get_services():
    services = []
    async for service_doc in db.services.find({"active": True}):
        service_dict = dict(service_doc)
        service_dict["id"] = str(service_dict.pop("_id"))
        services.append(service_dict)
    return services

@app.post("/api/services")
async def create_service(service_data: ServiceCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden crear servicios")
    
    service_dict = service_data.dict()
    service_dict["created_at"] = datetime.utcnow()
    service_dict["active"] = True   

    result = await db.services.insert_one(service_dict)
    service_dict["id"] = str(result.inserted_id)
    service_dict.pop("_id", None)
    return service_dict


@app.put("/api/services/{service_id}")
async def update_service(service_id: str, service_data: ServiceCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden actualizar servicios")
    
    try:
        update_data = service_data.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        result = await db.services.update_one(
            {"_id": ObjectId(service_id)},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")
        
        return {"message": "Servicio actualizado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Appointment Routes
@app.post("/api/appointments")
async def create_appointment(appointment_data: AppointmentCreate, current_user: User = Depends(get_current_user)):
    try:
        # Get service to calculate price
        service = await db.services.find_one({"_id": ObjectId(appointment_data.service_id)})
        if not service:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")
        
        # Check if barber exists
        barber = await db.barbers.find_one({"_id": ObjectId(appointment_data.barber_id)})
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")
        
        # Check for conflicting appointments
        appointment_end = appointment_data.scheduled_at + timedelta(minutes=service["duration_minutes"])
        
        existing_appointment = await db.appointments.find_one({
            "barber_id": appointment_data.barber_id,
            "scheduled_at": {
                "$lt": appointment_end
            },
            "status": {"$in": [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]},
            "$expr": {
                "$gt": [
                    {"$add": ["$scheduled_at", {"$multiply": ["$duration_minutes", 60000]}]},
                    appointment_data.scheduled_at
                ]
            }
        })
        
        if existing_appointment:
            raise HTTPException(status_code=400, detail="El barbero no está disponible en ese horario")
        
        # Create appointment
        appointment_dict = appointment_data.dict()
        appointment_dict["total_price"] = service["price"]
        appointment_dict["created_at"] = datetime.utcnow()
        appointment_dict["status"] = AppointmentStatus.PENDING
        
        result = await db.appointments.insert_one(appointment_dict)
        appointment_dict["id"] = str(result.inserted_id)
        appointment_dict.pop("_id", None)
        
        return appointment_dict
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/appointments")
async def get_appointments(current_user: User = Depends(get_current_user)):
    try:
        appointments = []
        
        # Build query based on user role
        query = {}
        if current_user.role == UserRole.CLIENT:
            query["client_id"] = str(current_user.id)
        elif current_user.role == UserRole.BARBER:
            # Get barber profile
            barber = await db.barbers.find_one({"user_id": str(current_user.id)})
            if barber:
                query["barber_id"] = str(barber["_id"])
        # Admin gets all appointments
        
        async for appointment_doc in db.appointments.find(query).sort("scheduled_at", 1):
            # Get related data
            client = await db.users.find_one({"_id": ObjectId(appointment_doc["client_id"])})
            barber_profile = await db.barbers.find_one({"_id": ObjectId(appointment_doc["barber_id"])})
            barber_user = await db.users.find_one({"_id": ObjectId(barber_profile["user_id"])}) if barber_profile else None
            service = await db.services.find_one({"_id": ObjectId(appointment_doc["service_id"])})
            
            appointment_info = {
                "id": str(appointment_doc["_id"]),
                "client_name": client["name"] if client else "Cliente no encontrado",
                "barber_name": barber_user["name"] if barber_user else "Barbero no encontrado",
                "service_name": service["name"] if service else "Servicio no encontrado",
                "scheduled_at": appointment_doc["scheduled_at"],
                "status": appointment_doc["status"],
                "total_price": appointment_doc["total_price"],
                "notes": appointment_doc.get("notes"),
                "duration_minutes": service["duration_minutes"] if service else 0
            }
            appointments.append(appointment_info)
        
        return appointments
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/appointments/{appointment_id}/status")
async def update_appointment_status(appointment_id: str, status_data: dict, current_user: User = Depends(get_current_user)):
    try:
        status = status_data.get("status")
        if not status:
            raise HTTPException(status_code=400, detail="Status is required")
            
        # Validate status
        valid_statuses = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED]
        if status not in valid_statuses:
            raise HTTPException(status_code=400, detail="Estado inválido")
        
        # Check authorization
        appointment = await db.appointments.find_one({"_id": ObjectId(appointment_id)})
        if not appointment:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        
        # Only admin, barber, or client can update
        can_update = False
        if current_user.role == UserRole.ADMIN:
            can_update = True
        elif current_user.role == UserRole.CLIENT and appointment["client_id"] == str(current_user.id):
            can_update = True
        elif current_user.role == UserRole.BARBER:
            barber = await db.barbers.find_one({"user_id": str(current_user.id)})
            if barber and appointment["barber_id"] == str(barber["_id"]):
                can_update = True
        
        if not can_update:
            raise HTTPException(status_code=403, detail="No autorizado")
        
        # Update appointment
        result = await db.appointments.update_one(
            {"_id": ObjectId(appointment_id)},
            {"$set": {"status": status, "updated_at": datetime.utcnow()}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Cita no encontrada")
        
        return {"message": f"Estado de cita actualizado a {status}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Availability Routes
@app.get("/api/barbers/{barber_id}/availability")
async def get_barber_availability(barber_id: str, date: str):
    try:
        # Parse date
        target_date = datetime.fromisoformat(date.replace('Z', '+00:00')).date()
        
        # Get barber schedule
        barber = await db.barbers.find_one({"_id": ObjectId(barber_id)})
        if not barber:
            raise HTTPException(status_code=404, detail="Barbero no encontrado")
        
        # Get day of week
        day_name = target_date.strftime("%A").lower()
        day_schedule = barber.get("schedule", {}).get(day_name)
        
        if not day_schedule:
            return {"available_slots": []}
        
        # Get existing appointments for that day
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date, datetime.max.time())
        
        appointments = []
        async for appointment in db.appointments.find({
            "barber_id": barber_id,
            "scheduled_at": {"$gte": start_of_day, "$lte": end_of_day},
            "status": {"$in": [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]}
        }):
            # Get service duration
            service = await db.services.find_one({"_id": ObjectId(appointment["service_id"])})
            duration = service["duration_minutes"] if service else 60
            
            appointments.append({
                "start": appointment["scheduled_at"],
                "end": appointment["scheduled_at"] + timedelta(minutes=duration)
            })
        
        # Generate available slots (every 30 minutes)
        available_slots = []
        start_time = datetime.strptime(day_schedule["start"], "%H:%M").time()
        end_time = datetime.strptime(day_schedule["end"], "%H:%M").time()
        
        current_slot = datetime.combine(target_date, start_time)
        end_datetime = datetime.combine(target_date, end_time)
        
        while current_slot < end_datetime:
            # Check if slot conflicts with existing appointments
            slot_end = current_slot + timedelta(minutes=30)
            
            is_available = True
            for appointment in appointments:
                if (current_slot < appointment["end"] and slot_end > appointment["start"]):
                    is_available = False
                    break
            
            if is_available and current_slot > datetime.now():
                available_slots.append(current_slot.isoformat())
            
            current_slot += timedelta(minutes=30)
        
        return {"available_slots": available_slots}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Initialize default data
@app.on_event("startup")
async def startup_db():
    # Create default admin user if not exists
    admin_user = await db.users.find_one({"role": UserRole.ADMIN})
    if not admin_user:
        admin_data = {
            "phone": "+1234567890",
            "name": "Admin",
            "email": "admin@barbershop.com",
            "role": UserRole.ADMIN,
            "password_hash": hash_password("admin123"),
            "created_at": datetime.utcnow(),
            "active": True
        }
        await db.users.insert_one(admin_data)
        logging.info("Default admin user created: phone=+1234567890, password=admin123")
    
    # Create default services if not exists
    service_count = await db.services.count_documents({})
    if service_count == 0:
        default_services = [
            {"name": "Corte de Cabello", "description": "Corte tradicional masculino", "duration_minutes": 30, "price": 25.0, "category": "corte", "active": True, "created_at": datetime.utcnow()},
            {"name": "Corte + Barba", "description": "Corte de cabello con arreglo de barba", "duration_minutes": 45, "price": 35.0, "category": "completo", "active": True, "created_at": datetime.utcnow()},
            {"name": "Solo Barba", "description": "Arreglo y perfilado de barba", "duration_minutes": 20, "price": 15.0, "category": "barba", "active": True, "created_at": datetime.utcnow()},
            {"name": "Paquete Premium", "description": "Corte + Barba + Tratamiento", "duration_minutes": 60, "price": 50.0, "category": "premium", "active": True, "created_at": datetime.utcnow()}
        ]
        await db.services.insert_many(default_services)
        logging.info("Default services created")

# Include new routers
try:
    from analytics import router as analytics_router
    from reviews import router as reviews_router
    from notifications import router as notifications_router
    from whatsapp_routes import router as whatsapp_router
    
    app.include_router(analytics_router)
    app.include_router(reviews_router)
    app.include_router(notifications_router)
    app.include_router(whatsapp_router)
    
    logging.info("New feature routers loaded successfully")
except ImportError as e:
    logging.warning(f"Could not load feature routers: {e}")

@app.on_event("shutdown")
async def shutdown_db():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)