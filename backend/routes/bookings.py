from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from database import get_db
from models.user import User
from models.booking import Booking, BookingCreate, BookingResponse, BookingStatusEnum
from dependencies.auth import get_current_user, get_current_admin_user

router = APIRouter()

async def populate_booking(booking_data, db) -> BookingResponse:
    # Fetch related asset and user to populate the response
    asset = await db["assets"].find_one({"_id": ObjectId(booking_data["asset_id"])}) if ObjectId.is_valid(booking_data["asset_id"]) else None
    user = await db["users"].find_one({"_id": ObjectId(booking_data["user_id"])}) if ObjectId.is_valid(booking_data["user_id"]) else None
    
    booking_dict = dict(booking_data)
    booking_dict["asset_name"] = asset["asset_name"] if asset else "Unknown Asset"
    booking_dict["user_email"] = user["email"] if user else "Unknown User"
    booking_dict["user_name"] = user["username"] if user else "Unknown User"
    
    # Fetch related P2P transfers for the timeline
    booking_id_str = str(booking_data.get("_id"))
    transfers_cursor = db["transfer_requests"].find({"original_booking_id": booking_id_str}).sort("created_at", 1)
    transfers = await transfers_cursor.to_list(length=100)
    
    populated_transfers = []
    for t in transfers:
        from_user = await db["users"].find_one({"_id": ObjectId(t["from_user_id"])}) if ObjectId.is_valid(t["from_user_id"]) else None
        to_user = await db["users"].find_one({"_id": ObjectId(t["to_user_id"])}) if ObjectId.is_valid(t["to_user_id"]) else None
        t["from_user_name"] = from_user["username"] if from_user else "Unknown"
        t["to_user_name"] = to_user["username"] if to_user else "Unknown"
        
        if "new_booking_id" in t and ObjectId.is_valid(t["new_booking_id"]):
            new_booking = await db["bookings"].find_one({"_id": ObjectId(t["new_booking_id"])})
            if new_booking:
                t["new_booking_status"] = new_booking.get("status")
                t["new_booking_issued_at"] = new_booking.get("issued_at")
                t["new_booking_returned_at"] = new_booking.get("returned_at")
                
        t["id"] = str(t.pop("_id"))
        populated_transfers.append(t)
        
    booking_dict["transfers"] = populated_transfers
    
    return BookingResponse(**booking_dict)

@router.post("/", response_model=Booking)
async def create_booking(booking_in: BookingCreate, current_user: User = Depends(get_current_user)):
    db = get_db()
    
    if not ObjectId.is_valid(booking_in.asset_id):
        raise HTTPException(status_code=400, detail="Invalid asset ID format")
        
    # Fetch asset
    asset = await db["assets"].find_one({"_id": ObjectId(booking_in.asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    # Inventory validation logic
    from utils.inventory import check_availability
    availability = await check_availability(db, booking_in.asset_id, booking_in.start_date, booking_in.end_date)
    
    if booking_in.requested_quantity > availability["available_quantity"]:
        raise HTTPException(status_code=400, detail="Requested quantity exceeds available inventory for the selected dates")
        
    # Save booking request
    new_booking = Booking(
        user_id=str(current_user.id),
        asset_id=booking_in.asset_id,
        requested_quantity=booking_in.requested_quantity,
        original_requested_quantity=booking_in.requested_quantity,
        start_date=booking_in.start_date,
        end_date=booking_in.end_date,
        reason=booking_in.reason,
        status=BookingStatusEnum.pending,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # Do NOT deduct available_quantity yet. That happens upon admin approval.
    booking_dict = new_booking.model_dump(by_alias=True, exclude_none=True)
    result = await db["bookings"].insert_one(booking_dict)
    
    # Notify all admins
    admins = await db["users"].find({"role": "admin"}).to_list(length=100)
    from models.notification import Notification
    
    notifications = []
    for admin in admins:
        notifications.append(Notification(
            user_id=admin["_id"],
            title="New Booking Request",
            message=f"{current_user.username} requested {booking_in.requested_quantity} unit(s) of {asset['asset_name']}.",
            type="new_booking",
            related_entity_id=result.inserted_id
        ).model_dump(by_alias=True, exclude_none=True, mode='json'))
        
    if notifications:
        await db["notifications"].insert_many(notifications)
    
    return new_booking

@router.get("/my-bookings", response_model=List[BookingResponse])
async def user_booking_history(current_user: User = Depends(get_current_user)):
    db = get_db()
    # Trigger an overdue check
    from utils.cron import update_overdue_bookings, check_upcoming_deadlines
    await update_overdue_bookings()
    await check_upcoming_deadlines()

    cursor = db["bookings"].find({
        "$or": [
            {"user_id": str(current_user.id)},
            {"past_users": str(current_user.id)}
        ]
    }).sort("created_at", -1)
    bookings = await cursor.to_list(length=100)
    
    return [await populate_booking(b, db) for b in bookings]

@router.get("/", response_model=List[BookingResponse])
async def list_all_bookings(
    status: Optional[BookingStatusEnum] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_admin_user)
):
    db = get_db()
    
    # Trigger an overdue check whenever admins view the booking list
    from utils.cron import update_overdue_bookings, check_upcoming_deadlines
    await update_overdue_bookings()
    await check_upcoming_deadlines()
    
    query = {}
    if status:
        query["status"] = status
        
    cursor = db["bookings"].find(query).sort("created_at", -1).skip(skip).limit(limit)
    bookings = await cursor.to_list(length=limit)
    
    return [await populate_booking(b, db) for b in bookings]

@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking_details(booking_id: str, current_user: User = Depends(get_current_user)):
    db = get_db()
    
    if not ObjectId.is_valid(booking_id):
        raise HTTPException(status_code=400, detail="Invalid booking ID format")
        
    booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    # Security: If not admin, verify it belongs to the current user
    if current_user.role != "admin" and str(booking["user_id"]) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to view this booking")
        
    return await populate_booking(booking, db)

@router.put("/{booking_id}/approve", response_model=BookingResponse)
async def approve_booking(
    booking_id: str, 
    approved_quantity: Optional[int] = Query(None, description="The number of units approved by the admin"),
    current_user: User = Depends(get_current_admin_user)
):
    db = get_db()
    
    if not ObjectId.is_valid(booking_id):
        raise HTTPException(status_code=400, detail="Invalid booking ID format")
        
    booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking["status"] != BookingStatusEnum.pending:
        raise HTTPException(status_code=400, detail="Only pending bookings can be approved")
        
    requested_quantity = booking["requested_quantity"]
    final_quantity = approved_quantity if approved_quantity is not None else requested_quantity
    
    if final_quantity <= 0 or final_quantity > requested_quantity:
        raise HTTPException(status_code=400, detail="Approved quantity must be between 1 and the requested quantity")
        
    # Re-verify asset inventory dynamically
    from utils.inventory import check_availability
    availability = await check_availability(db, str(booking["asset_id"]), booking["start_date"], booking["end_date"])
    
    if final_quantity > availability["available_quantity"]:
        raise HTTPException(status_code=400, detail="Not enough inventory available to approve this request for these dates")
        
    # Update booking
    await db["bookings"].update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "status": BookingStatusEnum.approved, 
            "approved_quantity": final_quantity,
            "initial_approved_quantity": final_quantity,
            "updated_at": datetime.utcnow(),
            "approved_at": datetime.utcnow()
        }}
    )
    updated_booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    
    # Send Notification
    from models.notification import Notification
    
    asset = await db["assets"].find_one({"_id": ObjectId(booking["asset_id"])})
    asset_name = asset["asset_name"] if asset else "Unknown Asset"
    
    notification = Notification(
        user_id=ObjectId(booking["user_id"]),
        title="Booking Approved (Partial)" if final_quantity < requested_quantity else "Booking Approved",
        message=f"Your request for {requested_quantity} unit(s) of {asset_name} has been processed: {final_quantity} unit(s) approved.",
        type="booking_approved_partial" if final_quantity < requested_quantity else "booking_approved",
        related_entity_id=ObjectId(booking_id)
    )
    await db["notifications"].insert_one(notification.model_dump(by_alias=True, exclude_none=True, mode='json'))
    
    # Auto-reject other pending requests if they now face 0 availability
    pending_cursor = db["bookings"].find({
        "asset_id": booking["asset_id"],
        "status": BookingStatusEnum.pending,
        "_id": {"$ne": ObjectId(booking_id)}
    })
    other_pending = await pending_cursor.to_list(length=100)
    
    for pb in other_pending:
        pb_avail = await check_availability(db, str(booking["asset_id"]), pb["start_date"], pb["end_date"])
        if pb_avail["available_quantity"] == 0:
            await db["bookings"].update_one(
                {"_id": pb["_id"]},
                {"$set": {
                    "status": BookingStatusEnum.rejected,
                    "updated_at": datetime.utcnow()
                }}
            )
            reject_notif = Notification(
                user_id=ObjectId(pb["user_id"]),
                title="Booking Auto-Rejected",
                message=f"Your request for {pb['requested_quantity']} unit(s) of {asset_name} was automatically rejected because the asset went out of stock for your requested dates.",
                type="booking_rejected",
                related_entity_id=pb["_id"]
            )
            await db["notifications"].insert_one(reject_notif.model_dump(by_alias=True, exclude_none=True, mode='json'))
            
    return await populate_booking(updated_booking, db)

@router.put("/{booking_id}/reject", response_model=BookingResponse)
async def reject_booking(booking_id: str, current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    if not ObjectId.is_valid(booking_id):
        raise HTTPException(status_code=400, detail="Invalid booking ID format")
        
    booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking["status"] != BookingStatusEnum.pending:
        raise HTTPException(status_code=400, detail="Only pending bookings can be rejected")
        
    # Update booking without touching inventory
    await db["bookings"].update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "status": BookingStatusEnum.rejected, 
            "updated_at": datetime.utcnow()
        }}
    )
    updated_booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    
    # Send Notification
    from models.notification import Notification
    asset = await db["assets"].find_one({"_id": ObjectId(booking["asset_id"])})
    asset_name = asset["asset_name"] if asset else "Unknown Asset"
    
    notification = Notification(
        user_id=ObjectId(booking["user_id"]),
        title="Booking Rejected",
        message=f"Your request for {booking['requested_quantity']} unit(s) of {asset_name} was rejected by an admin.",
        type="booking_rejected",
        related_entity_id=ObjectId(booking_id)
    )
    await db["notifications"].insert_one(notification.model_dump(by_alias=True, exclude_none=True, mode='json'))
    
    return await populate_booking(updated_booking, db)

@router.put("/{booking_id}/issue", response_model=BookingResponse)
async def issue_booking(booking_id: str, current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    if not ObjectId.is_valid(booking_id):
        raise HTTPException(status_code=400, detail="Invalid booking ID format")
        
    booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking["status"] != BookingStatusEnum.approved:
        raise HTTPException(status_code=400, detail="Only approved bookings can be issued")
        
    # Premature issue validation is handled on the frontend to avoid timezone mismatch
    # Issue asset
    await db["bookings"].update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "status": BookingStatusEnum.issued, 
            "updated_at": datetime.utcnow(),
            "issued_at": datetime.utcnow() # Track when it was physically handed over
        }}
    )
    
    updated_booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    return await populate_booking(updated_booking, db)

@router.put("/{booking_id}/return", response_model=BookingResponse)
async def return_booking(booking_id: str, current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    if not ObjectId.is_valid(booking_id):
        raise HTTPException(status_code=400, detail="Invalid booking ID format")
        
    booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    if booking["status"] not in [BookingStatusEnum.issued, BookingStatusEnum.overdue]:
        raise HTTPException(status_code=400, detail="Only issued or overdue bookings can be returned")
        
    # Return inventory
    asset = await db["assets"].find_one({"_id": ObjectId(booking["asset_id"])})
    # We do not statically add to available_quantity anymore, it is checked dynamically based on dates.
        
    # Update booking
    await db["bookings"].update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {
            "status": BookingStatusEnum.returned, 
            "updated_at": datetime.utcnow(),
            "returned_at": datetime.utcnow()
        }}
    )
    
    updated_booking = await db["bookings"].find_one({"_id": ObjectId(booking_id)})
    
    # Send Notification
    from models.notification import Notification
    asset_name = asset["asset_name"] if asset else "Unknown Asset"
    
    notification = Notification(
        user_id=ObjectId(booking["user_id"]),
        title="Asset Returned Successfully",
        message=f"The admin has successfully processed your return of {booking['requested_quantity']} unit(s) of {asset_name}.",
        type="booking_returned",
        related_entity_id=ObjectId(booking_id)
    )
    await db["notifications"].insert_one(notification.model_dump(by_alias=True, exclude_none=True, mode='json'))
    
    return await populate_booking(updated_booking, db)
