from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "smart_asset_management")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    db_instance.client = AsyncIOMotorClient(MONGODB_URL, tz_aware=True)
    db_instance.db = db_instance.client[DATABASE_NAME]
    print(f"Connected to MongoDB at {MONGODB_URL}")
    await create_indexes()

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        print("Closed MongoDB connection")

def get_db():
    return db_instance.db

async def create_indexes():
    db = get_db()
    
    # User Indexes
    await db["users"].create_index("email", unique=True)
    await db["users"].create_index("username")

    # Asset Indexes
    await db["assets"].create_index([("asset_name", "text"), ("category", "text")])
    await db["assets"].create_index("category")

    # Booking Indexes
    await db["bookings"].create_index("user_id")
    await db["bookings"].create_index("asset_id")
    await db["bookings"].create_index("status")
    
    # Audit Indexes
    await db["audits"].create_index("timestamp")
    
    # Notification Indexes
    await db["notifications"].create_index("user_id")
