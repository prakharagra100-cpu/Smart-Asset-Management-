from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from database import get_db
from models.user import User
from dependencies.auth import get_current_user
from models.notification import Notification
from bson import ObjectId

router = APIRouter()

@router.get("/", response_model=List[dict])
async def get_my_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    query = {
        "$or": [
            {"user_id": ObjectId(current_user.id)},
            {"user_id": str(current_user.id)}
        ]
    }
    if unread_only:
        query["is_read"] = False
        
    notifications_cursor = db.notifications.find(query).sort("created_at", -1).limit(50)
    notifications = await notifications_cursor.to_list(length=50)
    
    # Convert ObjectIds to strings
    for notif in notifications:
        notif["id"] = str(notif["_id"])
        notif["_id"] = str(notif["_id"])
        notif["user_id"] = str(notif["user_id"])
        if notif.get("related_entity_id"):
            notif["related_entity_id"] = str(notif["related_entity_id"])
            
    return notifications

@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    try:
        obj_id = ObjectId(notification_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
        
    result = await db.notifications.update_one(
        {"_id": obj_id, "$or": [{"user_id": ObjectId(current_user.id)}, {"user_id": str(current_user.id)}]},
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count == 0:
        # Check if it exists
        exists = await db.notifications.find_one({"_id": obj_id, "$or": [{"user_id": ObjectId(current_user.id)}, {"user_id": str(current_user.id)}]})
        if not exists:
            raise HTTPException(status_code=404, detail="Notification not found")
            
    return {"status": "success"}

@router.put("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    await db.notifications.update_many(
        {
            "$or": [{"user_id": ObjectId(current_user.id)}, {"user_id": str(current_user.id)}],
            "is_read": False
        },
        {"$set": {"is_read": True}}
    )
    return {"status": "success"}
