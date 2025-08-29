from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timedelta
from typing import List, Optional
import asyncio
from motor.motor_asyncio import AsyncIOMotorDatabase

from models import BusinessMetrics, BarberPerformance, ServiceAnalytics
from database import get_database
from server import get_current_user, User, UserRole

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/business-metrics", response_model=BusinessMetrics)
async def get_business_metrics(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get comprehensive business metrics"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver métricas")
    
    # Default to last 30 days if no dates provided
    if not end_date:
        end_dt = datetime.utcnow()
    else:
        end_dt = datetime.fromisoformat(end_date)
    
    if not start_date:
        start_dt = end_dt - timedelta(days=30)
    else:
        start_dt = datetime.fromisoformat(start_date)
    
    # Get appointments in date range
    appointments_cursor = db.appointments.find({
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    })
    appointments = await appointments_cursor.to_list(length=None)
    
    # Calculate basic metrics
    total_appointments = len(appointments)
    completed_appointments = len([a for a in appointments if a["status"] == "completed"])
    cancelled_appointments = len([a for a in appointments if a["status"] == "cancelled"])
    
    # Calculate revenue
    completed_appointments_list = [a for a in appointments if a["status"] == "completed"]
    total_revenue = sum(a.get("total_price", 0) for a in completed_appointments_list)
    
    # Get reviews in date range
    reviews_cursor = db.reviews.find({
        "created_at": {"$gte": start_dt, "$lte": end_dt}
    })
    reviews = await reviews_cursor.to_list(length=None)
    
    total_reviews = len(reviews)
    average_rating = sum(r.get("rating", 0) for r in reviews) / total_reviews if total_reviews > 0 else 0
    
    # Get unique clients
    unique_clients = set(a["client_id"] for a in appointments)
    
    # Calculate new vs returning clients
    all_time_appointments = await db.appointments.find({
        "created_at": {"$lt": start_dt}
    }).to_list(length=None)
    
    previous_clients = set(a["client_id"] for a in all_time_appointments)
    new_clients = len([c for c in unique_clients if c not in previous_clients])
    returning_clients = len([c for c in unique_clients if c in previous_clients])
    
    # Get popular services
    service_bookings = {}
    for appointment in appointments:
        service_id = appointment.get("service_id")
        if service_id:
            service_bookings[service_id] = service_bookings.get(service_id, 0) + 1
    
    popular_services = []
    for service_id, count in sorted(service_bookings.items(), key=lambda x: x[1], reverse=True)[:5]:
        service = await db.services.find_one({"_id": service_id})
        if service:
            popular_services.append({
                "service_id": str(service["_id"]),
                "service_name": service["name"],
                "bookings": count,
                "revenue": sum(a.get("total_price", 0) for a in appointments 
                             if a.get("service_id") == service_id and a["status"] == "completed")
            })
    
    # Get top barbers
    barber_performance = {}
    for appointment in completed_appointments_list:
        barber_id = appointment.get("barber_id")
        if barber_id:
            if barber_id not in barber_performance:
                barber_performance[barber_id] = {
                    "appointments": 0,
                    "revenue": 0,
                    "ratings": []
                }
            barber_performance[barber_id]["appointments"] += 1
            barber_performance[barber_id]["revenue"] += appointment.get("total_price", 0)
    
    # Add ratings to barber performance
    for review in reviews:
        barber_id = review.get("barber_id")
        if barber_id in barber_performance:
            barber_performance[barber_id]["ratings"].append(review.get("rating", 0))
    
    top_barbers = []
    for barber_id, perf in sorted(barber_performance.items(), key=lambda x: x[1]["revenue"], reverse=True)[:5]:
        barber = await db.barbers.find_one({"_id": barber_id})
        if barber:
            user = await db.users.find_one({"_id": barber["user_id"]})
            avg_rating = sum(perf["ratings"]) / len(perf["ratings"]) if perf["ratings"] else 0
            top_barbers.append({
                "barber_id": str(barber["_id"]),
                "barber_name": user["name"] if user else "Unknown",
                "appointments": perf["appointments"],
                "revenue": perf["revenue"],
                "average_rating": round(avg_rating, 1),
                "total_reviews": len(perf["ratings"])
            })
    
    return BusinessMetrics(
        total_appointments=total_appointments,
        completed_appointments=completed_appointments,
        cancelled_appointments=cancelled_appointments,
        total_revenue=total_revenue,
        average_rating=round(average_rating, 1),
        total_reviews=total_reviews,
        new_clients=new_clients,
        returning_clients=returning_clients,
        popular_services=popular_services,
        top_barbers=top_barbers,
        period_start=start_dt,
        period_end=end_dt
    )

@router.get("/barber-performance", response_model=List[BarberPerformance])
async def get_barber_performance(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get detailed barber performance metrics"""
    if current_user.role not in [UserRole.ADMIN, UserRole.BARBER]:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta información")
    
    # Default to last 30 days
    if not end_date:
        end_dt = datetime.utcnow()
    else:
        end_dt = datetime.fromisoformat(end_date)
    
    if not start_date:
        start_dt = end_dt - timedelta(days=30)
    else:
        start_dt = datetime.fromisoformat(start_date)
    
    # Get all barbers or just current barber
    if current_user.role == UserRole.BARBER:
        barber = await db.barbers.find_one({"user_id": str(current_user.id)})
        barbers = [barber] if barber else []
    else:
        barbers = await db.barbers.find({"active": True}).to_list(length=None)
    
    performance_data = []
    
    for barber in barbers:
        barber_id = str(barber["_id"])
        
        # Get appointments for this barber
        appointments = await db.appointments.find({
            "barber_id": barber_id,
            "created_at": {"$gte": start_dt, "$lte": end_dt}
        }).to_list(length=None)
        
        total_appointments = len(appointments)
        completed_appointments = len([a for a in appointments if a["status"] == "completed"])
        total_revenue = sum(a.get("total_price", 0) for a in appointments if a["status"] == "completed")
        
        # Get reviews for this barber
        reviews = await db.reviews.find({
            "barber_id": barber_id,
            "created_at": {"$gte": start_dt, "$lte": end_dt}
        }).to_list(length=None)
        
        total_reviews = len(reviews)
        average_rating = sum(r.get("rating", 0) for r in reviews) / total_reviews if total_reviews > 0 else 0
        
        # Calculate client retention rate
        unique_clients = set(a["client_id"] for a in appointments)
        returning_clients = 0
        for client_id in unique_clients:
            previous_appointments = await db.appointments.count_documents({
                "client_id": client_id,
                "barber_id": barber_id,
                "created_at": {"$lt": start_dt}
            })
            if previous_appointments > 0:
                returning_clients += 1
        
        retention_rate = (returning_clients / len(unique_clients)) * 100 if unique_clients else 0
        
        # Get barber user info
        user = await db.users.find_one({"_id": barber["user_id"]})
        
        performance_data.append(BarberPerformance(
            barber_id=barber_id,
            barber_name=user["name"] if user else "Unknown",
            total_appointments=total_appointments,
            completed_appointments=completed_appointments,
            total_revenue=total_revenue,
            average_rating=round(average_rating, 1),
            total_reviews=total_reviews,
            specialties=barber.get("specialties", []),
            client_retention_rate=round(retention_rate, 1)
        ))
    
    return performance_data

@router.get("/service-analytics", response_model=List[ServiceAnalytics])
async def get_service_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get detailed service performance analytics"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver analytics de servicios")
    
    # Default to last 30 days
    if not end_date:
        end_dt = datetime.utcnow()
    else:
        end_dt = datetime.fromisoformat(end_date)
    
    if not start_date:
        start_dt = end_dt - timedelta(days=30)
    else:
        start_dt = datetime.fromisoformat(start_date)
    
    # Get all active services
    services = await db.services.find({"active": True}).to_list(length=None)
    service_analytics = []
    
    for i, service in enumerate(services):
        service_id = str(service["_id"])
        
        # Get appointments for this service
        appointments = await db.appointments.find({
            "service_id": service_id,
            "created_at": {"$gte": start_dt, "$lte": end_dt}
        }).to_list(length=None)
        
        total_bookings = len(appointments)
        completed_bookings = [a for a in appointments if a["status"] == "completed"]
        total_revenue = sum(a.get("total_price", 0) for a in completed_bookings)
        
        # Get reviews for this service
        reviews = await db.reviews.find({
            "service_id": service_id,
            "created_at": {"$gte": start_dt, "$lte": end_dt}
        }).to_list(length=None)
        
        total_reviews = len(reviews)
        average_rating = sum(r.get("rating", 0) for r in reviews) / total_reviews if total_reviews > 0 else 0
        
        service_analytics.append(ServiceAnalytics(
            service_id=service_id,
            service_name=service["name"],
            total_bookings=total_bookings,
            total_revenue=total_revenue,
            average_rating=round(average_rating, 1),
            total_reviews=total_reviews,
            duration_minutes=service["duration_minutes"],
            price=service["price"],
            popularity_rank=i + 1  # Will be sorted later
        ))
    
    # Sort by total bookings and update popularity rank
    service_analytics.sort(key=lambda x: x.total_bookings, reverse=True)
    for i, service in enumerate(service_analytics):
        service.popularity_rank = i + 1
    
    return service_analytics

@router.get("/revenue-chart")
async def get_revenue_chart(
    days: int = Query(30, description="Number of days to analyze"),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get daily revenue data for charts"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver datos de ingresos")
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get completed appointments in date range
    appointments = await db.appointments.find({
        "status": "completed",
        "scheduled_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(length=None)
    
    # Group by date
    daily_revenue = {}
    for appointment in appointments:
        date_key = appointment["scheduled_at"].strftime("%Y-%m-%d")
        daily_revenue[date_key] = daily_revenue.get(date_key, 0) + appointment.get("total_price", 0)
    
    # Fill missing dates with 0
    current_date = start_date
    chart_data = []
    
    while current_date <= end_date:
        date_key = current_date.strftime("%Y-%m-%d")
        chart_data.append({
            "date": date_key,
            "revenue": daily_revenue.get(date_key, 0),
            "day_name": current_date.strftime("%A")
        })
        current_date += timedelta(days=1)
    
    return {
        "data": chart_data,
        "total_revenue": sum(daily_revenue.values()),
        "average_daily": sum(daily_revenue.values()) / len(chart_data) if chart_data else 0,
        "period_days": days
    }

@router.get("/revenue-by-period")
async def get_revenue_by_period(
    period: str = Query("day", description="Period: day, month, year"),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get revenue grouped by day, month, or year"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver datos de ingresos")
    
    # Define date ranges based on period
    now = datetime.utcnow()
    if period == "day":
        # Last 30 days
        start_date = now - timedelta(days=30)
        date_format = "%Y-%m-%d"
        group_format = lambda d: d.strftime("%Y-%m-%d")
    elif period == "month":
        # Last 12 months
        start_date = now - timedelta(days=365)
        date_format = "%Y-%m"
        group_format = lambda d: d.strftime("%Y-%m")
    elif period == "year":
        # Last 5 years
        start_date = now - timedelta(days=1825)  # 5 years
        date_format = "%Y"
        group_format = lambda d: d.strftime("%Y")
    else:
        raise HTTPException(status_code=400, detail="Período inválido. Use: day, month, year")
    
    # Get completed appointments
    appointments = await db.appointments.find({
        "status": "completed",
        "scheduled_at": {"$gte": start_date, "$lte": now}
    }).to_list(length=None)
    
    # Group revenue by period
    revenue_by_period = {}
    for appointment in appointments:
        period_key = group_format(appointment["scheduled_at"])
        revenue_by_period[period_key] = revenue_by_period.get(period_key, 0) + appointment.get("total_price", 0)
    
    # Convert to sorted list
    period_data = []
    for period_key, revenue in sorted(revenue_by_period.items()):
        period_data.append({
            "period": period_key,
            "revenue": revenue,
            "formatted_revenue": f"${revenue:,.2f}"
        })
    
    total_revenue = sum(revenue_by_period.values())
    
    return {
        "period_type": period,
        "data": period_data,
        "total_revenue": total_revenue,
        "formatted_total": f"${total_revenue:,.2f}",
        "period_count": len(period_data)
    }

@router.get("/weekday-analysis")
async def get_weekday_analysis(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Analyze which days of the week generate more revenue and appointments"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver análisis de días")
    
    # Get all completed appointments
    appointments = await db.appointments.find({
        "status": "completed"
    }).to_list(length=None)
    
    # Spanish day names
    day_names = {
        0: "Lunes",
        1: "Martes", 
        2: "Miércoles",
        3: "Jueves",
        4: "Viernes",
        5: "Sábado",
        6: "Domingo"
    }
    
    # Group by weekday
    weekday_data = {}
    for i in range(7):
        weekday_data[i] = {
            "day_name": day_names[i],
            "appointments": 0,
            "revenue": 0
        }
    
    for appointment in appointments:
        weekday = appointment["scheduled_at"].weekday()
        weekday_data[weekday]["appointments"] += 1
        weekday_data[weekday]["revenue"] += appointment.get("total_price", 0)
    
    # Convert to sorted list by revenue
    weekday_list = []
    for weekday, data in weekday_data.items():
        avg_revenue = data["revenue"] / data["appointments"] if data["appointments"] > 0 else 0
        weekday_list.append({
            "weekday": weekday,
            "day_name": data["day_name"],
            "appointments": data["appointments"],
            "revenue": data["revenue"],
            "formatted_revenue": f"${data['revenue']:,.2f}",
            "average_revenue_per_appointment": avg_revenue,
            "percentage_of_total_appointments": (data["appointments"] / len(appointments)) * 100 if appointments else 0,
            "percentage_of_total_revenue": (data["revenue"] / sum(d["revenue"] for d in weekday_data.values())) * 100 if sum(d["revenue"] for d in weekday_data.values()) > 0 else 0
        })
    
    # Sort by revenue (highest first)
    weekday_list.sort(key=lambda x: x["revenue"], reverse=True)
    
    # Add ranking
    for i, day_data in enumerate(weekday_list):
        day_data["revenue_rank"] = i + 1
    
    # Sort by appointments (highest first) to get appointment ranking
    appointment_sorted = sorted(weekday_list, key=lambda x: x["appointments"], reverse=True)
    for i, day_data in enumerate(appointment_sorted):
        day_data["appointment_rank"] = i + 1
    
    # Get best and worst performing days
    best_revenue_day = weekday_list[0] if weekday_list else None
    worst_revenue_day = weekday_list[-1] if weekday_list else None
    
    best_appointment_day = max(weekday_list, key=lambda x: x["appointments"]) if weekday_list else None
    
    # Create recommendation message
    if best_revenue_day and worst_revenue_day:
        best_revenue_amount = f"${best_revenue_day['revenue']:,.2f}"
        message = f"El {best_revenue_day['day_name']} es tu día más rentable con {best_revenue_amount}. Considera promociones especiales para el {worst_revenue_day['day_name']}."
    else:
        message = "No hay suficientes datos para generar recomendaciones."
    
    return {
        "weekday_analysis": weekday_list,
        "summary": {
            "best_revenue_day": best_revenue_day["day_name"] if best_revenue_day else None,
            "best_revenue_amount": best_revenue_day["revenue"] if best_revenue_day else 0,
            "best_appointments_day": best_appointment_day["day_name"] if best_appointment_day else None,
            "best_appointments_count": best_appointment_day["appointments"] if best_appointment_day else 0,
            "worst_revenue_day": worst_revenue_day["day_name"] if worst_revenue_day else None,
            "total_appointments": len(appointments),
            "total_revenue": sum(d["revenue"] for d in weekday_data.values())
        },
        "recommendations": {
            "focus_day": best_revenue_day["day_name"] if best_revenue_day else None,
            "improvement_day": worst_revenue_day["day_name"] if worst_revenue_day else None,
            "message": message
        }
    }

@router.get("/appointment-trends")
async def get_appointment_trends(
    days: int = Query(30),
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Get appointment booking trends"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver tendencias")
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # Get appointments by status
    appointments = await db.appointments.find({
        "created_at": {"$gte": start_date, "$lte": end_date}
    }).to_list(length=None)
    
    # Group by date and status
    daily_data = {}
    for appointment in appointments:
        date_key = appointment["created_at"].strftime("%Y-%m-%d")
        status = appointment["status"]
        
        if date_key not in daily_data:
            daily_data[date_key] = {
                "pending": 0,
                "confirmed": 0,
                "completed": 0,
                "cancelled": 0
            }
        
        daily_data[date_key][status] = daily_data[date_key].get(status, 0) + 1
    
    # Convert to chart format
    chart_data = []
    current_date = start_date
    
    while current_date <= end_date:
        date_key = current_date.strftime("%Y-%m-%d")
        data_point = daily_data.get(date_key, {
            "pending": 0,
            "confirmed": 0,
            "completed": 0,
            "cancelled": 0
        })
        data_point["date"] = date_key
        chart_data.append(data_point)
        current_date += timedelta(days=1)
    
    return {
        "data": chart_data,
        "summary": {
            "total_appointments": len(appointments),
            "completion_rate": (len([a for a in appointments if a["status"] == "completed"]) / len(appointments)) * 100 if appointments else 0,
            "cancellation_rate": (len([a for a in appointments if a["status"] == "cancelled"]) / len(appointments)) * 100 if appointments else 0
        }
    }