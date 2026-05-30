from enum import Enum
from typing import Optional
from pydantic import BaseModel
from models.base import MongoBaseModel
from datetime import datetime

class AssetStatusEnum(str, Enum):
    available = "Available"
    low_stock = "Low Stock"
    unavailable = "Unavailable"

class Asset(MongoBaseModel):
    asset_name: str
    category: str
    description: str
    total_quantity: int
    available_quantity: int
    status: AssetStatusEnum = AssetStatusEnum.available
    qr_code_data: Optional[str] = None

    model_config = {'use_enum_values': True}

class AssetCreate(BaseModel):
    asset_name: str
    category: str
    description: str
    total_quantity: int

class AssetUpdate(BaseModel):
    asset_name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    total_quantity: Optional[int] = None

class ActiveHolder(BaseModel):
    user_id: str
    booking_id: str
    user_name: str
    quantity: int
    start_date: datetime
    end_date: datetime
    status: str

class AssetResponse(Asset):
    active_holders: list[ActiveHolder] = []
    waitlist_count: int = 0
    max_deficit: int = 0
    deficit_start: Optional[datetime] = None
    deficit_end: Optional[datetime] = None
