from fastapi import APIRouter, Depends, Query
from typing import List
from database import get_db
from models.user import User
from models.audit import SystemEventResponse
from dependencies.auth import get_current_admin_user

router = APIRouter()

@router.get("/system-events", response_model=List[SystemEventResponse])
async def list_system_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_admin_user)
):
    db = get_db()
    cursor = db["system_events"].find().sort("created_at", -1).skip(skip).limit(limit)
    events = await cursor.to_list(length=limit)
    
    response_events = []
    for e in events:
        e["id"] = str(e.pop("_id"))
        response_events.append(SystemEventResponse(**e))
        
    return response_events
