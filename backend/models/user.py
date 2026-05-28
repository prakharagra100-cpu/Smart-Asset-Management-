from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from models.base import MongoBaseModel

class RoleEnum(str, Enum):
    admin = "admin"
    user = "user"

class User(MongoBaseModel):
    username: str
    email: str
    hashed_password: str
    role: RoleEnum = RoleEnum.user
    created_at: datetime = datetime.utcnow()

class UserResponse(MongoBaseModel):
    username: str
    email: str
    role: RoleEnum
    created_at: datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: RoleEnum = RoleEnum.user
