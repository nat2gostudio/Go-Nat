import os
import secrets
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pymongo import MongoClient
from bson.objectid import ObjectId
import bcrypt
import jwt
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import requests
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from apscheduler.schedulers.asyncio import AsyncIOScheduler

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000").rstrip("/")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

JWT_SECRET = os.environ.get("JWT_SECRET", "supersecret")
JWT_ALGORITHM = "HS256"

# Pydantic Models
class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class TaskCreate(BaseModel):
    title: str
    category: str # "priority", "urgent", "delivery"
    completed: bool = False
    due_date: Optional[str] = None

class ClientCreate(BaseModel):
    name: str
    project_status: str
    service_type: str
    next_delivery: Optional[str] = None
    billing_status: str
    notes: Optional[str] = ""
    briefing: Optional[str] = ""
    checklist: list = []
    links: dict = {}
    social_posts: dict = {}
    newsletters_count: int = 0
    blog_done: bool = False
    banners_done: bool = False
    url_promos: Optional[str] = ""

class ContentIdeaCreate(BaseModel):
    title: str
    status: str # "idea", "pending", "published"
    reusable: bool = False
    notes: Optional[str] = ""
    reference_url: Optional[str] = ""

class AdminTaskCreate(BaseModel):
    title: str
    type: str # "iva", "irpf", "cuota", "factura", "ingreso"
    amount: Optional[float] = None
    due_date: Optional[str] = None
    status: str = "pending"

def format_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc

# --- Auth Helpers ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user = format_doc(user)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def monthly_reset_job():
    print("Running monthly reset job for clients...")
    db.clients.update_many(
        {"service_type": {"$in": ["Web_Mantenimiento", "NeuroAlly_PRO"]}},
        {"$set": {
            "newsletters_count": 0,
            "blog_done": False,
            "banners_done": False
        }}
    )

scheduler = AsyncIOScheduler()

@app.on_event("startup")
def startup_db_client():
    db.users.create_index("email", unique=True)
    # Seed Admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@nat2go.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin")
    existing = db.users.find_one({"email": admin_email})
    if existing is None:
        db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password), "name": "Admin", "role": "admin"})
    else:
        # always reset password to env if running this env
        db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        
    # Start scheduler
    scheduler.add_job(monthly_reset_job, 'cron', day=1, hour=0, minute=0)
    scheduler.start()

# --- AUTH ENDPOINTS ---
@app.post("/api/auth/login")
def login(creds: UserLogin, response: Response):
    user = db.users.find_one({"email": creds.email.lower()})
    if not user or not verify_password(creds.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, user["email"])
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    u = format_doc(user)
    u.pop("password_hash", None)
    return {"user": u}

@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"status": "ok"}

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return user

# --- CRUD ENDPOINTS ---

@app.get("/api/tasks")
def get_tasks(user: dict = Depends(get_current_user)):
    tasks = list(db.tasks.find({"user_id": user["id"]}))
    return [format_doc(t) for t in tasks]

@app.post("/api/tasks")
def create_task(task: TaskCreate, user: dict = Depends(get_current_user)):
    new_task = task.model_dump()
    new_task["user_id"] = user["id"]
    new_task["created_at"] = datetime.now(timezone.utc).isoformat()
    result = db.tasks.insert_one(new_task)
    new_task["id"] = str(result.inserted_id)
    return format_doc(new_task)

@app.put("/api/tasks/{task_id}")
def update_task(task_id: str, updates: dict, user: dict = Depends(get_current_user)):
    result = db.tasks.find_one_and_update(
        {"_id": ObjectId(task_id), "user_id": user["id"]},
        {"$set": updates},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404)
    return format_doc(result)

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    db.tasks.delete_one({"_id": ObjectId(task_id), "user_id": user["id"]})
    return {"status": "deleted"}

@app.get("/api/clients")
def get_clients(user: dict = Depends(get_current_user)):
    clients = list(db.clients.find({"user_id": user["id"]}))
    return [format_doc(c) for c in clients]

@app.post("/api/clients")
def create_client(client: ClientCreate, user: dict = Depends(get_current_user)):
    new_client = client.model_dump()
    new_client["user_id"] = user["id"]
    
    if new_client.get("service_type") == "NeuroAlly_PRO":
        new_client["checklist"] = [
            {"id": "auditoria", "text": "Auditoría Inicial", "done": False},
            {"id": "accesibilidad", "text": "Informe de Accesibilidad", "done": False},
            {"id": "feedback", "text": "Sesión de Feedback", "done": False},
            {"id": "plan", "text": "Plan de Implementación", "done": False}
        ]
        
    result = db.clients.insert_one(new_client)
    new_client["id"] = str(result.inserted_id)
    return format_doc(new_client)

@app.put("/api/clients/{client_id}")
def update_client(client_id: str, updates: dict, user: dict = Depends(get_current_user)):
    result = db.clients.find_one_and_update(
        {"_id": ObjectId(client_id), "user_id": user["id"]},
        {"$set": updates},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404)
    return format_doc(result)

@app.delete("/api/clients/{client_id}")
def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    db.clients.delete_one({"_id": ObjectId(client_id), "user_id": user["id"]})
    return {"status": "deleted"}

@app.get("/api/content")
def get_content(user: dict = Depends(get_current_user)):
    contents = list(db.content.find({"user_id": user["id"]}))
    return [format_doc(c) for c in contents]

@app.post("/api/content")
def create_content(content: ContentIdeaCreate, user: dict = Depends(get_current_user)):
    new_content = content.model_dump()
    new_content["user_id"] = user["id"]
    result = db.content.insert_one(new_content)
    new_content["id"] = str(result.inserted_id)
    return format_doc(new_content)

@app.put("/api/content/{content_id}")
def update_content(content_id: str, updates: dict, user: dict = Depends(get_current_user)):
    result = db.content.find_one_and_update(
        {"_id": ObjectId(content_id), "user_id": user["id"]},
        {"$set": updates},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404)
    return format_doc(result)

@app.delete("/api/content/{content_id}")
def delete_content(content_id: str, user: dict = Depends(get_current_user)):
    db.content.delete_one({"_id": ObjectId(content_id), "user_id": user["id"]})
    return {"status": "deleted"}

@app.get("/api/admin_tasks")
def get_admin_tasks(user: dict = Depends(get_current_user)):
    tasks = list(db.admin_tasks.find({"user_id": user["id"]}))
    return [format_doc(c) for c in tasks]

@app.post("/api/admin_tasks")
def create_admin_task(task: AdminTaskCreate, user: dict = Depends(get_current_user)):
    new_task = task.model_dump()
    new_task["user_id"] = user["id"]
    result = db.admin_tasks.insert_one(new_task)
    new_task["id"] = str(result.inserted_id)
    return format_doc(new_task)

@app.put("/api/admin_tasks/{task_id}")
def update_admin_task(task_id: str, updates: dict, user: dict = Depends(get_current_user)):
    result = db.admin_tasks.find_one_and_update(
        {"_id": ObjectId(task_id), "user_id": user["id"]},
        {"$set": updates},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404)
    return format_doc(result)

@app.delete("/api/admin_tasks/{task_id}")
def delete_admin_task(task_id: str, user: dict = Depends(get_current_user)):
    db.admin_tasks.delete_one({"_id": ObjectId(task_id), "user_id": user["id"]})
    return {"status": "deleted"}


# --- GOOGLE CALENDAR ENDPOINTS ---
CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
REDIRECT_URI = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001") + "/api/auth/google/callback"

def get_google_creds(user_email: str):
    user = db.users.find_one({"email": user_email})
    tokens = user.get("google_tokens")
    if not tokens:
        return None
    creds = Credentials(
        token=tokens['access_token'],
        refresh_token=tokens.get('refresh_token'),
        token_uri='https://oauth2.googleapis.com/token',
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        db.users.update_one(
            {"email": user_email},
            {"$set": {"google_tokens.access_token": creds.token}}
        )
    return creds

@app.get("/api/auth/google/login")
def google_login(user: dict = Depends(get_current_user)):
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google credentials not configured")
    
    flow = Flow.from_client_config({
        "web": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
        }
    }, scopes=["https://www.googleapis.com/auth/calendar.readonly"], redirect_uri=REDIRECT_URI)
    
    url, state = flow.authorization_url(
        access_type='offline',
        prompt='consent',
        state=user["email"] # pass email as state to link account in callback
    )
    return {"authorization_url": url}

@app.get("/api/auth/google/callback")
def google_callback(code: str, state: str):
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(status_code=400, detail="Google credentials not configured")
    
    token_resp = requests.post('https://oauth2.googleapis.com/token', data={
        'code': code,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI,
        'grant_type': 'authorization_code'
    }).json()
    
    if "access_token" in token_resp:
        db.users.update_one(
            {"email": state},
            {"$set": {"google_tokens": token_resp}}
        )
        
    frontend_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:3000")
    # if it's the external preview URL, usually we want to redirect to the root (which nginx routes to 3000)
    return RedirectResponse(url=f"{frontend_url}/?calendar_connected=true")

@app.get("/api/calendar/events")
def get_calendar_events(user: dict = Depends(get_current_user)):
    creds = get_google_creds(user["email"])
    if not creds:
        # Mock empty list if not connected
        return []
    try:
        service = build('calendar', 'v3', credentials=creds)
        events_result = service.events().list(
            calendarId='primary',
            timeMin=datetime.now(timezone.utc).isoformat(),
            maxResults=10,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        return events_result.get('items', [])
    except Exception as e:
        print("Calendar Error:", e)
        return []
