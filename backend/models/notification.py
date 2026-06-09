from typing import Optional
from datetime import datetime
from models.base import MongoBaseModel, PyObjectId

class Notification(MongoBaseModel):
    user_id: PyObjectId
    title: str
    message: str
    type: str  # e.g., 'booking_approved', 'booking_rejected', 'deadline_warning', 'overdue'
    related_entity_id: Optional[PyObjectId] = None
    is_read: bool = False
    created_at: datetime = None

    def __init__(self, **data):
        super().__init__(**data)
        if self.created_at is None:
            self.created_at = datetime.utcnow()
