from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List, Optional, Dict, Any, Annotated
from bson import ObjectId

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

# Reviews and Ratings Model
class Review(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
    
    id: Optional[PyObjectIdAnnotation] = Field(alias="_id", default=None)
    client_id: str
    barber_id: str
    service_id: str
    appointment_id: str
    rating: int = Field(..., ge=1, le=5)  # 1-5 stars
    comment: Optional[str] = None
    service_quality: int = Field(..., ge=1, le=5)
    barber_skill: int = Field(..., ge=1, le=5)
    cleanliness: int = Field(..., ge=1, le=5)
    value_for_money: int = Field(..., ge=1, le=5)
    would_recommend: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

class ReviewCreate(BaseModel):
    appointment_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    service_quality: int = Field(..., ge=1, le=5)
    barber_skill: int = Field(..., ge=1, le=5)
    cleanliness: int = Field(..., ge=1, le=5)
    value_for_money: int = Field(..., ge=1, le=5)
    would_recommend: bool = True

# Analytics Models
class BusinessMetrics(BaseModel):
    total_appointments: int
    completed_appointments: int
    cancelled_appointments: int
    total_revenue: float
    average_rating: float
    total_reviews: int
    new_clients: int
    returning_clients: int
    popular_services: List[Dict[str, Any]]
    top_barbers: List[Dict[str, Any]]
    period_start: datetime
    period_end: datetime

class BarberPerformance(BaseModel):
    barber_id: str
    barber_name: str
    total_appointments: int
    completed_appointments: int
    total_revenue: float
    average_rating: float
    total_reviews: int
    specialties: List[str]
    client_retention_rate: float

class ServiceAnalytics(BaseModel):
    service_id: str
    service_name: str
    total_bookings: int
    total_revenue: float
    average_rating: float
    total_reviews: int
    duration_minutes: int
    price: float
    popularity_rank: int

# Notification Models
class NotificationTemplate(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
    
    id: Optional[PyObjectIdAnnotation] = Field(alias="_id", default=None)
    name: str
    type: str  # 'appointment_confirmed', 'appointment_reminder', 'appointment_cancelled', 'review_request'
    message_template: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Notification(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
    
    id: Optional[PyObjectIdAnnotation] = Field(alias="_id", default=None)
    user_id: str
    title: str
    message: str
    type: str  # 'appointment', 'reminder', 'review', 'promotion'
    data: Optional[Dict[str, Any]] = None
    is_read: bool = False
    sent_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str
    data: Optional[Dict[str, Any]] = None

# WhatsApp Integration Models
class WhatsAppMessage(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, populate_by_name=True)
    
    id: Optional[PyObjectIdAnnotation] = Field(alias="_id", default=None)
    to_phone: str
    message: str
    template_type: str
    status: str = "pending"  # pending, sent, delivered, failed
    appointment_id: Optional[str] = None
    sent_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class WhatsAppStatus(BaseModel):
    connected: bool
    phone_number: Optional[str] = None
    last_connection: Optional[datetime] = None
    qr_code: Optional[str] = None
    session_active: bool = False