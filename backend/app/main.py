from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .routes import router
from .database import connection as db_conn
from .database.connection import connect

app = FastAPI(
    title="Smart Agriculture Advisory API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")

app.include_router(router)

@app.on_event("startup")
def startup():
    try:
        connect()
        db_conn.client.admin.command("ping")
        print("✅ Database connected successfully")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")

@app.get("/")
def home():

    return {
        "message": "Smart Agriculture Advisory API is Running"
    }
