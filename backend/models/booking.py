from enum import Enum
from typing import Optional
from datetime import datetime
from models.base import MongoBaseModel, PyObjectId

class BookingStatusEnum(str, Enum):
    pending = "Pending"
    approved = "Approved"
    rejected = "Rejected"
    issued = "Issued"
    returned = "Returned"
    overdue = "Overdue"

class Booking(MongoBaseModel):
    user_id: PyObjectId
    asset_id: PyObjectId
    requested_quantity: int
    original_requested_quantity: Optional[int] = None
    approved_quantity: Optional[int] = None
    initial_approved_quantity: Optional[int] = None
    start_date: datetime
    end_date: datetime
    status: BookingStatusEnum = BookingStatusEnum.pending
    reason: Optional[str] = None
    created_at: datetime = datetime.utcnow()
    updated_at: datetime = datetime.utcnow()
    approved_at: Optional[datetime] = None
    issued_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    is_p2p_child: bool = False
    
    model_config = {
        "use_enum_values": True
    }

from pydantic import BaseModel, model_validator

class BookingCreate(BaseModel):
    asset_id: str
    requested_quantity: int
    start_date: datetime
    end_date: datetime
    reason: str

    @model_validator(mode='after')
    def check_dates(self) -> 'BookingCreate':
        if self.start_date.timestamp() < datetime.utcnow().timestamp() - 86400: # Allow slight past of today
            raise ValueError("start_date cannot be in the past")
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be strictly after start_date")
        if self.requested_quantity <= 0:
            raise ValueError("requested_quantity must be greater than zero")
        return self

class BookingResponse(Booking):
    asset_name: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    transfers: list = []
