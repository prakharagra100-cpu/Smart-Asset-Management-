from datetime import datetime
from bson import ObjectId
from typing import Dict, Any

async def check_availability(db: Any, asset_id: str, start_date: datetime, end_date: datetime) -> Dict[str, int]:
    """
    Returns the truly available quantity for the given date range,
    and the number of overlapping pending requests.
    """
    asset = await db["assets"].find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise Exception("Asset not found")
        
    total_quantity = asset.get("total_quantity", 0)
    
    # Fetch all Approved/Issued bookings that overlap with [start_date, end_date]
    active_cursor = db["bookings"].find({
        "asset_id": str(asset_id),
        "status": {"$in": ["Approved", "Issued"]},
        "start_date": {"$lt": end_date},
        "end_date": {"$gt": start_date}
    })
    active_bookings = await active_cursor.to_list(length=1000)
    
    # Base usage logic. We must account for bookings that span across the requested range.
    # A booking that is active throughout the entire requested range adds a constant base usage.
    
    events = []
    for b in active_bookings:
        # We only care about the intersection of the booking window and the requested window
        # To avoid complex boundary logic, we just clip the booking to the requested window
        b_s = max(b["start_date"], start_date)
        b_e = min(b["end_date"], end_date)
        
        quantity = b.get("approved_quantity", b.get("requested_quantity", 0))
        events.append((b_s, 'start', quantity))
        events.append((b_e, 'end', -quantity))
        
    # Sort events. Ends first if timestamps match (so returning an item makes it available instantly)
    events.sort(key=lambda x: (x[0], 0 if x[1] == 'end' else 1))
    
    current_usage = 0
    peak_usage = 0
    
    for dt, event_type, qty in events:
        current_usage += qty
        if current_usage > peak_usage:
            peak_usage = current_usage
            
    available_qty = max(0, total_quantity - peak_usage)
    
    # Fetch all Pending bookings that overlap with the same window
    pending_cursor = db["bookings"].find({
        "asset_id": str(asset_id),
        "status": "Pending",
        "start_date": {"$lt": end_date},
        "end_date": {"$gt": start_date}
    })
    pending_bookings = await pending_cursor.to_list(length=1000)
    overlapping_pending_count = sum(b.get("requested_quantity", 1) for b in pending_bookings)
    
    return {
        "available_quantity": available_qty,
        "overlapping_pending_count": overlapping_pending_count
    }
