from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from database import get_db
from dependencies.auth import get_current_admin_user
from models.user import User
from models.booking import BookingStatusEnum
from datetime import datetime, timedelta
from bson import ObjectId

router = APIRouter()

@router.get("/kpis", response_model=Dict[str, int])
async def get_kpis(current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    total_assets = await db["assets"].count_documents({})
    pending_requests = await db["bookings"].count_documents({"status": BookingStatusEnum.pending})
    active_allocations = await db["bookings"].count_documents({"status": BookingStatusEnum.issued})
    overdue_returns = await db["bookings"].count_documents({"status": BookingStatusEnum.overdue})
    
    return {
        "total_assets": total_assets,
        "pending_requests": pending_requests,
        "active_allocations": active_allocations,
        "overdue_returns": overdue_returns
    }

@router.get("/utilization", response_model=List[Dict[str, Any]])
async def get_utilization_rates(current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    # Aggregate bookings by asset_id and sum requested_quantity
    pipeline = [
        {"$group": {"_id": "$asset_id", "total_requested": {"$sum": "$requested_quantity"}}},
        {"$sort": {"total_requested": -1}},
        {"$limit": 5}
    ]
    
    cursor = db["bookings"].aggregate(pipeline)
    utilization = await cursor.to_list(length=5)
    
    # Enhance with asset names
    result = []
    for item in utilization:
        asset = await db["assets"].find_one({"_id": ObjectId(item["_id"])})
        if asset:
            result.append({
                "name": asset.get("asset_name", "Unknown"),
                "requests": item["total_requested"]
            })
            
    return result

@router.get("/trends", response_model=List[Dict[str, Any]])
async def get_booking_trends(current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    # Last 30 days trend
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {"$project": {
            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}}
        }},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    
    cursor = db["bookings"].aggregate(pipeline)
    trends = await cursor.to_list(length=30)
    
    return [{"date": t["_id"], "bookings": t["count"]} for t in trends]

@router.get("/category-distribution", response_model=List[Dict[str, Any]])
async def get_category_distribution(current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    pipeline = [
        {"$group": {"_id": "$category", "value": {"$sum": 1}}}
    ]
    
    cursor = db["assets"].aggregate(pipeline)
    categories = await cursor.to_list(length=10)
    
    return [{"name": c["_id"] if c["_id"] else "Uncategorized", "value": c["value"]} for c in categories]
