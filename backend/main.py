from fastapi import FastAPI
from contextlib import asynccontextmanager
from database import connect_to_mongo, close_mongo_connection

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()

from routes import auth, assets, bookings, analytics, transfers, audit, notifications

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Smart Asset Management API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(assets.router, prefix="/api/assets", tags=["Assets"])
app.include_router(bookings.router, prefix="/api/bookings", tags=["Bookings"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(transfers.router, prefix="/api/transfers", tags=["Transfers"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
