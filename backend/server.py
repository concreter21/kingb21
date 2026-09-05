from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusCheckCreate(BaseModel):
    client_name: str


class SWMSGenerateRequest(BaseModel):
    site: str
    job_type: str
    notes: Optional[str] = ""
    model_provider: Optional[str] = "openai"  # openai | gemini | anthropic
    model_name: Optional[str] = None


class SWMSSection(BaseModel):
    hazards: List[str]
    controls: List[str]
    ppe: List[str]
    summary: str


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AgentChatRequest(BaseModel):
    session_id: str
    message: str
    history: Optional[List[ChatMessage]] = []
    model_provider: Optional[str] = "openai"
    model_name: Optional[str] = None


class AgentChatResponse(BaseModel):
    reply: str
    session_id: str


class VoiceHazardRequest(BaseModel):
    transcript: str
    site: Optional[str] = None


class VoiceHazardResponse(BaseModel):
    site: str
    hazard_type: str
    severity: str
    description: str


class VisionRiskRequest(BaseModel):
    images: List[str]  # base64 (with or without data URL prefix)
    site: str
    job_type: str
    notes: Optional[str] = ""


class VisionRiskResponse(BaseModel):
    observations: List[str]
    hazards: List[str]
    controls: List[str]
    ppe: List[str]
    summary: str
    risk_level: str  # low | medium | high | critical


class RiskWatchRequest(BaseModel):
    image: str  # single base64 (with or without data URL prefix)
    site: str
    job_type: Optional[str] = ""
    recent_alerts: Optional[List[str]] = []  # last few alert texts to avoid duplicates


class RiskWatchResponse(BaseModel):
    has_hazard: bool
    severity: str  # none | low | medium | high | critical
    alert: str
    recommendation: str
    timestamp: str


class WatchAlertLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    site: str
    job_type: Optional[str] = ""
    severity: str
    alert: str
    recommendation: Optional[str] = ""
    snapshot_b64: Optional[str] = ""  # data URL or raw base64
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    filed_as_hazard: bool = False
    hazard_id: Optional[str] = None


class WatchAlertCreate(BaseModel):
    site: str
    job_type: Optional[str] = ""
    severity: str
    alert: str
    recommendation: Optional[str] = ""
    snapshot_b64: Optional[str] = ""


class HazardRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    site: str
    hazard_type: str
    severity: str
    status: str = "open"  # open | in_review | mitigated | closed
    reported_by: str = "M. Weber"
    description: Optional[str] = ""
    snapshot_b64: Optional[str] = ""
    source: str = "manual"  # manual | voice | watch
    watch_alert_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class HazardCreate(BaseModel):
    site: str
    hazard_type: str
    severity: str
    description: Optional[str] = ""
    snapshot_b64: Optional[str] = ""
    source: str = "manual"
    reported_by: str = "M. Weber"
    watch_alert_id: Optional[str] = None


@api_router.get("/")
async def root():
    return {"message": "Hello World"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.dict())
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]


def _pick_model(provider: Optional[str], name: Optional[str]) -> tuple[str, str]:
    """Return (provider, model_name) with safe defaults."""
    p = (provider or "openai").lower()
    if p == "gemini":
        return ("gemini", name or "gemini-3-flash-preview")
    if p == "anthropic":
        return ("anthropic", name or "claude-sonnet-4-6")
    return ("openai", name or "gpt-4o-mini")


@api_router.post("/swms/generate", response_model=SWMSSection)
async def generate_swms(req: SWMSGenerateRequest):
    """Generate SWMS content using GPT."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM library missing: {e}")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    system_msg = (
        "You are a solar-installation safety expert generating a Safe Work Method "
        "Statement (SWMS) for domestic and commercial PV projects. "
        "Respond ONLY with valid JSON matching this exact schema (no markdown, no prose): "
        '{"hazards": ["..."], "controls": ["..."], "ppe": ["..."], "summary": "..."}. '
        "Provide 4-6 concise hazards, 4-6 concrete controls, 4-6 PPE items, and a 2-sentence summary."
    )

    user_prompt = (
        f"Site: {req.site}\n"
        f"Job type: {req.job_type}\n"
        f"Additional notes: {req.notes or 'none'}\n\n"
        "Generate the SWMS JSON now."
    )

    session_id = f"swms-{uuid.uuid4()}"
    prov, mname = _pick_model(req.model_provider, req.model_name)
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_msg,
    ).with_model(prov, mname)

    try:
        reply = await chat.send_message(UserMessage(text=user_prompt))
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)[:200]}")

    text = reply if isinstance(reply, str) else str(reply)
    # Strip markdown fences if the model wraps
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        data = json.loads(text)
        return SWMSSection(**data)
    except Exception as e:
        logger.error(f"Parse error: {e} | text={text[:300]}")
        # Fallback structured response
        return SWMSSection(
            hazards=["Working at heights", "Electrical shock from live DC circuits",
                     "Manual handling of PV modules", "Weather exposure (UV, heat)"],
            controls=["Use certified fall-arrest harness and anchor points",
                      "Isolate and lock out DC circuits before work",
                      "Two-person lift for modules over 20kg",
                      "Rotate breaks and hydrate; monitor weather forecast"],
            ppe=["Hard hat", "Safety glasses", "Insulated gloves (Class 0)",
                 "Non-slip safety boots", "Hi-vis vest"],
            summary=f"SWMS for {req.job_type} at {req.site}. Follow all controls and PPE listed.",
        )


@api_router.post("/agent/chat", response_model=AgentChatResponse)
async def agent_chat(req: AgentChatRequest):
    """SolarSafe in-app assistant for guidance & troubleshooting."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM library missing: {e}")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    system_msg = (
        "You are SolarSafe Assistant, a helpful in-app AI for a solar-installation "
        "safety management platform. You help site supervisors and crew with: "
        "SWMS (Safe Work Method Statements), hazard reporting, lockout/tagout procedures, "
        "compliance docs (AS/NZS 5033, DIN VDE 0100-712), PPE, and troubleshooting the app. "
        "Be concise, friendly, and practical. Use short paragraphs and bullet points where useful. "
        "If asked about non-safety topics, gently redirect back to solar safety."
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=req.session_id,
        system_message=system_msg,
    ).with_model(*_pick_model(req.model_provider, req.model_name))

    # Replay history so the model has context
    for msg in (req.history or [])[-8:]:
        if msg.role == "user":
            try:
                await chat.send_message(UserMessage(text=msg.content))
            except Exception:
                pass

    try:
        reply = await chat.send_message(UserMessage(text=req.message))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {str(e)[:200]}")

    reply_text = reply if isinstance(reply, str) else str(reply)
    return AgentChatResponse(reply=reply_text, session_id=req.session_id)


def _strip_json_fences(text: str) -> str:
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    return text


@api_router.post("/hazards/from-voice", response_model=VoiceHazardResponse)
async def structure_voice_hazard(req: VoiceHazardRequest):
    """Convert free-form voice transcript into a structured hazard report."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM library missing: {e}")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    system_msg = (
        "You extract structured hazard reports from spoken transcripts of solar-installation crew members. "
        "Respond ONLY with valid JSON: "
        '{"site": "...", "hazard_type": "...", "severity": "low|medium|high|critical", "description": "..."}. '
        "If a site was already provided, use it verbatim. Otherwise infer a short site name from context. "
        "Hazard type should be short (e.g. 'Exposed live conductor', 'Fall risk – unprotected edge'). "
        "Description should be 1-2 sentences summarising the situation."
    )

    prompt = (
        f"Pre-selected site: {req.site or 'not specified'}\n\n"
        f"Transcript:\n\"\"\"{req.transcript}\"\"\"\n\n"
        "Return the JSON now."
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=f"voice-{uuid.uuid4()}",
        system_message=system_msg,
    ).with_model("openai", "gpt-4o-mini")

    try:
        reply = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)[:200]}")

    text = _strip_json_fences(reply if isinstance(reply, str) else str(reply))
    try:
        data = json.loads(text)
        sev = str(data.get("severity", "medium")).lower()
        if sev not in ("low", "medium", "high", "critical"):
            sev = "medium"
        return VoiceHazardResponse(
            site=data.get("site") or req.site or "Unspecified site",
            hazard_type=data.get("hazard_type", "Uncategorised"),
            severity=sev,
            description=data.get("description", req.transcript[:200]),
        )
    except Exception:
        return VoiceHazardResponse(
            site=req.site or "Unspecified site",
            hazard_type="Voice report",
            severity="medium",
            description=req.transcript[:400],
        )


@api_router.post("/risk/assess", response_model=VisionRiskResponse)
async def assess_risk_from_images(req: VisionRiskRequest):
    """Analyse site photos with vision AI and produce a full risk assessment + SWMS."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM library missing: {e}")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    if not req.images:
        raise HTTPException(status_code=400, detail="At least one image is required")

    # Strip data URL prefixes if present
    clean_images = []
    for img in req.images[:5]:  # cap to 5 images
        if "," in img and img.startswith("data:"):
            img = img.split(",", 1)[1]
        clean_images.append(img)

    system_msg = (
        "You are an expert solar-installation safety auditor. You analyse on-site photos "
        "and produce a risk assessment plus Safe Work Method Statement (SWMS). "
        "Respond ONLY with valid JSON matching this schema: "
        '{"observations": ["what you literally see in the photos"], '
        '"hazards": ["specific hazards identified"], '
        '"controls": ["mitigating controls"], '
        '"ppe": ["required PPE"], '
        '"summary": "2-sentence summary", '
        '"risk_level": "low|medium|high|critical"}. '
        "Provide 3-5 items per list. Be specific and reference what you actually see in the images."
    )

    prompt = (
        f"Site: {req.site}\n"
        f"Job type: {req.job_type}\n"
        f"Notes: {req.notes or 'none'}\n\n"
        "Analyse the attached photos and return the JSON now."
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=f"risk-{uuid.uuid4()}",
        system_message=system_msg,
    ).with_model("openai", "gpt-4o-mini")

    image_contents = [ImageContent(image_base64=img) for img in clean_images]

    try:
        reply = await chat.send_message(
            UserMessage(text=prompt, file_contents=image_contents)
        )
    except Exception as e:
        logger.error(f"Vision LLM error: {e}")
        raise HTTPException(status_code=500, detail=f"Vision error: {str(e)[:200]}")

    text = _strip_json_fences(reply if isinstance(reply, str) else str(reply))
    try:
        data = json.loads(text)
        rl = str(data.get("risk_level", "medium")).lower()
        if rl not in ("low", "medium", "high", "critical"):
            rl = "medium"
        return VisionRiskResponse(
            observations=data.get("observations", []) or [],
            hazards=data.get("hazards", []) or [],
            controls=data.get("controls", []) or [],
            ppe=data.get("ppe", []) or [],
            summary=data.get("summary", ""),
            risk_level=rl,
        )
    except Exception as e:
        logger.error(f"Vision parse error: {e} | text={text[:300]}")
        return VisionRiskResponse(
            observations=["Rooftop PV work area with modules and mounting hardware visible"],
            hazards=["Working at heights", "Exposed live DC circuits", "Manual handling of modules"],
            controls=["Fall-arrest harness with rated anchor", "Isolate & lock out DC before work",
                      "Two-person lift for modules"],
            ppe=["Hard hat", "Insulated gloves", "Safety boots", "Hi-vis vest"],
            summary=f"AI risk assessment for {req.job_type} at {req.site}. Review before use.",
            risk_level="medium",
        )


@api_router.post("/risk/watch", response_model=RiskWatchResponse)
async def risk_watch(req: RiskWatchRequest):
    """Continuous-monitoring endpoint: analyse a single frame and return a
    concise alert if a new hazard appears in view."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM library missing: {e}")

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    if not req.image:
        raise HTTPException(status_code=400, detail="Image is required")

    img = req.image
    if "," in img and img.startswith("data:"):
        img = img.split(",", 1)[1]

    recent_context = ""
    if req.recent_alerts:
        recent_context = "Recent alerts you already flagged (avoid duplicating):\n" + \
            "\n".join(f"- {a}" for a in req.recent_alerts[-5:])

    system_msg = (
        "You are a real-time safety observer for a solar-installation crew. "
        "You look at ONE frame from a live camera feed and decide if a new safety hazard is visible. "
        "Be strict: only flag genuine hazards (missing PPE, unsafe positioning, exposed cables, "
        "damaged equipment, fall risk, fire/heat, obstructed egress, weather threats). "
        "Respond ONLY with valid JSON: "
        '{"has_hazard": true|false, '
        '"severity": "none|low|medium|high|critical", '
        '"alert": "one short sentence about the hazard, or empty string if none", '
        '"recommendation": "one short action for the crew, or empty string if none"}. '
        "If no hazard: has_hazard=false, severity='none', empty strings for alert/recommendation."
    )

    prompt = (
        f"Site: {req.site}\n"
        f"Job type: {req.job_type or 'unspecified'}\n\n"
        f"{recent_context}\n\n"
        "Analyse the current frame and return JSON now."
    )

    chat = LlmChat(
        api_key=api_key,
        session_id=f"watch-{uuid.uuid4()}",
        system_message=system_msg,
    ).with_model("openai", "gpt-4o-mini")

    try:
        reply = await chat.send_message(
            UserMessage(text=prompt, file_contents=[ImageContent(image_base64=img)])
        )
    except Exception as e:
        logger.error(f"Watch LLM error: {e}")
        raise HTTPException(status_code=500, detail=f"Watch error: {str(e)[:200]}")

    text = _strip_json_fences(reply if isinstance(reply, str) else str(reply))
    ts = datetime.utcnow().isoformat()
    try:
        data = json.loads(text)
        sev = str(data.get("severity", "none")).lower()
        if sev not in ("none", "low", "medium", "high", "critical"):
            sev = "none"
        has = bool(data.get("has_hazard", False)) and sev != "none"
        return RiskWatchResponse(
            has_hazard=has,
            severity=sev if has else "none",
            alert=str(data.get("alert", "")) if has else "",
            recommendation=str(data.get("recommendation", "")) if has else "",
            timestamp=ts,
        )
    except Exception as e:
        logger.error(f"Watch parse error: {e} | text={text[:200]}")
        return RiskWatchResponse(
            has_hazard=False, severity="none", alert="", recommendation="", timestamp=ts
        )


def _doc_to_watch_alert(doc):
    doc.pop("_id", None)
    if isinstance(doc.get("timestamp"), datetime):
        doc["timestamp"] = doc["timestamp"]
    return WatchAlertLog(**doc)


def _doc_to_hazard(doc):
    doc.pop("_id", None)
    return HazardRecord(**doc)


@api_router.post("/watch/log", response_model=WatchAlertLog)
async def log_watch_alert(payload: WatchAlertCreate):
    """Persist a detected watch alert (and its snapshot) into MongoDB."""
    alert = WatchAlertLog(**payload.dict())
    await db.watch_alerts.insert_one(alert.dict())
    return alert


@api_router.get("/watch/history", response_model=List[WatchAlertLog])
async def get_watch_history(
    site: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
):
    """Retrieve the alert timeline, newest first."""
    query = {}
    if site:
        query["site"] = site
    if severity:
        query["severity"] = severity
    if search:
        query["alert"] = {"$regex": search, "$options": "i"}
    cursor = db.watch_alerts.find(query).sort("timestamp", -1).limit(max(1, min(500, limit)))
    docs = await cursor.to_list(500)
    return [_doc_to_watch_alert(d) for d in docs]


@api_router.delete("/watch/history")
async def clear_watch_history():
    result = await db.watch_alerts.delete_many({})
    return {"deleted": result.deleted_count}


@api_router.post("/hazards", response_model=HazardRecord)
async def create_hazard(payload: HazardCreate):
    """Persist a hazard record (e.g. filed from a critical watch alert)."""
    hazard = HazardRecord(**payload.dict())
    await db.hazards.insert_one(hazard.dict())
    # If this hazard was filed from a watch alert, mark it
    if payload.watch_alert_id:
        await db.watch_alerts.update_one(
            {"id": payload.watch_alert_id},
            {"$set": {"filed_as_hazard": True, "hazard_id": hazard.id}},
        )
    return hazard


@api_router.get("/hazards", response_model=List[HazardRecord])
async def list_hazards(limit: int = 100):
    cursor = db.hazards.find().sort("timestamp", -1).limit(max(1, min(500, limit)))
    docs = await cursor.to_list(500)
    return [_doc_to_hazard(d) for d in docs]


@api_router.delete("/hazards/{hazard_id}")
async def delete_hazard(hazard_id: str):
    result = await db.hazards.delete_one({"id": hazard_id})
    return {"deleted": result.deleted_count}


@api_router.delete("/hazards")
async def clear_hazards():
    result = await db.hazards.delete_many({})
    return {"deleted": result.deleted_count}


@api_router.delete("/watch/history/{alert_id}")
async def delete_watch_alert(alert_id: str):
    result = await db.watch_alerts.delete_one({"id": alert_id})
    return {"deleted": result.deleted_count}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
