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


class AgentChatResponse(BaseModel):
    reply: str
    session_id: str


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
    chat = LlmChat(
        api_key=api_key,
        session_id=session_id,
        system_message=system_msg,
    ).with_model("openai", "gpt-4o-mini")

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
    ).with_model("openai", "gpt-4o-mini")

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
