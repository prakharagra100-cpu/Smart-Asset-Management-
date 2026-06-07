from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from database import get_db
from models.user import User
from models.transfer import TransferRequest, TransferRequestCreate, TransferStatusEnum
from dependencies.auth import get_current_user, get_current_admin_user
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.post("/")
async def create_transfer_request(req_in: TransferRequestCreate, current_user: User = Depends(get_current_user)):
    db = get_db()
    
    # Verify booking exists and is Issued or Approved
    booking = await db["bookings"].find_one({"_id": ObjectId(req_in.original_booking_id)})
    if not booking:
        raise HTTPException(status_code=404, detail="Original booking not found")
        
    if booking["user_id"] != req_in.from_user_id:
        raise HTTPException(status_code=400, detail="Booking does not belong to the specified user")
        
    if booking["status"] not in ["Approved", "Issued"]:
        raise HTTPException(status_code=400, detail="Can only request transfer from an active booking")
        
    # Verify no active P2P request exists for this booking
    existing_transfer = await db["transfer_requests"].find_one({
        "original_booking_id": req_in.original_booking_id,
        "status": {"$in": [TransferStatusEnum.pending_user, TransferStatusEnum.pending_admin]}
    })
    if existing_transfer:
        raise HTTPException(status_code=400, detail="An active P2P transfer request is already pending for this asset")
        
    if str(current_user.id) == req_in.from_user_id:
        raise HTTPException(status_code=400, detail="You cannot request a P2P transfer from yourself")
        
    held_quantity = booking.get("approved_quantity", booking["requested_quantity"])
    if req_in.requested_quantity <= 0 or req_in.requested_quantity > held_quantity:
        raise HTTPException(status_code=400, detail=f"Requested quantity must be between 1 and {held_quantity}")
        
    transfer_dict = req_in.model_dump()
    transfer_dict["to_user_id"] = str(current_user.id)
    transfer_dict["status"] = TransferStatusEnum.pending_user
    
    new_request = TransferRequest(**transfer_dict)
    
    result = await db["transfer_requests"].insert_one(new_request.model_dump(by_alias=True, exclude_none=True))
    
    # Notify the holder
    from models.notification import Notification
    asset = await db["assets"].find_one({"_id": ObjectId(req_in.asset_id)})
    asset_name = asset["asset_name"] if asset else "Unknown Asset"
    
    notification = Notification(
        user_id=ObjectId(req_in.from_user_id),
        title="New P2P Transfer Request",
        message=f"{current_user.username} has requested to take over {asset_name} from you.",
        type="p2p_request",
        related_entity_id=result.inserted_id
    )
    await db["notifications"].insert_one(notification.model_dump(by_alias=True, exclude_none=True, mode='json'))
    
    return {"message": "Transfer request sent to user", "id": str(result.inserted_id)}

@router.get("/my-requests")
async def get_my_requests(current_user: User = Depends(get_current_user)):
    db = get_db()
    # Requests where current_user is the holder (from_user_id)
    cursor = db["transfer_requests"].find({
        "from_user_id": str(current_user.id),
        "status": TransferStatusEnum.pending_user
    })
    requests = await cursor.to_list(length=100)
    
    # Populate extra data for UI
    enriched = []
    for req in requests:
        asset = await db["assets"].find_one({"_id": ObjectId(req["asset_id"])})
        requester = await db["users"].find_one({"_id": ObjectId(req["to_user_id"])})
        enriched.append({
            **req,
            "asset_name": asset["asset_name"] if asset else "Unknown",
            "requester_name": requester["username"] if requester else "Unknown"
        })
        
    # Convert _id
    for req in enriched:
        req["id"] = str(req.pop("_id"))
        
    return enriched

@router.get("/sent-requests")
async def get_sent_requests(current_user: User = Depends(get_current_user)):
    db = get_db()
    # Requests where current_user is the requester (to_user_id)
    cursor = db["transfer_requests"].find({
        "to_user_id": str(current_user.id)
    }).sort("_id", -1)
    requests = await cursor.to_list(length=100)
    
    # Populate extra data for UI
    enriched = []
    for req in requests:
        asset = await db["assets"].find_one({"_id": ObjectId(req["asset_id"])})
        holder = await db["users"].find_one({"_id": ObjectId(req["from_user_id"])})
        enriched.append({
            **req,
            "asset_name": asset["asset_name"] if asset else "Unknown",
            "holder_name": holder["username"] if holder else "Unknown"
        })
        
    # Convert _id
    for req in enriched:
        req["id"] = str(req.pop("_id"))
        
    return enriched

@router.put("/{transfer_id}/user-respond")
async def user_respond(
    transfer_id: str, 
    accept: bool = Query(...), 
    approved_quantity: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user)
):
    db = get_db()
    
    if not ObjectId.is_valid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    req = await db["transfer_requests"].find_one({"_id": ObjectId(transfer_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if req["from_user_id"] != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if req["status"] != TransferStatusEnum.pending_user:
        raise HTTPException(status_code=400, detail="Request is not pending user approval")
        
    new_status = TransferStatusEnum.pending_admin if accept else TransferStatusEnum.rejected
    update_data = {"status": new_status, "updated_at": datetime.utcnow()}
    if accept:
        booking = await db["bookings"].find_one({"_id": ObjectId(req["original_booking_id"])})
        if not booking:
            raise HTTPException(status_code=400, detail="Original booking no longer exists")
            
        held_quantity = booking.get("approved_quantity", booking["requested_quantity"])
        final_quantity = approved_quantity if approved_quantity is not None else req["requested_quantity"]
        
        if final_quantity <= 0 or final_quantity > req["requested_quantity"] or final_quantity > held_quantity:
            raise HTTPException(status_code=400, detail="Invalid approved quantity")
            
        update_data["user_approved_at"] = datetime.utcnow()
        update_data["approved_quantity"] = final_quantity
        
    await db["transfer_requests"].update_one(
        {"_id": ObjectId(transfer_id)},
        {"$set": update_data}
    )
    
    # Notify admins and requester if accepted
    if accept:
        admins = await db["users"].find({"role": "admin"}).to_list(length=100)
        from models.notification import Notification
        
        # Get asset for better message
        asset = await db["assets"].find_one({"_id": ObjectId(req["asset_id"])})
        asset_name = asset["asset_name"] if asset else "Unknown Asset"
        
        notifications = []
        for admin in admins:
            notifications.append(Notification(
                user_id=admin["_id"],
                title="P2P Transfer Pending Approval",
                message=f"A P2P transfer for {asset_name} has been accepted by the holder and requires your final authorization.",
                type="p2p_admin_approval",
                related_entity_id=ObjectId(transfer_id)
            ).model_dump(by_alias=True, exclude_none=True, mode='json'))
            
        is_partial = final_quantity < req["requested_quantity"]
        notif_type = "p2p_approved_partial" if is_partial else "p2p_request"
        notif_title = "P2P Transfer Partially Accepted" if is_partial else "P2P Transfer Accepted"
        msg = f"Your request to take over {asset_name} was accepted for {final_quantity} out of {req['requested_quantity']} unit(s)! It is now pending admin approval." if is_partial else f"Your request to take over {asset_name} was accepted by the holder! It is now pending admin approval."

        # Notify the requester
        notifications.append(Notification(
            user_id=ObjectId(req["to_user_id"]),
            title=notif_title,
            message=msg,
            type=notif_type,
            related_entity_id=ObjectId(transfer_id)
        ).model_dump(by_alias=True, exclude_none=True, mode='json'))
            
        if notifications:
            await db["notifications"].insert_many(notifications)
            
    else:
        # Notify the requester that it was rejected by the holder
        from models.notification import Notification
        asset = await db["assets"].find_one({"_id": ObjectId(req["asset_id"])})
        asset_name = asset["asset_name"] if asset else "Unknown Asset"
        notification = Notification(
            user_id=ObjectId(req["to_user_id"]),
            title="P2P Transfer Rejected",
            message=f"Your P2P transfer request for {asset_name} was declined by the current holder.",
            type="p2p_rejected",
            related_entity_id=ObjectId(transfer_id)
        )
        await db["notifications"].insert_one(notification.model_dump(by_alias=True, exclude_none=True, mode='json'))
            
    return {"message": f"Transfer {'accepted' if accept else 'rejected'}"}

@router.get("/admin-pending")
async def get_admin_pending(current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    cursor = db["transfer_requests"].find({
        "status": TransferStatusEnum.pending_admin
    })
    requests = await cursor.to_list(length=100)
    
    enriched = []
    for req in requests:
        asset = await db["assets"].find_one({"_id": ObjectId(req["asset_id"])})
        requester = await db["users"].find_one({"_id": ObjectId(req["to_user_id"])})
        holder = await db["users"].find_one({"_id": ObjectId(req["from_user_id"])})
        enriched.append({
            **req,
            "asset_name": asset["asset_name"] if asset else "Unknown",
            "requester_name": requester["username"] if requester else "Unknown",
            "holder_name": holder["username"] if holder else "Unknown"
        })
        
    for req in enriched:
        req["id"] = str(req.pop("_id"))
        
    return enriched

@router.put("/{transfer_id}/admin-respond")
async def admin_respond(transfer_id: str, approve: bool = Query(...), current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    if not ObjectId.is_valid(transfer_id):
        raise HTTPException(status_code=400, detail="Invalid ID format")
        
    req = await db["transfer_requests"].find_one({"_id": ObjectId(transfer_id)})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if req["status"] != TransferStatusEnum.pending_admin:
        raise HTTPException(status_code=400, detail="Request is not pending admin approval")
        
    if not approve:
        await db["transfer_requests"].update_one(
            {"_id": ObjectId(transfer_id)},
            {"$set": {"status": TransferStatusEnum.rejected_admin, "updated_at": datetime.utcnow()}}
        )
        
        # Notify requester
        from models.notification import Notification
        asset = await db["assets"].find_one({"_id": ObjectId(req["asset_id"])})
        asset_name = asset["asset_name"] if asset else "Unknown Asset"
        notification = Notification(
            user_id=ObjectId(req["to_user_id"]),
            title="P2P Transfer Rejected",
            message=f"Your P2P transfer request for {asset_name} was rejected by the admin.",
            type="p2p_rejected",
            related_entity_id=ObjectId(transfer_id)
        )
        await db["notifications"].insert_one(notification.model_dump(by_alias=True, exclude_none=True, mode='json'))
        
        return {"message": "Transfer rejected"}
        
    # Approval flow
    booking = await db["bookings"].find_one({"_id": ObjectId(req["original_booking_id"])})
    if not booking or booking["status"] not in ["Approved", "Issued"]:
        await db["transfer_requests"].update_one(
            {"_id": ObjectId(transfer_id)},
            {"$set": {"status": TransferStatusEnum.rejected_admin, "updated_at": datetime.utcnow()}}
        )
        raise HTTPException(status_code=400, detail="Original booking is no longer valid or active")
        
    # Mutate existing booking or split if partial transfer
    now = datetime.utcnow()
    held_quantity = booking.get("approved_quantity", booking["requested_quantity"])
    transfer_quantity = req.get("approved_quantity", req["requested_quantity"])
    
    if transfer_quantity == held_quantity:
        # Full transfer (Legacy behavior)
        await db["bookings"].update_one(
            {"_id": ObjectId(req["original_booking_id"])},
            {
                "$set": {
                    "user_id": req["to_user_id"],
                    "reason": f"[P2P Transfer] {req['reason']}",
                    "updated_at": now
                },
                "$push": {
                    "past_users": req["from_user_id"]
                }
            }
        )
    else:
        # Partial transfer (Split the booking)
        new_held_quantity = held_quantity - transfer_quantity
        
        # 1. Update old booking
        await db["bookings"].update_one(
            {"_id": ObjectId(req["original_booking_id"])},
            {
                "$set": {
                    "approved_quantity": new_held_quantity,
                    "requested_quantity": new_held_quantity,
                    "updated_at": now
                }
            }
        )
        
        # 2. Create new booking
        new_booking = booking.copy()
        new_booking.pop("_id", None)
        new_booking["user_id"] = req["to_user_id"]
        new_booking["approved_quantity"] = transfer_quantity
        new_booking["requested_quantity"] = transfer_quantity
        new_booking["initial_approved_quantity"] = transfer_quantity
        new_booking["original_requested_quantity"] = transfer_quantity
        new_booking["reason"] = f"[P2P Transfer] {req['reason']}"
        new_booking["updated_at"] = now
        new_booking["is_p2p_child"] = True
        new_booking.setdefault("past_users", []).append(req["from_user_id"])
        
        new_booking_result = await db["bookings"].insert_one(new_booking)
        
        # Save new_booking_id to transfer request
        await db["transfer_requests"].update_one(
            {"_id": ObjectId(transfer_id)},
            {"$set": {"new_booking_id": str(new_booking_result.inserted_id)}}
        )
    
    # Mark transfer completed
    await db["transfer_requests"].update_one(
        {"_id": ObjectId(transfer_id)},
        {"$set": {
            "status": TransferStatusEnum.completed,
            "updated_at": datetime.utcnow(),
            "admin_approved_at": datetime.utcnow()
        }}
    )
    
    # Notify requester and holder
    from models.notification import Notification
    asset = await db["assets"].find_one({"_id": ObjectId(req["asset_id"])})
    asset_name = asset["asset_name"] if asset else "Unknown Asset"
    
    is_partial = transfer_quantity < req["requested_quantity"]
    notif_title = "P2P Transfer Partially Approved" if is_partial else "P2P Transfer Approved"
    msg = f"Your P2P transfer request for {asset_name} has been approved for {transfer_quantity} out of {req['requested_quantity']} unit(s)." if is_partial else f"Your P2P transfer request for {asset_name} has been approved! You are now the official holder."
    
    notifications = [
        Notification(
            user_id=ObjectId(req["to_user_id"]),
            title=notif_title,
            message=msg,
            type="p2p_completed",
            related_entity_id=ObjectId(transfer_id)
        ).model_dump(by_alias=True, exclude_none=True, mode='json'),
        Notification(
            user_id=ObjectId(req["from_user_id"]),
            title="P2P Transfer Completed",
            message=f"The admin has approved the transfer of {transfer_quantity} unit(s) of {asset_name}. It has been removed from your holdings.",
            type="p2p_completed",
            related_entity_id=ObjectId(transfer_id)
        ).model_dump(by_alias=True, exclude_none=True, mode='json')
    ]
    await db["notifications"].insert_many(notifications)
    
    return {"message": "Transfer successfully approved and processed"}
