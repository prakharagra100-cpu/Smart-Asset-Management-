from datetime import datetime, timedelta, timezone
from database import get_db
from models.booking import BookingStatusEnum
from bson import ObjectId
from models.notification import Notification

async def update_overdue_bookings():
    """
    Scans the database for bookings that are 'Issued' but their end_date is in the past.
    Updates their status to 'Overdue'.
    """
    db = get_db()
    
    now = datetime.now(timezone.utc)
    
    cursor = db["bookings"].find({"status": BookingStatusEnum.issued})
    bookings = await cursor.to_list(length=1000)
    
    updated_count = 0
    for b in bookings:
        end_date = b.get("end_date")
        if not end_date:
            continue
            
        if isinstance(end_date, str):
            # Handle 'Z' which some older Python versions' fromisoformat don't like
            if end_date.endswith('Z'):
                end_date = end_date[:-1] + '+00:00'
            end_date_dt = datetime.fromisoformat(end_date)
        else:
            end_date_dt = end_date
            
        if end_date_dt.tzinfo is None:
            # Assume UTC if no timezone is provided by the frontend
            end_date_dt = end_date_dt.replace(tzinfo=timezone.utc)
            
        if end_date_dt < now:
            # Check if an overdue notification already exists for this booking
            existing_notif = await db["notifications"].find_one({
                "type": "overdue", 
                "related_entity_id": {"$in": [b["_id"], str(b["_id"])]}
            })
            if not existing_notif:
                from models.notification import Notification
                notification = Notification(
                    user_id=b["user_id"],
                    title="Asset Overdue",
                    message="An asset you are holding is past its return date. Please return it immediately.",
                    type="overdue",
                    related_entity_id=b["_id"]
                )
                await db["notifications"].insert_one(notification.model_dump(by_alias=True, exclude_none=True, mode='json'))

            await db["bookings"].update_one(
                {"_id": b["_id"]},
                {"$set": {
                    "status": BookingStatusEnum.overdue,
                    "updated_at": datetime.utcnow()
                }}
            )
            updated_count += 1
            
    return updated_count

async def check_upcoming_deadlines():
    """
    Scans for bookings returning within 24 hours and sends a warning notification.
    """
    db = get_db()
    from datetime import timezone, datetime, timedelta
    
    now = datetime.now(timezone.utc)
    in_24_hours = now + timedelta(hours=24)
    
    cursor = db["bookings"].find({"status": BookingStatusEnum.issued})
    bookings = await cursor.to_list(length=1000)
    
    for b in bookings:
        end_date = b.get("end_date")
        if not end_date:
            continue
            
        if isinstance(end_date, str):
            if end_date.endswith('Z'):
                end_date = end_date[:-1] + '+00:00'
            end_date_dt = datetime.fromisoformat(end_date)
        else:
            end_date_dt = end_date
            
        if end_date_dt.tzinfo is None:
            end_date_dt = end_date_dt.replace(tzinfo=timezone.utc)
            
        if now < end_date_dt <= in_24_hours:
            # Check if notification already sent
            existing_notif = await db["notifications"].find_one({
                "type": "deadline_warning", 
                "related_entity_id": {"$in": [b["_id"], str(b["_id"])]}
            })
            if not existing_notif:
                from models.notification import Notification
                notification = Notification(
                    user_id=b["user_id"],
                    title="Return Deadline Upcoming",
                    message="An asset you are holding is due for return within 24 hours.",
                    type="deadline_warning",
                    related_entity_id=b["_id"]
                )
                await db["notifications"].insert_one(notification.model_dump(by_alias=True, exclude_none=True, mode='json'))
