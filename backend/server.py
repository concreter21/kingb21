import os
import re
import json
import uuid
import base64
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import jwt
import bcrypt
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("tk_safetyguard")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
AI_MODEL = "gemini-3.1-pro-preview"

# Roles allowed to approve, override records, and view all safety data.
PRIVILEGED_ROLES = ("Safety Officer", "Supervisor")
VALID_ROLES = ("Worker", "Contractor", "Supervisor", "Safety Officer")
# Company-shared code required to self-register into a privileged role.
OFFICER_ACCESS_CODE = os.environ.get("OFFICER_ACCESS_CODE", "TK-SAFETY-2026")
MAX_IMAGE_B64 = 12 * 1024 * 1024  # ~9MB decoded upload cap

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "tk-safetyguard"
_storage_key = None

app = FastAPI(title="TK SafetyGuard API")
api = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Object storage helpers
# ---------------------------------------------------------------------------
def init_storage():
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "iat": datetime.now(timezone.utc),
               "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def user_from_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"id": payload["sub"]})
    except Exception:
        raise HTTPException(401, "Invalid or expired token")
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    return await user_from_token(authorization.split(" ", 1)[1])


def public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u.get("name", ""), "role": u.get("role", "Worker")}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = ""
    role: str = "Worker"
    access_code: str = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AssessIn(BaseModel):
    mode: str  # risk | swms | density | machinery
    image_base64: Optional[str] = None
    title: str = ""
    location: str = ""
    notes: str = ""


class LotoIn(BaseModel):
    machine_id: str
    machine_name: str
    location: str = ""
    reason: str = ""
    lock_number: str = ""


class LotoUpdate(BaseModel):
    status: str  # locked | released


class AccessIn(BaseModel):
    type: str  # signin | signout | visitor
    visitor_name: str = ""
    company: str = ""
    purpose: str = ""


class TrafficIn(BaseModel):
    zone_name: str
    zone_type: str  # pedestrian | forklift | shared | loading
    risk_note: str = ""
    controls: str = ""


class IncidentIn(BaseModel):
    title: str
    category: str = "Near Miss"
    severity: str = "Low"
    location: str = ""
    description: str = ""
    image_base64: Optional[str] = None


# ---------------------------------------------------------------------------
# AI
# ---------------------------------------------------------------------------
MODE_PROMPTS = {
    "risk": """You are a certified Australian WHS safety officer. Analyse this workplace photo and produce a LIVE RISK ASSESSMENT aligned with the WHS Act 2011 and the hierarchy of controls.""",
    "swms": """You are a certified Australian WHS safety officer. From this workplace photo, autonomously draft a SAFE WORK METHOD STATEMENT (SWMS) for the high-risk construction/warehouse activity visible, aligned with WHS Regulation 2011.""",
    "density": """You are a warehouse safety analyst. Analyse this photo for WORKER DENSITY and spacing. Estimate number of people, crowding, and social/operational spacing risk.""",
    "machinery": """You are a senior machinery & plant safety engineer for an Australian food-manufacturing warehouse. Analyse this photo of an electronic device, plant or machine to the very best of your ability:
1. IDENTIFY the equipment — its type, and the exact brand/manufacturer and model/series if any nameplate, logo, label, control panel or distinctive design is visible. Read any visible serial numbers, ratings, or compliance plates. State your confidence.
2. Recall the manufacturer's user/operator manual and the applicable Australian standards (e.g. AS 4024 machine safety, AS/NZS 3000 electrical, AS 2359 powered trucks, AS 62841/60335 for tools/appliances) for THIS make & model, and note the key documented safety specifications (guarding, isolation, emergency stop, RCD/earthing, load ratings, service intervals).
3. CROSS-REFERENCE the visible condition against those documented specs. Flag anything out of place, modified, damaged, missing guards, bypassed interlocks, exposed wiring, or otherwise outside the manufacturer's safe operating spec — noting the WARRANTY and INSURANCE implications of operating out of spec.
4. DECIDE an outcome: "PASS" (safe to operate, within spec) or "HAZARD" (out of safety spec — must not be operated until rectified).""",
}

MACHINERY_SCHEMA = """
For the "machinery" object, fill ALL of these sub-keys precisely:
  "machinery": {
    "machine_type": "type of device/plant/machine",
    "brand": "manufacturer/brand or 'Unknown'",
    "model": "model/series or 'Unknown'",
    "identifiers": "any visible serial/rating/compliance-plate text or 'None visible'",
    "identification_confidence": "High|Medium|Low",
    "manual_reference": "the specific operator manual and/or AS standard(s) that apply to this make & model",
    "guarding_status": "Adequate|Inadequate|Missing|Unknown",
    "isolation_note": "LOTO / electrical isolation / e-stop observation",
    "spec_checks": [
      {"item": "what was checked (e.g. blade guard, RCD, e-stop, wiring, load rating)", "requirement": "what the manual/standard requires", "observed": "what is visible in the photo", "status": "Pass|Fail", "reference": "standard/manual clause"}
    ],
    "warranty_insurance_note": "impact on manufacturer warranty and site insurance if operated in the observed condition",
    "compliance_note": "overall AS 4024 / electrical compliance note",
    "outcome": "PASS|HAZARD"
  }
Also include a top-level "hazard_report" object (used only when outcome is HAZARD, otherwise null):
  "hazard_report": {"title": "concise hazard title", "severity": "Low|Medium|High|Critical", "description": "what is unsafe, why, and the manual/standard breached", "immediate_actions": "what to do right now (isolate, tag out, remove from service)"}
"""

JSON_SCHEMA_INSTRUCTION = """
Return ONLY a valid JSON object (no markdown, no commentary) with EXACTLY these keys:
{
  "title": "short descriptive title of the assessment",
  "summary": "2-3 sentence plain-English overview of what was observed",
  "overall_risk_level": "Low" | "Medium" | "High" | "Critical",
  "hazards": [
    {"hazard": "name", "risk_level": "Low|Medium|High|Critical", "likelihood": "Rare|Unlikely|Possible|Likely|Almost Certain", "consequence": "Insignificant|Minor|Moderate|Major|Catastrophic", "controls": ["control 1", "control 2"]}
  ],
  "swms_steps": [
    {"step": "task step description", "hazards": "hazards for this step", "controls": "controls to apply", "ppe": "required PPE"}
  ],
  "density": {"people_count": 0, "area_note": "estimated area / layout note", "density_rating": "Low|Medium|High|Critical", "recommendation": "action to take"},
  "machinery": {"machine_type": "type", "brand": "", "model": "", "identifiers": "", "identification_confidence": "", "manual_reference": "", "guarding_status": "Adequate|Inadequate|Missing|Unknown", "isolation_note": "", "spec_checks": [], "warranty_insurance_note": "", "compliance_note": "", "outcome": "PASS|HAZARD"},
  "hazard_report": null,
  "recommended_actions": ["action 1", "action 2"],
  "legislation_refs": ["WHS Act 2011 s...", "Code of Practice ..."]
}
For modes other than swms, "swms_steps" may be an empty array. For non-density modes "density" may be null. For non-machinery modes "machinery" may be null and "hazard_report" null. Always fill "hazards", "overall_risk_level", "summary", "recommended_actions" and "legislation_refs".
"""


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


async def run_ai(mode: str, image_base64: Optional[str], title: str, location: str, notes: str) -> dict:
    base_prompt = MODE_PROMPTS.get(mode, MODE_PROMPTS["risk"])
    context = f"\nContext provided by worker — Title: {title or 'N/A'}; Location: {location or 'N/A'}; Notes: {notes or 'N/A'}."
    full_prompt = base_prompt + context + "\n" + JSON_SCHEMA_INSTRUCTION
    if mode == "machinery":
        full_prompt += "\n" + MACHINERY_SCHEMA

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"assess-{uuid.uuid4()}",
                   system_message="You output only strict JSON. You are an expert Australian WHS professional and machinery safety engineer.").with_model("gemini", AI_MODEL)

    file_contents = []
    if image_base64:
        clean = image_base64.split(",")[-1]
        file_contents = [ImageContent(image_base64=clean)]

    msg = UserMessage(text=full_prompt, file_contents=file_contents)
    resp = await chat.send_message(msg)
    text = resp if isinstance(resp, str) else str(resp)
    try:
        return _parse_json(text)
    except Exception as e:
        logger.error(f"AI parse failed: {e} :: {text[:400]}")
        return {
            "title": title or f"{mode.title()} Assessment",
            "summary": "AI could not produce a structured result. Please retake the photo with better lighting and framing.",
            "overall_risk_level": "Medium",
            "hazards": [], "swms_steps": [], "density": None, "machinery": None, "hazard_report": None,
            "recommended_actions": ["Retake photo", "Complete manual assessment"],
            "legislation_refs": ["WHS Act 2011"],
        }


# ---------------------------------------------------------------------------
# Routes: auth
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "TK SafetyGuard", "status": "ok"}


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")

    # Validate + gate role. Privileged roles require the company access code;
    # never trust a self-declared privileged role.
    role = body.role if body.role in VALID_ROLES else "Worker"
    if role in PRIVILEGED_ROLES and body.access_code.strip() != OFFICER_ACCESS_CODE:
        raise HTTPException(403, "A valid access code is required for Safety Officer / Supervisor accounts")

    user = {"id": str(uuid.uuid4()), "email": email, "name": body.name.strip() or email.split("@")[0],
            "role": role, "password_hash": hash_pw(body.password),
            "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return {"user": public_user(user)}


# ---------------------------------------------------------------------------
# Routes: files
# ---------------------------------------------------------------------------
@api.get("/files/{path:path}")
async def get_file(path: str, token: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    tok = None
    if authorization and authorization.startswith("Bearer "):
        tok = authorization.split(" ", 1)[1]
    elif token:
        tok = token
    if not tok:
        raise HTTPException(401, "Not authenticated")
    user = await user_from_token(tok)

    # Path traversal guard: only allow this app's namespaced object paths.
    if ".." in path or path.startswith("/") or not path.startswith(f"{APP_NAME}/"):
        raise HTTPException(400, "Invalid file path")

    # Ownership / role check: caller must own a record referencing this file,
    # or hold a privileged safety role (needs oversight access).
    if user.get("role") not in PRIVILEGED_ROLES:
        owns = await db.assessments.find_one({"photo_path": path, "user_id": user["id"], "deleted_at": None})
        if not owns:
            owns = await db.incidents.find_one({"photo_path": path, "reported_by_id": user["id"], "deleted_at": None})
        if not owns:
            raise HTTPException(403, "Not authorised to access this file")

    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(404, "File not found")
    return Response(content=content, media_type=ctype)


async def _store_image_b64(user_id: str, image_base64: str) -> Optional[str]:
    if not image_base64:
        return None
    if len(image_base64) > MAX_IMAGE_B64:
        raise HTTPException(413, "Image too large")
    try:
        clean = image_base64.split(",")[-1]
        data = base64.b64decode(clean)
        path = f"{APP_NAME}/uploads/{user_id}/{uuid.uuid4()}.jpg"
        await run_in_threadpool(put_object, path, data, "image/jpeg")
        return path
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"image store failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Routes: AI assessments
# ---------------------------------------------------------------------------
@api.post("/ai/assess")
async def ai_assess(body: AssessIn, user: dict = Depends(current_user)):
    if body.image_base64 and len(body.image_base64) > MAX_IMAGE_B64:
        raise HTTPException(413, "Image too large")
    result = await run_ai(body.mode, body.image_base64, body.title, body.location, body.notes)
    if body.mode != "machinery" and isinstance(result, dict):
        result["machinery"] = None
        result["hazard_report"] = None
    photo_path = await _store_image_b64(user["id"], body.image_base64) if body.image_base64 else None
    doc = {
        "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user.get("name", ""),
        "mode": body.mode, "title": result.get("title") or body.title or f"{body.mode.title()} Assessment",
        "location": body.location, "notes": body.notes, "photo_path": photo_path,
        "result": result, "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "draft", "approved_by": None, "approved_by_role": None, "approved_at": None,
        "deleted_at": None,
    }
    await db.assessments.insert_one(doc)
    doc.pop("_id", None)

    # Machinery mode: log to Equipment Register and auto-raise a hazard report if out of spec.
    if body.mode == "machinery":
        m = (result.get("machinery") or {}) if isinstance(result.get("machinery"), dict) else {}
        outcome = (m.get("outcome") or "").upper()
        if outcome not in ("PASS", "HAZARD"):
            outcome = "HAZARD" if str(result.get("overall_risk_level", "")).lower() in ("high", "critical") else "PASS"

        equip = {
            "id": str(uuid.uuid4()), "user_id": user["id"], "assessed_by": user.get("name", ""),
            "assessment_id": doc["id"], "photo_path": photo_path,
            "machine_type": m.get("machine_type", ""), "brand": m.get("brand", "Unknown"),
            "model": m.get("model", "Unknown"), "identifiers": m.get("identifiers", ""),
            "location": body.location, "outcome": outcome,
            "manual_reference": m.get("manual_reference", ""),
            "created_at": datetime.now(timezone.utc).isoformat(), "deleted_at": None,
        }
        await db.equipment.insert_one(equip)

        hazard_incident_id = None
        if outcome == "HAZARD":
            hr = result.get("hazard_report") or {}
            eq_name = " ".join([x for x in [m.get("brand"), m.get("model"), m.get("machine_type")] if x and x != "Unknown"]).strip() or "Machinery"
            inc = {
                "id": str(uuid.uuid4()),
                "title": hr.get("title") or f"HAZARD: {eq_name} out of safety spec",
                "category": "Hazard", "severity": hr.get("severity") or result.get("overall_risk_level", "High"),
                "location": body.location,
                "description": (hr.get("description") or result.get("summary", "")) +
                               (f"\n\nImmediate actions: {hr.get('immediate_actions')}" if hr.get("immediate_actions") else "") +
                               (f"\n\nWarranty/Insurance: {m.get('warranty_insurance_note')}" if m.get("warranty_insurance_note") else ""),
                "photo_path": photo_path, "status": "open", "reported_by": user.get("name", ""),
                "reported_by_id": user["id"], "source": "machinery-ai", "assessment_id": doc["id"],
                "created_at": datetime.now(timezone.utc).isoformat(), "deleted_at": None,
            }
            await db.incidents.insert_one(inc)
            hazard_incident_id = inc["id"]

        doc["equipment_outcome"] = outcome
        doc["hazard_incident_id"] = hazard_incident_id
        await db.assessments.update_one({"id": doc["id"]},
                                        {"$set": {"equipment_outcome": outcome, "hazard_incident_id": hazard_incident_id}})

    return doc


@api.get("/equipment")
async def list_equipment(user: dict = Depends(current_user)):
    q = {"deleted_at": None}
    if user.get("role") not in PRIVILEGED_ROLES:
        q["user_id"] = user["id"]
    return await db.equipment.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)


@api.get("/assessments")
async def list_assessments(user: dict = Depends(current_user), mode: Optional[str] = None):
    q = {"deleted_at": None}
    # Workers see only their own; Safety Officers / Supervisors review all.
    if user.get("role") not in PRIVILEGED_ROLES:
        q["user_id"] = user["id"]
    if mode:
        q["mode"] = mode
    items = await db.assessments.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.get("/assessments/{aid}")
async def get_assessment(aid: str, user: dict = Depends(current_user)):
    q = {"id": aid, "deleted_at": None}
    if user.get("role") not in PRIVILEGED_ROLES:
        q["user_id"] = user["id"]
    doc = await db.assessments.find_one(q, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Assessment not found")
    return doc


@api.delete("/assessments/{aid}")
async def delete_assessment(aid: str, user: dict = Depends(current_user)):
    q = {"id": aid}
    if user.get("role") not in PRIVILEGED_ROLES:
        q["user_id"] = user["id"]
    doc = await db.assessments.find_one(q)
    if not doc:
        raise HTTPException(404, "Assessment not found")
    await db.assessments.update_one({"id": aid},
                                    {"$set": {"deleted_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True}


@api.patch("/assessments/{aid}/approve")
async def approve_assessment(aid: str, user: dict = Depends(current_user)):
    if user.get("role") not in PRIVILEGED_ROLES:
        raise HTTPException(403, "Only Safety Officers and Supervisors can approve assessments")
    doc = await db.assessments.find_one({"id": aid, "deleted_at": None})
    if not doc:
        raise HTTPException(404, "Assessment not found")
    await db.assessments.update_one({"id": aid}, {"$set": {
        "status": "approved",
        "approved_by": user.get("name", ""),
        "approved_by_role": user.get("role", ""),
        "approved_at": datetime.now(timezone.utc).isoformat(),
    }})
    return await db.assessments.find_one({"id": aid}, {"_id": 0})


# ---------------------------------------------------------------------------
# Routes: LOTO register
# ---------------------------------------------------------------------------
@api.get("/loto")
async def list_loto(user: dict = Depends(current_user)):
    return await db.loto.find({"deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/loto")
async def create_loto(body: LotoIn, user: dict = Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), **body.dict(), "status": "locked",
           "applied_by": user.get("name", ""), "applied_by_id": user["id"],
           "created_at": datetime.now(timezone.utc).isoformat(),
           "released_at": None, "released_by": None, "deleted_at": None}
    await db.loto.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/loto/{lid}")
async def update_loto(lid: str, body: LotoUpdate, user: dict = Depends(current_user)):
    if body.status not in ("locked", "released"):
        raise HTTPException(422, "Invalid status")
    doc = await db.loto.find_one({"id": lid})
    if not doc:
        raise HTTPException(404, "Lock not found")
    # WHS: only the worker who applied the lock, or an authorised safety role,
    # may release/modify it.
    if doc.get("applied_by_id") != user["id"] and user.get("role") not in PRIVILEGED_ROLES:
        raise HTTPException(403, "Only the lock owner or a Safety Officer can change this lock")
    upd = {"status": body.status}
    if body.status == "released":
        upd["released_at"] = datetime.now(timezone.utc).isoformat()
        upd["released_by"] = user.get("name", "")
    await db.loto.update_one({"id": lid}, {"$set": upd})
    doc = await db.loto.find_one({"id": lid}, {"_id": 0})
    return doc


# ---------------------------------------------------------------------------
# Routes: site access
# ---------------------------------------------------------------------------
@api.get("/access")
async def list_access(user: dict = Depends(current_user)):
    records = await db.access.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    last_self = await db.access.find_one({"user_id": user["id"], "type": {"$in": ["signin", "signout"]}},
                                         sort=[("created_at", -1)])
    status = "out"
    if last_self and last_self.get("type") == "signin":
        status = "in"
    on_site = 0
    # count users currently signed in
    pipeline_users = await db.access.find({"type": {"$in": ["signin", "signout"]}}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    state = {}
    for r in pipeline_users:
        state[r["user_id"]] = r["type"]
    on_site = sum(1 for v in state.values() if v == "signin")
    return {"status": status, "on_site": on_site, "records": records}


@api.post("/access")
async def create_access(body: AccessIn, user: dict = Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), "type": body.type, "user_id": user["id"],
           "user_name": user.get("name", ""), "visitor_name": body.visitor_name,
           "company": body.company, "purpose": body.purpose,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.access.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Routes: traffic management
# ---------------------------------------------------------------------------
@api.get("/traffic")
async def list_traffic(user: dict = Depends(current_user)):
    return await db.traffic.find({"deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/traffic")
async def create_traffic(body: TrafficIn, user: dict = Depends(current_user)):
    doc = {"id": str(uuid.uuid4()), **body.dict(), "created_by": user.get("name", ""),
           "created_at": datetime.now(timezone.utc).isoformat(), "deleted_at": None}
    await db.traffic.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Routes: incidents
# ---------------------------------------------------------------------------
@api.get("/incidents")
async def list_incidents(user: dict = Depends(current_user)):
    return await db.incidents.find({"deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.post("/incidents")
async def create_incident(body: IncidentIn, user: dict = Depends(current_user)):
    photo_path = await _store_image_b64(user["id"], body.image_base64) if body.image_base64 else None
    doc = {"id": str(uuid.uuid4()), "title": body.title, "category": body.category,
           "severity": body.severity, "location": body.location, "description": body.description,
           "photo_path": photo_path, "status": "open", "reported_by": user.get("name", ""),
           "reported_by_id": user["id"], "created_at": datetime.now(timezone.utc).isoformat(),
           "deleted_at": None}
    await db.incidents.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/incidents/{iid}")
async def update_incident(iid: str, status: str = Query(...), user: dict = Depends(current_user)):
    if status not in ("open", "closed"):
        raise HTTPException(422, "Invalid status")
    doc = await db.incidents.find_one({"id": iid, "deleted_at": None})
    if not doc:
        raise HTTPException(404, "Incident not found")
    # Only the reporter or an authorised safety role may change incident status.
    if doc.get("reported_by_id") != user["id"] and user.get("role") not in PRIVILEGED_ROLES:
        raise HTTPException(403, "Only the reporter or a Safety Officer can change this incident")
    await db.incidents.update_one({"id": iid}, {"$set": {"status": status}})
    return await db.incidents.find_one({"id": iid}, {"_id": 0})


# ---------------------------------------------------------------------------
# Routes: dashboard
# ---------------------------------------------------------------------------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    open_incidents = await db.incidents.count_documents({"status": "open", "deleted_at": None})
    active_locks = await db.loto.count_documents({"status": "locked", "deleted_at": None})
    assessments_count = await db.assessments.count_documents({"deleted_at": None})
    traffic_zones = await db.traffic.count_documents({"deleted_at": None})
    equipment_count = await db.equipment.count_documents({"deleted_at": None})
    equipment_hazard = await db.equipment.count_documents({"outcome": "HAZARD", "deleted_at": None})

    # on-site count
    recs = await db.access.find({"type": {"$in": ["signin", "signout"]}}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    state = {}
    for r in recs:
        state[r["user_id"]] = r["type"]
    on_site = sum(1 for v in state.values() if v == "signin")

    recent = await db.assessments.find({"deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(5)
    return {
        "open_incidents": open_incidents,
        "active_locks": active_locks,
        "assessments_count": assessments_count,
        "traffic_zones": traffic_zones,
        "equipment_count": equipment_count,
        "equipment_hazard": equipment_hazard,
        "on_site": on_site,
        "recent_assessments": recent,
    }


# ---------------------------------------------------------------------------
app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    try:
        await run_in_threadpool(init_storage)
        logger.info("Object storage initialised")
    except Exception as e:
        logger.error(f"storage init failed: {e}")
    await db.users.create_index("email", unique=True)


@app.on_event("shutdown")
async def shutdown():
    client.close()
