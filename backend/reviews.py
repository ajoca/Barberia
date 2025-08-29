from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from models import Review, ReviewCreate
from database import get_database
from server import get_current_user, User, UserRole

router = APIRouter(prefix="/api/reviews", tags=["reviews"])

@router.post("/", response_model=dict)
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Create a new review for a completed appointment"""
    try:
        # Verify appointment exists and belongs to current user
        appointment = await db.appointments.find_one({
            "_id": ObjectId(review_data.appointment_id),
            "client_id": str(current_user.id),
            "status": "completed"
        })
        
        if not appointment:
            raise HTTPException(
                status_code=404, 
                detail="Cita no encontrada o no completada"
            )
        
        # Check if review already exists
        existing_review = await db.reviews.find_one({
            "appointment_id": review_data.appointment_id
        })
        
        if existing_review:
            raise HTTPException(
                status_code=400,
                detail="Ya has dejado una reseña para esta cita"
            )
        
        # Create review
        review_dict = review_data.dict()
        review_dict.update({
            "client_id": str(current_user.id),
            "barber_id": appointment["barber_id"],
            "service_id": appointment["service_id"],
            "created_at": datetime.utcnow()
        })
        
        result = await db.reviews.insert_one(review_dict)
        
        # Update appointment to mark as reviewed
        await db.appointments.update_one(
            {"_id": ObjectId(review_data.appointment_id)},
            {"$set": {"reviewed": True, "reviewed_at": datetime.utcnow()}}
        )
        
        return {
            "id": str(result.inserted_id),
            "message": "Reseña creada exitosamente",
            "rating": review_data.rating
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[dict])
async def get_reviews(
    barber_id: Optional[str] = Query(None, description="Filter by barber ID"),
    service_id: Optional[str] = Query(None, description="Filter by service ID"),
    limit: int = Query(20, description="Number of reviews to return"),
    skip: int = Query(0, description="Number of reviews to skip"),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get reviews with optional filters"""
    try:
        # Build filter query
        query = {}
        if barber_id:
            query["barber_id"] = barber_id
        if service_id:
            query["service_id"] = service_id
        
        # Get reviews
        reviews_cursor = db.reviews.find(query).sort("created_at", -1).skip(skip).limit(limit)
        reviews = await reviews_cursor.to_list(length=limit)
        
        # Enrich reviews with additional data
        enriched_reviews = []
        for review in reviews:
            # Get client info
            client = await db.users.find_one({"_id": ObjectId(review["client_id"])})
            
            # Get barber info
            barber_doc = await db.barbers.find_one({"_id": ObjectId(review["barber_id"])})
            barber_user = None
            if barber_doc:
                barber_user = await db.users.find_one({"_id": ObjectId(barber_doc["user_id"])})
            
            # Get service info
            service = await db.services.find_one({"_id": ObjectId(review["service_id"])})
            
            enriched_review = {
                "id": str(review["_id"]),
                "rating": review["rating"],
                "comment": review.get("comment"),
                "service_quality": review["service_quality"],
                "barber_skill": review["barber_skill"],
                "cleanliness": review["cleanliness"],
                "value_for_money": review["value_for_money"],
                "would_recommend": review["would_recommend"],
                "created_at": review["created_at"],
                "client_name": client["name"] if client else "Cliente",
                "client_initials": "".join([n[0].upper() for n in client["name"].split()[:2]]) if client else "C",
                "barber_name": barber_user["name"] if barber_user else "Barbero",
                "service_name": service["name"] if service else "Servicio"
            }
            
            enriched_reviews.append(enriched_review)
        
        return enriched_reviews
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/barber/{barber_id}/stats")
async def get_barber_review_stats(
    barber_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get review statistics for a specific barber"""
    try:
        # Get all reviews for this barber
        reviews = await db.reviews.find({"barber_id": barber_id}).to_list(length=None)
        
        if not reviews:
            return {
                "total_reviews": 0,
                "average_rating": 0,
                "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                "average_scores": {
                    "service_quality": 0,
                    "barber_skill": 0,
                    "cleanliness": 0,
                    "value_for_money": 0
                },
                "recommendation_rate": 0
            }
        
        total_reviews = len(reviews)
        ratings = [r["rating"] for r in reviews]
        average_rating = sum(ratings) / total_reviews
        
        # Rating distribution
        rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for rating in ratings:
            rating_distribution[rating] += 1
        
        # Average scores for different aspects
        average_scores = {
            "service_quality": sum(r["service_quality"] for r in reviews) / total_reviews,
            "barber_skill": sum(r["barber_skill"] for r in reviews) / total_reviews,
            "cleanliness": sum(r["cleanliness"] for r in reviews) / total_reviews,
            "value_for_money": sum(r["value_for_money"] for r in reviews) / total_reviews
        }
        
        # Recommendation rate
        recommendations = sum(1 for r in reviews if r["would_recommend"])
        recommendation_rate = (recommendations / total_reviews) * 100
        
        return {
            "total_reviews": total_reviews,
            "average_rating": round(average_rating, 1),
            "rating_distribution": rating_distribution,
            "average_scores": {k: round(v, 1) for k, v in average_scores.items()},
            "recommendation_rate": round(recommendation_rate, 1)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/service/{service_id}/stats")
async def get_service_review_stats(
    service_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get review statistics for a specific service"""
    try:
        # Get all reviews for this service
        reviews = await db.reviews.find({"service_id": service_id}).to_list(length=None)
        
        if not reviews:
            return {
                "total_reviews": 0,
                "average_rating": 0,
                "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
                "recommendation_rate": 0
            }
        
        total_reviews = len(reviews)
        ratings = [r["rating"] for r in reviews]
        average_rating = sum(ratings) / total_reviews
        
        # Rating distribution
        rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for rating in ratings:
            rating_distribution[rating] += 1
        
        # Recommendation rate
        recommendations = sum(1 for r in reviews if r["would_recommend"])
        recommendation_rate = (recommendations / total_reviews) * 100
        
        return {
            "total_reviews": total_reviews,
            "average_rating": round(average_rating, 1),
            "rating_distribution": rating_distribution,
            "recommendation_rate": round(recommendation_rate, 1)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/my-reviews")
async def get_my_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get reviews written by the current user"""
    try:
        reviews = await db.reviews.find({
            "client_id": str(current_user.id)
        }).sort("created_at", -1).to_list(length=None)
        
        # Enrich with appointment and service data
        enriched_reviews = []
        for review in reviews:
            # Get appointment info
            appointment = await db.appointments.find_one({
                "_id": ObjectId(review["appointment_id"])
            })
            
            # Get service info
            service = await db.services.find_one({
                "_id": ObjectId(review["service_id"])
            })
            
            # Get barber info
            barber_doc = await db.barbers.find_one({
                "_id": ObjectId(review["barber_id"])
            })
            barber_user = None
            if barber_doc:
                barber_user = await db.users.find_one({
                    "_id": ObjectId(barber_doc["user_id"])
                })
            
            enriched_review = {
                "id": str(review["_id"]),
                "appointment_id": review["appointment_id"],
                "rating": review["rating"],
                "comment": review.get("comment"),
                "service_quality": review["service_quality"],
                "barber_skill": review["barber_skill"],
                "cleanliness": review["cleanliness"],
                "value_for_money": review["value_for_money"],
                "would_recommend": review["would_recommend"],
                "created_at": review["created_at"],
                "service_name": service["name"] if service else "Servicio",
                "barber_name": barber_user["name"] if barber_user else "Barbero",
                "appointment_date": appointment["scheduled_at"] if appointment else None
            }
            
            enriched_reviews.append(enriched_review)
        
        return enriched_reviews
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/pending-reviews")
async def get_pending_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get completed appointments that haven't been reviewed yet"""
    try:
        # Get completed appointments without reviews
        completed_appointments = await db.appointments.find({
            "client_id": str(current_user.id),
            "status": "completed",
            "reviewed": {"$ne": True}
        }).sort("scheduled_at", -1).to_list(length=None)
        
        pending_reviews = []
        for appointment in completed_appointments:
            # Get service info
            service = await db.services.find_one({
                "_id": ObjectId(appointment["service_id"])
            })
            
            # Get barber info
            barber_doc = await db.barbers.find_one({
                "_id": ObjectId(appointment["barber_id"])
            })
            barber_user = None
            if barber_doc:
                barber_user = await db.users.find_one({
                    "_id": ObjectId(barber_doc["user_id"])
                })
            
            pending_reviews.append({
                "appointment_id": str(appointment["_id"]),
                "service_name": service["name"] if service else "Servicio",
                "barber_name": barber_user["name"] if barber_user else "Barbero",
                "scheduled_at": appointment["scheduled_at"],
                "total_price": appointment["total_price"],
                "days_since_appointment": (datetime.utcnow() - appointment["scheduled_at"]).days
            })
        
        return pending_reviews
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{review_id}")
async def update_review(
    review_id: str,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update an existing review"""
    try:
        # Verify review belongs to current user
        review = await db.reviews.find_one({
            "_id": ObjectId(review_id),
            "client_id": str(current_user.id)
        })
        
        if not review:
            raise HTTPException(
                status_code=404,
                detail="Reseña no encontrada"
            )
        
        # Update review
        update_data = review_data.dict()
        update_data["updated_at"] = datetime.utcnow()
        
        await db.reviews.update_one(
            {"_id": ObjectId(review_id)},
            {"$set": update_data}
        )
        
        return {"message": "Reseña actualizada exitosamente"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{review_id}")
async def delete_review(
    review_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Delete a review (admin only or review owner)"""
    try:
        # Get review
        review = await db.reviews.find_one({"_id": ObjectId(review_id)})
        
        if not review:
            raise HTTPException(status_code=404, detail="Reseña no encontrada")
        
        # Check permissions
        if current_user.role != UserRole.ADMIN and review["client_id"] != str(current_user.id):
            raise HTTPException(status_code=403, detail="No tienes permisos para eliminar esta reseña")
        
        # Delete review
        await db.reviews.delete_one({"_id": ObjectId(review_id)})
        
        # Update appointment
        await db.appointments.update_one(
            {"_id": ObjectId(review["appointment_id"])},
            {"$unset": {"reviewed": "", "reviewed_at": ""}}
        )
        
        return {"message": "Reseña eliminada exitosamente"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))