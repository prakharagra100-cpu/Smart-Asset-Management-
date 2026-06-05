from enum import Enum
from pydantic import BaseModel, Field
from models.base import MongoBaseModel
from typing import Optional
from datetime import datetime

class SystemEventTypeEnum(str, Enum):
    asset_created = "ASSET_CREATED"
    asset_deleted = "ASSET_DELETED"

class SystemEvent(MongoBaseModel):
    event_type: SystemEventTypeEnum
    asset_name: str
    admin_id: str
    admin_name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "use_enum_values": True
    }

class SystemEventResponse(SystemEvent):
    id: str
