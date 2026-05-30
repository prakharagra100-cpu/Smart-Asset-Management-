from fastapi import APIRouter, Depends, HTTPException, Query, Response
from typing import List, Optional
from database import get_db
from models.user import User
from models.asset import Asset, AssetCreate, AssetUpdate, AssetStatusEnum, AssetResponse, ActiveHolder
from dependencies.auth import get_current_user, get_current_admin_user
from bson import ObjectId

router = APIRouter()

async def populate_asset_holders(asset_data, db) -> AssetResponse:
    asset_dict = dict(asset_data)
    
    # Fetch active and pending bookings
    cursor = db["bookings"].find({
        "asset_id": str(asset_data.get("_id", asset_data.get("id"))),
        "status": {"$in": ["Pending", "Approved", "Issued"]}
    }).sort("start_date", 1)
    bookings = await cursor.to_list(length=100)
    
    holders = []
    waitlist_count = 0
    events_by_time = {}
    
    for b in bookings:
        status = b["status"]
        qty = b.get("approved_quantity", b.get("requested_quantity", 1)) if status in ["Approved", "Issued"] else b.get("requested_quantity", 1)
        
        events_by_time.setdefault(b["start_date"], []).append(("start", status, qty))
        events_by_time.setdefault(b["end_date"], []).append(("end", status, -qty))
        
        if status == "Pending":
            waitlist_count += b.get("requested_quantity", 1)
        else:
            user = await db["users"].find_one({"_id": ObjectId(b["user_id"])})
            if user:
                holders.append({
                    "user_id": str(user["_id"]),
                    "booking_id": str(b["_id"]),
                    "user_name": user["username"],
                    "quantity": b.get("approved_quantity", b["requested_quantity"]),
                    "start_date": b["start_date"],
                    "end_date": b["end_date"],
                    "status": b["status"]
                })
                
    # Compute max_deficit using sweep-line
    sorted_times = sorted(events_by_time.keys())
    current_active = 0
    current_pending = 0
    max_deficit = 0
    max_deficit_start = None
    max_deficit_end = None
    total_qty = asset_dict.get("total_quantity", 0)
    
    for i, dt in enumerate(sorted_times):
        for event_type, status, qty in events_by_time[dt]:
            if status in ["Approved", "Issued"]:
                current_active += qty
            elif status == "Pending":
                current_pending += qty
                
        available = max(0, total_qty - current_active)
        deficit = max(0, current_pending - available)
        
        if deficit > max_deficit:
            max_deficit = deficit
            max_deficit_start = dt
            max_deficit_end = sorted_times[i+1] if i + 1 < len(sorted_times) else dt
        elif deficit == max_deficit and deficit > 0:
            if max_deficit_end == dt:
                max_deficit_end = sorted_times[i+1] if i + 1 < len(sorted_times) else dt
            
    asset_dict["active_holders"] = holders
    asset_dict["waitlist_count"] = waitlist_count
    asset_dict["max_deficit"] = max_deficit
    asset_dict["deficit_start"] = max_deficit_start
    asset_dict["deficit_end"] = max_deficit_end
    return AssetResponse(**asset_dict)

@router.post("/", response_model=AssetResponse)
async def create_asset(asset_in: AssetCreate, current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    asset_dict = asset_in.model_dump()
    asset_dict["available_quantity"] = asset_dict["total_quantity"]
    
    if asset_dict["available_quantity"] == 0:
        asset_dict["status"] = AssetStatusEnum.unavailable
    elif asset_dict["available_quantity"] <= asset_dict["total_quantity"] / 2:
        asset_dict["status"] = AssetStatusEnum.low_stock
    else:
        asset_dict["status"] = AssetStatusEnum.available
        
    new_asset = Asset(**asset_dict)
    
    await db["assets"].insert_one(new_asset.model_dump(by_alias=True, exclude_none=True))
    
    from models.audit import SystemEvent, SystemEventTypeEnum
    from datetime import datetime
    sys_event = SystemEvent(
        event_type=SystemEventTypeEnum.asset_created,
        asset_name=new_asset.asset_name,
        admin_id=str(current_user.id),
        admin_name=current_user.username,
        description=f"Added {new_asset.total_quantity} unit{'s' if new_asset.total_quantity != 1 else ''} of {new_asset.asset_name}",
        created_at=datetime.utcnow()
    )
    await db["system_events"].insert_one(sys_event.model_dump(by_alias=True, exclude_none=True, mode='json'))
    
    return await populate_asset_holders(new_asset.model_dump(by_alias=True), db)

@router.get("/", response_model=List[AssetResponse])
async def list_assets(
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user)
):
    db = get_db()
    query = {}
    
    if search:
        query["$text"] = {"$search": search}
    if category:
        query["category"] = category
    if status:
        query["status"] = status
        
    cursor = db["assets"].find(query).skip(skip).limit(limit)
    assets = await cursor.to_list(length=limit)
    
    return [await populate_asset_holders(asset, db) for asset in assets]

@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(asset_id: str, current_user: User = Depends(get_current_user)):
    db = get_db()
    
    if not ObjectId.is_valid(asset_id):
        raise HTTPException(status_code=400, detail="Invalid asset ID format")
        
    asset = await db["assets"].find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    return await populate_asset_holders(asset, db)

@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: str, 
    asset_in: AssetUpdate, 
    current_user: User = Depends(get_current_admin_user)
):
    db = get_db()
    
    if not ObjectId.is_valid(asset_id):
        raise HTTPException(status_code=400, detail="Invalid asset ID format")
        
    existing_asset = await db["assets"].find_one({"_id": ObjectId(asset_id)})
    if not existing_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    update_data = asset_in.model_dump(exclude_unset=True)
    
    # Handle quantity delta
    if "total_quantity" in update_data:
        delta = update_data["total_quantity"] - existing_asset["total_quantity"]
        new_available = existing_asset["available_quantity"] + delta
        if new_available < 0:
            raise HTTPException(status_code=400, detail="Cannot reduce total quantity below current active bookings")
        update_data["available_quantity"] = new_available
        
        # Update status
        if new_available == 0:
            update_data["status"] = AssetStatusEnum.unavailable
        elif new_available <= update_data.get("total_quantity", existing_asset["total_quantity"]) / 2:
            update_data["status"] = AssetStatusEnum.low_stock
        else:
            update_data["status"] = AssetStatusEnum.available
            
    if not update_data:
        return await populate_asset_holders(existing_asset, db)
        
    await db["assets"].update_one(
        {"_id": ObjectId(asset_id)},
        {"$set": update_data}
    )
    
    updated_asset = await db["assets"].find_one({"_id": ObjectId(asset_id)})
    return await populate_asset_holders(updated_asset, db)

@router.get("/{asset_id}/availability")
async def get_asset_availability(
    asset_id: str, 
    start_date: str, 
    end_date: str, 
    response: Response,
    current_user: User = Depends(get_current_user)
):
    db = get_db()
    from utils.inventory import check_availability
    from datetime import datetime
    
    # Prevent browser caching of dynamic availability
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    
    try:
        dt_start = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        dt_end = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
        
    try:
        result = await check_availability(db, asset_id, dt_start, dt_end)
        return result
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{asset_id}", status_code=204)
async def delete_asset(asset_id: str, current_user: User = Depends(get_current_admin_user)):
    db = get_db()
    
    if not ObjectId.is_valid(asset_id):
        raise HTTPException(status_code=400, detail="Invalid asset ID format")
        
    existing_asset = await db["assets"].find_one({"_id": ObjectId(asset_id)})
    if not existing_asset:
        raise HTTPException(status_code=404, detail="Asset not found")
        
    # Check if there are active bookings
    active_bookings = await db["bookings"].find_one({
        "asset_id": asset_id, 
        "status": {"$in": ["Pending", "Approved", "Issued"]}
    })
    
    if active_bookings:
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete asset. There are currently active or pending bookings for this asset."
        )
        
    asset_name = existing_asset["asset_name"]
    await db["assets"].delete_one({"_id": ObjectId(asset_id)})
    
    from models.audit import SystemEvent, SystemEventTypeEnum
    from datetime import datetime
    sys_event = SystemEvent(
        event_type=SystemEventTypeEnum.asset_deleted,
        asset_name=asset_name,
        admin_id=str(current_user.id),
        admin_name=current_user.username,
        description=f"Permanently deleted asset '{asset_name}'",
        created_at=datetime.utcnow()
    )
    await db["system_events"].insert_one(sys_event.model_dump(by_alias=True, exclude_none=True, mode='json'))
    
    return None
