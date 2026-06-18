"""
patient-history-agent — Aegis Health Multi-Agent Platform

Retrieves patient history from Cosmos DB (MongoDB API) and PostgreSQL.
Uses the same MONGODB_URI and DATABASE_URL env vars as the existing platform
(injected from Key Vault via the aegis-kv-secrets K8s Secret).

Exposes: GET /history?userId={id}
         GET /health
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

app = FastAPI(title="Patient History Agent — Aegis Health")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Cosmos DB (MongoDB API) ──────────────────────────────────────────────────
# Key Vault CSI injects this as MONGODB_URI (same secret name as api-gateway uses).
# e.g. mongodb://aegisdb:KEY@aegisdb.mongo.cosmos.azure.com:10255/ai-health-agent?ssl=true&...
MONGODB_URI = os.getenv("MONGODB_URI", "")
cosmos_client = None
cosmos_db = None


@app.on_event("startup")
async def startup():
    global cosmos_client, cosmos_db
    if MONGODB_URI:
        try:
            cosmos_client = AsyncIOMotorClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
            # get_default_database() reads the DB name from the URI path segment
            # (same DB that Mongoose api-gateway connects to)
            cosmos_db = cosmos_client.get_default_database()
            await cosmos_client.admin.command("ping")
            print(f"✅ [patient-history-agent] Cosmos DB connected — db={cosmos_db.name}")
        except Exception as e:
            print(f"⚠️  [patient-history-agent] Cosmos DB connection failed: {e}")
    else:
        print("ℹ️  [patient-history-agent] MONGODB_URI not set — Cosmos data will be empty")


# ─── PostgreSQL ───────────────────────────────────────────────────────────────
# Key Vault CSI injects this as DATABASE_URL
# e.g. postgresql://aegis:PASS@postgres-service:5432/imaging
DATABASE_URL = os.getenv("DATABASE_URL", "")
SessionLocal = None

if DATABASE_URL:
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        print("✅ [patient-history-agent] PostgreSQL connected")
    except Exception as e:
        print(f"⚠️  [patient-history-agent] PostgreSQL setup failed: {e}")


# ─── Helper ───────────────────────────────────────────────────────────────────
def to_object_id(user_id: str):
    """
    The existing platform stores userId as a MongoDB ObjectId.
    The JWT decoded userId (req.userId = decoded.id) is the ObjectId hex string.
    Motor queries must use ObjectId, not the raw string.
    """
    try:
        return ObjectId(user_id)
    except Exception:
        return user_id  # non-ObjectId fallback (should not happen in production)


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/history")
async def get_patient_history(userId: str):
    """
    Aggregates patient data from Cosmos DB and PostgreSQL.
    Returns: medical_records, medications, appointments, image_records
    """
    if not userId:
        raise HTTPException(status_code=400, detail="userId is required")

    result = {
        "medical_records": [],
        "medications": [],
        "appointments": [],
        "image_records": [],
        "record_count": 0,
        "medication_count": 0,
    }

    user_oid = to_object_id(userId)

    # ── Cosmos DB queries ─────────────────────────────────────────────────────
    if cosmos_db is not None:
        try:
            # Medical records: query by ObjectId first, fallback to string
            # The Azure Function stores userId as ObjectId (line 107 in index.js)
            records_cursor = cosmos_db["medicalrecords"].find(
                {"userId": user_oid},
                {
                    "_id": 0, "title": 1, "category": 1, "date": 1,
                    "description": 1, "notes": 1, "extractedText": 1,
                    "processingStatus": 1, "blobUrl": 1
                }
            ).sort("createdAt", -1).limit(10)

            async for doc in records_cursor:
                result["medical_records"].append(doc)

            # Medications (stored by api-gateway with ObjectId userId)
            meds_cursor = cosmos_db["medications"].find(
                {"userId": user_oid},
                {
                    "_id": 0, "name": 1, "dosage": 1, "frequency": 1,
                    "missedCount": 1, "startDate": 1, "schedules": 1,
                    "instructions": 1
                }
            ).limit(10)

            async for doc in meds_cursor:
                result["medications"].append(doc)

            # Upcoming appointments
            appts_cursor = cosmos_db["appointments"].find(
                {"userId": user_oid, "status": "Scheduled"},
                {
                    "_id": 0, "dateTime": 1, "provider": 1,
                    "specialty": 1, "purpose": 1, "status": 1
                }
            ).limit(5)

            async for doc in appts_cursor:
                result["appointments"].append(doc)

        except Exception as e:
            print(f"⚠️  [patient-history-agent] Cosmos DB query error: {e}")

    # ── PostgreSQL: image upload records ──────────────────────────────────────
    # imaging-service stores user_id as a string (UUID or the frontend userId)
    if SessionLocal is not None:
        try:
            db = SessionLocal()
            rows = db.execute(
                text(
                    "SELECT id, filename, blob_url, uploaded_at, status "
                    "FROM image_records WHERE user_id = :uid "
                    "ORDER BY id DESC LIMIT 10"
                ),
                {"uid": userId}
            ).fetchall()
            db.close()

            for row in rows:
                result["image_records"].append({
                    "id": row[0],
                    "filename": row[1],
                    "blob_url": row[2],
                    "uploaded_at": str(row[3]) if row[3] else None,
                    "status": row[4],
                })
        except Exception as e:
            print(f"⚠️  [patient-history-agent] PostgreSQL query error: {e}")

    result["record_count"] = len(result["medical_records"])
    result["medication_count"] = len(result["medications"])

    return result


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "patient-history-agent",
        "cosmos": "connected" if cosmos_db is not None else "not configured",
        "postgres": "connected" if SessionLocal is not None else "not configured",
    }
