from enum import Enum
from pydantic import BaseModel, Field
from models.base import MongoBaseModel
from typing import Optional
from datetime import datetime

class TransferStatusEnum(str, Enum):
    pending_user = "Pending User Approval"
    pending_admin = "Pending Admin Approval"
    completed = "Completed"
    rejected = "Rejected" # Legacy fallback
    rejected_user = "Rejected by User"
    rejected_admin = "Rejected by Admin"

class TransferRequest(MongoBaseModel):
    asset_id: str
    from_user_id: str
    to_user_id: str
    requested_quantity: int
    approved_quantity: Optional[int] = None
    reason: str
    status: TransferStatusEnum = TransferStatusEnum.pending_user
    original_booking_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    user_approved_at: Optional[datetime] = None
    admin_approved_at: Optional[datetime] = None

    model_config = {'use_enum_values': True}

class TransferRequestCreate(BaseModel):
    asset_id: str
    from_user_id: str
    reason: str
    original_booking_id: str
    requested_quantity: int
