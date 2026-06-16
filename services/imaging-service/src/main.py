from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from src.database import SessionLocal, engine, Base, ImageRecord
from azure.storage.blob import BlobServiceClient
from azure.monitor.opentelemetry import configure_azure_monitor
import os, uuid, datetime

if os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING"):
    try:
        configure_azure_monitor()
    except Exception as e:
        print(f"Warning: Failed to configure Azure Monitor: {e}")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Imaging Service — Aegis Health")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AZURE_STORAGE_CONNECTION_STRING = os.getenv(
    "AZURE_STORAGE_CONNECTION_STRING",
    "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;"
    "AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;"
    "BlobEndpoint=http://azurite:10000/devstoreaccount1;"
)
CONTAINER_NAME = "medical-images"

blob_service_client = None
try:
    blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(CONTAINER_NAME)
    if not container_client.exists():
        blob_service_client.create_container(CONTAINER_NAME)
    print("✅ Azure Blob Storage connected (Azurite)")
except Exception as e:
    print(f"⚠️ Blob setup error: {e}")
    blob_service_client = None


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def record_to_dict(rec: ImageRecord):
    return {
        "id": rec.id,
        "user_id": rec.user_id,
        "filename": rec.filename,
        "blob_url": rec.blob_url,
        "uploaded_at": rec.uploaded_at.isoformat() if rec.uploaded_at else None,
        "status": rec.status,
    }


# ─── Routes (Express strips /imaging prefix, so paths are relative) ──────────

@app.post("/upload")
async def upload_image(
    user_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload a medical image to Azure Blob Storage and record metadata in PostgreSQL."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    unique_filename = f"{uuid.uuid4()}-{file.filename}"
    blob_url = ""

    if blob_service_client:
        try:
            blob_client = blob_service_client.get_blob_client(container=CONTAINER_NAME, blob=unique_filename)
            contents = await file.read()
            blob_client.upload_blob(contents, overwrite=True)
            blob_url = blob_client.url
            print(f"✅ Blob uploaded: {blob_url}")
        except Exception as e:
            print(f"Blob upload error: {e}")
            await file.seek(0)
            blob_url = f"blob://{CONTAINER_NAME}/{unique_filename}"
    else:
        await file.read()
        blob_url = f"blob://{CONTAINER_NAME}/{unique_filename}"

    db_image = ImageRecord(
        user_id=user_id,
        filename=file.filename,
        blob_url=blob_url,
        uploaded_at=datetime.datetime.utcnow(),
        status="Pending Analysis"
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    print(f"✅ PostgreSQL record created: id={db_image.id}")

    return {"message": "Image uploaded successfully", "record": record_to_dict(db_image)}


@app.get("/user/{user_id}")
def get_user_images(user_id: str, db: Session = Depends(get_db)):
    """Fetch all images for a patient from PostgreSQL."""
    images = db.query(ImageRecord).filter(ImageRecord.user_id == user_id).order_by(ImageRecord.id.desc()).all()
    return [record_to_dict(r) for r in images]


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "imaging-service", "database": "PostgreSQL", "storage": "Azure Blob Storage"}
