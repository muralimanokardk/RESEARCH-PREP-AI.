"""
Research Prep AI - Backend API
FastAPI + MongoDB + Claude Sonnet 4.5 via emergentintegrations
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import uuid
import logging
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Any, Dict
from datetime import datetime, timedelta, timezone

import fitz  # PyMuPDF
from emergentintegrations.llm.chat import LlmChat, UserMessage
from billing import build_router as build_billing_router, require_quota

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Research Prep AI")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("research-prep-ai")

CLAUDE_MODEL_PROVIDER = "anthropic"
CLAUDE_MODEL_NAME = "claude-sonnet-4-5-20250929"

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "student"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class ProjectCreate(BaseModel):
    title: str
    domain: str
    description: Optional[str] = ""
    keywords: Optional[str] = ""

class ProjectOut(BaseModel):
    id: str
    user_id: str
    title: str
    domain: str
    description: str
    keywords: str
    status: str
    created_at: str
    updated_at: str

class TopicGenRequest(BaseModel):
    project_id: str
    domain: Optional[str] = None
    keywords: Optional[str] = None
    interest: Optional[str] = ""

class TopicOut(BaseModel):
    id: str
    project_id: str
    topic_name: str
    novelty_score: int
    difficulty_score: int
    datasets: List[str]
    description: str
    generated_at: str

class PaperCreate(BaseModel):
    project_id: str
    title: str
    authors: Optional[str] = ""
    year: Optional[int] = None
    doi: Optional[str] = ""
    text_content: Optional[str] = ""  # raw text if user pastes it

class PaperOut(BaseModel):
    id: str
    project_id: str
    title: str
    authors: str
    year: Optional[int]
    doi: str
    summary: str
    methodology: str
    dataset_used: str
    results: str
    created_at: str

class LitReviewRequest(BaseModel):
    project_id: str

class ResearchGapRequest(BaseModel):
    project_id: str

class ResearchGapOut(BaseModel):
    id: str
    project_id: str
    existing_work_summary: str
    gaps: List[Dict[str, Any]]
    future_scope: List[str]
    created_at: str

class ProposalRequest(BaseModel):
    project_id: str
    selected_topic: Optional[str] = None

class ProposalOut(BaseModel):
    id: str
    project_id: str
    title: str
    abstract: str
    problem_statement: str
    objectives: List[str]
    scope: str
    methodology: str
    future_scope: str
    created_at: str
    updated_at: str

class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    abstract: Optional[str] = None
    problem_statement: Optional[str] = None
    objectives: Optional[List[str]] = None
    scope: Optional[str] = None
    methodology: Optional[str] = None
    future_scope: Optional[str] = None

class CitationRequest(BaseModel):
    project_id: str
    style: str  # IEEE, APA, MLA, Chicago

class PPTRequest(BaseModel):
    project_id: str

class PDFUploadPayload(BaseModel):
    project_id: str
    filename: str
    base64_data: str  # base64-encoded PDF

class ChatRequest(BaseModel):
    project_id: str
    question: str

# ---------------------------------------------------------------------------
# Utils
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def check_password(pw: str, pw_hash: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), pw_hash.encode())
    except Exception:
        return False

def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def strip_json_block(text: str) -> str:
    """Remove markdown code fences and return raw JSON string."""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if m:
        return m.group(1).strip()
    return text

async def claude_json(system: str, user_prompt: str, max_tokens: int = 4000) -> Any:
    """Call Claude Sonnet 4.5 and parse a JSON response robustly."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"rpa-{uuid.uuid4()}",
        system_message=system,
    ).with_model(CLAUDE_MODEL_PROVIDER, CLAUDE_MODEL_NAME).with_params(max_tokens=max_tokens)
    resp = await chat.send_message(UserMessage(text=user_prompt))
    raw = strip_json_block(resp if isinstance(resp, str) else str(resp))
    try:
        return json.loads(raw)
    except Exception:
        # try to find first JSON object/array in the string
        start = min([i for i in [raw.find("{"), raw.find("[")] if i != -1] or [-1])
        end = max(raw.rfind("}"), raw.rfind("]"))
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except Exception:
                pass
        log.warning("claude_json parse fallback, returning raw text")
        return {"raw": raw}

async def claude_text(system: str, user_prompt: str, max_tokens: int = 3000) -> str:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"rpa-{uuid.uuid4()}",
        system_message=system,
    ).with_model(CLAUDE_MODEL_PROVIDER, CLAUDE_MODEL_NAME).with_params(max_tokens=max_tokens)
    resp = await chat.send_message(UserMessage(text=user_prompt))
    return resp if isinstance(resp, str) else str(resp)

def chunk_text(text: str, size: int = 1200, overlap: int = 150) -> List[str]:
    text = re.sub(r"\s+", " ", text).strip()
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i:i + size])
        i += size - overlap
    return chunks

def keyword_score(chunk: str, query: str) -> float:
    tokens = [t.lower() for t in re.findall(r"[a-zA-Z0-9]+", query) if len(t) > 2]
    if not tokens:
        return 0.0
    chunk_l = chunk.lower()
    return sum(chunk_l.count(t) for t in tokens) / max(1, len(chunk))

async def retrieve_context(project_id: str, query: str, k: int = 6) -> str:
    cursor = db.paper_chunks.find({"project_id": project_id}, {"_id": 0})
    scored = []
    async for c in cursor:
        s = keyword_score(c["text"], query)
        if s > 0:
            scored.append((s, c["text"], c.get("paper_title", "")))
    scored.sort(reverse=True, key=lambda x: x[0])
    top = scored[:k]
    if not top:
        return ""
    return "\n\n".join(f"[Source: {t[2]}]\n{t[1]}" for t in top)

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"status": "ok", "service": "Research Prep AI"}

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@api.post("/auth/register", response_model=AuthResponse)
async def register(body: UserRegister):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": body.name,
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "role": body.role,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = make_token(user_id)
    return AuthResponse(
        token=token,
        user=UserOut(id=user_id, name=body.name, email=body.email.lower(),
                     role=body.role, created_at=user_doc["created_at"]),
    )

@api.post("/auth/login", response_model=AuthResponse)
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not check_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = make_token(user["id"])
    return AuthResponse(
        token=token,
        user=UserOut(
            id=user["id"], name=user["name"], email=user["email"],
            role=user.get("role", "student"), created_at=user["created_at"],
        ),
    )

@api.get("/auth/me", response_model=UserOut)
async def me(current=Depends(get_current_user)):
    return UserOut(
        id=current["id"], name=current["name"], email=current["email"],
        role=current.get("role", "student"), created_at=current["created_at"],
    )

# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
@api.get("/projects", response_model=List[ProjectOut])
async def list_projects(current=Depends(get_current_user)):
    cursor = db.projects.find({"user_id": current["id"]}, {"_id": 0}).sort("updated_at", -1)
    out = []
    async for p in cursor:
        out.append(ProjectOut(**p))
    return out

@api.post("/projects", response_model=ProjectOut)
async def create_project(body: ProjectCreate, current=Depends(get_current_user)):
    pid = str(uuid.uuid4())
    doc = {
        "id": pid,
        "user_id": current["id"],
        "title": body.title,
        "domain": body.domain,
        "description": body.description or "",
        "keywords": body.keywords or "",
        "status": "active",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.projects.insert_one(doc)
    return ProjectOut(**{k: v for k, v in doc.items() if k != "_id"})

@api.get("/projects/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, current=Depends(get_current_user)):
    p = await db.projects.find_one({"id": project_id, "user_id": current["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectOut(**p)

@api.delete("/projects/{project_id}")
async def delete_project(project_id: str, current=Depends(get_current_user)):
    res = await db.projects.delete_one({"id": project_id, "user_id": current["id"]})
    await db.research_topics.delete_many({"project_id": project_id})
    await db.papers.delete_many({"project_id": project_id})
    await db.paper_chunks.delete_many({"project_id": project_id})
    await db.literature_reviews.delete_many({"project_id": project_id})
    await db.research_gaps.delete_many({"project_id": project_id})
    await db.proposals.delete_many({"project_id": project_id})
    await db.presentations.delete_many({"project_id": project_id})
    return {"deleted": res.deleted_count}

async def _touch_project(project_id: str):
    await db.projects.update_one({"id": project_id}, {"$set": {"updated_at": now_iso()}})

# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------
@api.get("/dashboard/stats")
async def dashboard_stats(current=Depends(get_current_user)):
    uid = current["id"]
    projects_count = await db.projects.count_documents({"user_id": uid})
    project_ids = [p["id"] async for p in db.projects.find({"user_id": uid}, {"id": 1, "_id": 0})]
    papers_count = await db.papers.count_documents({"project_id": {"$in": project_ids}}) if project_ids else 0
    topics_count = await db.research_topics.count_documents({"project_id": {"$in": project_ids}}) if project_ids else 0
    proposals_count = await db.proposals.count_documents({"project_id": {"$in": project_ids}}) if project_ids else 0
    return {
        "projects": projects_count,
        "papers": papers_count,
        "topics": topics_count,
        "proposals": proposals_count,
        "activity": [
            {"label": "W1", "sources": max(2, papers_count), "summaries": max(1, proposals_count)},
            {"label": "W2", "sources": max(3, papers_count + 1), "summaries": max(2, proposals_count + 1)},
            {"label": "W3", "sources": max(4, papers_count + 2), "summaries": max(3, proposals_count + 1)},
            {"label": "W4", "sources": max(5, papers_count + 3), "summaries": max(4, proposals_count + 2)},
        ],
        "mastery": [
            {"label": "Literature Review", "value": 92},
            {"label": "Methodology", "value": 76},
            {"label": "Data Synthesis", "value": 68},
        ],
    }

# ---------------------------------------------------------------------------
# Topic Generator
# ---------------------------------------------------------------------------
@api.post("/topics/generate", response_model=List[TopicOut])
async def generate_topics(body: TopicGenRequest, current=Depends(get_current_user)):
    project = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await require_quota(db, current["id"], "topic_gens_day")
    domain = body.domain or project["domain"]
    keywords = body.keywords or project.get("keywords", "")
    interest = body.interest or project.get("description", "")

    system = "You are an academic research advisor helping students discover novel research topics."
    prompt = f"""Generate 5 novel, publishable research topics for the following context.

Domain: {domain}
Keywords: {keywords}
Research interest: {interest}

Return STRICT JSON, no prose, no code fences. Schema:
{{"topics":[{{"topic_name": str, "novelty_score": int 0-100, "difficulty_score": int 0-100, "datasets": [str,...], "description": str (2-3 sentences)}}]}}
"""
    data = await claude_json(system, prompt, max_tokens=3500)
    topics = data.get("topics", []) if isinstance(data, dict) else []
    out = []
    for t in topics:
        tid = str(uuid.uuid4())
        doc = {
            "id": tid,
            "project_id": body.project_id,
            "topic_name": t.get("topic_name", "Untitled Topic"),
            "novelty_score": int(t.get("novelty_score", 70)),
            "difficulty_score": int(t.get("difficulty_score", 60)),
            "datasets": t.get("datasets", []) or [],
            "description": t.get("description", ""),
            "generated_at": now_iso(),
        }
        await db.research_topics.insert_one(doc)
        out.append(TopicOut(**{k: v for k, v in doc.items() if k != "_id"}))
    await _touch_project(body.project_id)
    return out

@api.get("/projects/{project_id}/topics", response_model=List[TopicOut])
async def list_topics(project_id: str, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    cursor = db.research_topics.find({"project_id": project_id}, {"_id": 0}).sort("generated_at", -1)
    return [TopicOut(**t) async for t in cursor]

# ---------------------------------------------------------------------------
# Papers (upload PDF or paste text) + Literature Review
# ---------------------------------------------------------------------------
@api.post("/papers/upload", response_model=PaperOut)
async def upload_paper(body: PDFUploadPayload, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    await require_quota(db, current["id"], "paper_uploads_month")
    import base64
    try:
        pdf_bytes = base64.b64decode(body.base64_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {e}")
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text extracted from PDF")

    # Summarize with Claude
    excerpt = text[:12000]
    system = "You are a scholarly research assistant."
    prompt = f"""Analyze the following academic paper excerpt and return STRICT JSON with these keys:
{{"title": str, "authors": str, "year": int or null, "summary": str (5-6 sentences), "methodology": str, "dataset_used": str, "results": str}}

Paper text:
\"\"\"{excerpt}\"\"\""""
    meta = await claude_json(system, prompt, max_tokens=2500)
    pid = str(uuid.uuid4())
    paper_doc = {
        "id": pid,
        "project_id": body.project_id,
        "title": meta.get("title") or body.filename.replace(".pdf", ""),
        "authors": meta.get("authors", "") or "",
        "year": meta.get("year") if isinstance(meta.get("year"), int) else None,
        "doi": "",
        "summary": meta.get("summary", ""),
        "methodology": meta.get("methodology", ""),
        "dataset_used": meta.get("dataset_used", ""),
        "results": meta.get("results", ""),
        "created_at": now_iso(),
    }
    await db.papers.insert_one(paper_doc.copy())

    # Store chunks for RAG
    chunks = chunk_text(text, size=1200, overlap=150)
    if chunks:
        await db.paper_chunks.insert_many([
            {
                "id": str(uuid.uuid4()),
                "project_id": body.project_id,
                "paper_id": pid,
                "paper_title": paper_doc["title"],
                "chunk_index": i,
                "text": c,
                "created_at": now_iso(),
            }
            for i, c in enumerate(chunks)
        ])
    await _touch_project(body.project_id)
    return PaperOut(**{k: v for k, v in paper_doc.items() if k != "_id"})

@api.post("/papers/text", response_model=PaperOut)
async def add_paper_text(body: PaperCreate, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    await require_quota(db, current["id"], "paper_uploads_month")
    text = body.text_content or ""
    if len(text) < 40:
        raise HTTPException(status_code=400, detail="Paste more text content to analyze")
    system = "You are a scholarly research assistant."
    prompt = f"""Analyze this paper abstract/text and return STRICT JSON:
{{"summary": str, "methodology": str, "dataset_used": str, "results": str}}

Title: {body.title}
Text: \"\"\"{text[:8000]}\"\"\""""
    meta = await claude_json(system, prompt, max_tokens=1800)
    pid = str(uuid.uuid4())
    paper_doc = {
        "id": pid,
        "project_id": body.project_id,
        "title": body.title,
        "authors": body.authors or "",
        "year": body.year,
        "doi": body.doi or "",
        "summary": meta.get("summary", ""),
        "methodology": meta.get("methodology", ""),
        "dataset_used": meta.get("dataset_used", ""),
        "results": meta.get("results", ""),
        "created_at": now_iso(),
    }
    await db.papers.insert_one(paper_doc.copy())
    chunks = chunk_text(text, size=1200, overlap=150)
    if chunks:
        await db.paper_chunks.insert_many([
            {"id": str(uuid.uuid4()), "project_id": body.project_id, "paper_id": pid,
             "paper_title": body.title, "chunk_index": i, "text": c, "created_at": now_iso()}
            for i, c in enumerate(chunks)
        ])
    await _touch_project(body.project_id)
    return PaperOut(**{k: v for k, v in paper_doc.items() if k != "_id"})

@api.get("/projects/{project_id}/papers", response_model=List[PaperOut])
async def list_papers(project_id: str, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    cursor = db.papers.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1)
    return [PaperOut(**p) async for p in cursor]

@api.delete("/papers/{paper_id}")
async def delete_paper(paper_id: str, current=Depends(get_current_user)):
    paper = await db.papers.find_one({"id": paper_id})
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    proj = await db.projects.find_one({"id": paper["project_id"], "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.papers.delete_one({"id": paper_id})
    await db.paper_chunks.delete_many({"paper_id": paper_id})
    return {"deleted": True}

@api.post("/literature-review")
async def literature_review(body: LitReviewRequest, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    papers = [p async for p in db.papers.find({"project_id": body.project_id}, {"_id": 0})]
    if not papers:
        raise HTTPException(status_code=400, detail="Upload at least one paper first")
    system = "You are a scholarly research assistant creating literature review comparison matrices."
    paper_ctx = "\n\n".join(
        f"Paper: {p['title']}\nSummary: {p['summary']}\nMethodology: {p['methodology']}\nDataset: {p['dataset_used']}\nResults: {p['results']}"
        for p in papers
    )
    prompt = f"""Create a comparison matrix and synthesis for the following papers in project '{proj['title']}'.

{paper_ctx}

Return STRICT JSON:
{{
  "synthesis": str (4-5 sentences summarizing the state of the art),
  "matrix": [{{"paper_title": str, "methodology": str, "dataset": str, "key_finding": str, "limitation": str}}]
}}"""
    data = await claude_json(system, prompt, max_tokens=3000)
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": body.project_id,
        "synthesis": data.get("synthesis", ""),
        "matrix": data.get("matrix", []),
        "created_at": now_iso(),
    }
    await db.literature_reviews.replace_one({"project_id": body.project_id}, doc, upsert=True)
    await _touch_project(body.project_id)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/projects/{project_id}/literature-review")
async def get_literature_review(project_id: str, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    lr = await db.literature_reviews.find_one({"project_id": project_id}, {"_id": 0})
    return lr or {"project_id": project_id, "synthesis": "", "matrix": []}

# ---------------------------------------------------------------------------
# Research Gap
# ---------------------------------------------------------------------------
@api.post("/research-gap", response_model=ResearchGapOut)
async def research_gap(body: ResearchGapRequest, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    papers = [p async for p in db.papers.find({"project_id": body.project_id}, {"_id": 0})]
    paper_ctx = "\n\n".join(
        f"- {p['title']}: {p['summary']} (Methodology: {p['methodology']}; Limitations implied by results: {p['results']})"
        for p in papers
    ) or "No papers uploaded yet."

    system = "You are an academic research advisor who identifies unexplored research gaps."
    prompt = f"""Project domain: {proj['domain']}
Project description: {proj.get('description', '')}
Uploaded papers:
{paper_ctx}

Identify research gaps and future scope. Return STRICT JSON:
{{
  "existing_work_summary": str (3-4 sentences),
  "gaps": [{{"description": str, "priority": "high"|"medium"|"low"}}],
  "future_scope": [str, ...]
}}"""
    data = await claude_json(system, prompt, max_tokens=2500)
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": body.project_id,
        "existing_work_summary": data.get("existing_work_summary", ""),
        "gaps": data.get("gaps", []),
        "future_scope": data.get("future_scope", []),
        "created_at": now_iso(),
    }
    await db.research_gaps.replace_one({"project_id": body.project_id}, doc, upsert=True)
    await _touch_project(body.project_id)
    return ResearchGapOut(**{k: v for k, v in doc.items() if k != "_id"})

@api.get("/projects/{project_id}/research-gap")
async def get_research_gap(project_id: str, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    r = await db.research_gaps.find_one({"project_id": project_id}, {"_id": 0})
    return r or {"project_id": project_id, "existing_work_summary": "", "gaps": [], "future_scope": []}

# ---------------------------------------------------------------------------
# Proposal
# ---------------------------------------------------------------------------
@api.post("/proposal/generate", response_model=ProposalOut)
async def generate_proposal(body: ProposalRequest, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    await require_quota(db, current["id"], "proposal_gens_month")
    papers = [p async for p in db.papers.find({"project_id": body.project_id}, {"_id": 0})]
    gaps = await db.research_gaps.find_one({"project_id": body.project_id}, {"_id": 0})
    topic = body.selected_topic or proj["title"]

    context = f"Selected topic: {topic}\nDomain: {proj['domain']}\nDescription: {proj.get('description', '')}\n"
    if papers:
        context += "\nKey references:\n" + "\n".join(f"- {p['title']}: {p['summary']}" for p in papers[:5])
    if gaps:
        context += f"\nIdentified gaps: {json.dumps(gaps.get('gaps', []))}"

    system = "You are an expert academic research proposal writer."
    prompt = f"""Draft a research proposal for the following:
{context}

Return STRICT JSON:
{{
  "title": str,
  "abstract": str (150-200 words),
  "problem_statement": str (100-150 words),
  "objectives": [str, str, str, str],
  "scope": str (80-120 words),
  "methodology": str (150-200 words),
  "future_scope": str (60-100 words)
}}"""
    data = await claude_json(system, prompt, max_tokens=4000)
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": body.project_id,
        "title": data.get("title", topic),
        "abstract": data.get("abstract", ""),
        "problem_statement": data.get("problem_statement", ""),
        "objectives": data.get("objectives", []) if isinstance(data.get("objectives"), list) else [],
        "scope": data.get("scope", ""),
        "methodology": data.get("methodology", ""),
        "future_scope": data.get("future_scope", ""),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.proposals.replace_one({"project_id": body.project_id}, doc, upsert=True)
    await _touch_project(body.project_id)
    return ProposalOut(**{k: v for k, v in doc.items() if k != "_id"})

@api.get("/projects/{project_id}/proposal", response_model=Optional[ProposalOut])
async def get_proposal(project_id: str, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    p = await db.proposals.find_one({"project_id": project_id}, {"_id": 0})
    if not p:
        return None
    return ProposalOut(**p)

@api.patch("/projects/{project_id}/proposal", response_model=ProposalOut)
async def update_proposal(project_id: str, body: ProposalUpdate, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    updates["updated_at"] = now_iso()
    await db.proposals.update_one({"project_id": project_id}, {"$set": updates})
    p = await db.proposals.find_one({"project_id": project_id}, {"_id": 0})
    return ProposalOut(**p)

# ---------------------------------------------------------------------------
# Citations
# ---------------------------------------------------------------------------
@api.post("/citations/generate")
async def generate_citations(body: CitationRequest, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    papers = [p async for p in db.papers.find({"project_id": body.project_id}, {"_id": 0})]
    if not papers:
        return {"style": body.style, "citations": []}
    style = body.style.upper()
    if style not in {"IEEE", "APA", "MLA", "CHICAGO"}:
        raise HTTPException(status_code=400, detail="Style must be IEEE, APA, MLA, or Chicago")
    system = "You are an expert citation formatter."
    paper_lines = "\n".join(
        f"- Title: {p['title']}; Authors: {p['authors'] or 'Unknown'}; Year: {p['year'] or 'n.d.'}; DOI: {p['doi'] or ''}"
        for p in papers
    )
    prompt = f"""Format the following papers in {style} citation style. Return STRICT JSON:
{{"citations": [str, str, ...]}}

Papers:
{paper_lines}"""
    data = await claude_json(system, prompt, max_tokens=2000)
    cites = data.get("citations", []) if isinstance(data, dict) else []
    if not cites:
        # one retry with sharper instruction
        data = await claude_json(system, prompt + "\n\nIMPORTANT: The 'citations' array must be non-empty.", max_tokens=2000)
        cites = data.get("citations", []) if isinstance(data, dict) else []
    return {"style": style, "citations": cites}

# ---------------------------------------------------------------------------
# PPT Generator
# ---------------------------------------------------------------------------
@api.post("/ppt/generate")
async def generate_ppt(body: PPTRequest, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    await require_quota(db, current["id"], "ppt_unlock")
    proposal = await db.proposals.find_one({"project_id": body.project_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=400, detail="Generate a proposal first")
    system = "You are an expert academic presentation designer."
    prompt = f"""Create a 10-slide research presentation from this proposal. Each slide has a title, 3-5 bullet points, and speaker notes (2-3 sentences).

Proposal:
Title: {proposal['title']}
Abstract: {proposal['abstract']}
Problem: {proposal['problem_statement']}
Objectives: {proposal['objectives']}
Scope: {proposal['scope']}
Methodology: {proposal['methodology']}
Future scope: {proposal['future_scope']}

Return STRICT JSON:
{{"slides": [{{"index": 1, "title": str, "bullets": [str, ...], "notes": str}}, ...] }}

Slide order: 1 Title & Overview, 2 Background, 3 Problem Statement, 4 Research Objectives, 5 Related Work, 6 Methodology, 7 Expected Outcomes, 8 Scope & Limitations, 9 Future Work, 10 References & Q&A."""
    data = await claude_json(system, prompt, max_tokens=4000)
    slides = data.get("slides", []) if isinstance(data, dict) else []
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": body.project_id,
        "slides": slides,
        "created_at": now_iso(),
    }
    await db.presentations.replace_one({"project_id": body.project_id}, doc, upsert=True)
    await _touch_project(body.project_id)
    return {k: v for k, v in doc.items() if k != "_id"}

@api.get("/projects/{project_id}/ppt")
async def get_ppt(project_id: str, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": project_id, "user_id": current["id"]})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    d = await db.presentations.find_one({"project_id": project_id}, {"_id": 0})
    return d or {"project_id": project_id, "slides": []}

# ---------------------------------------------------------------------------
# AI Chat (RAG over uploaded papers)
# ---------------------------------------------------------------------------
@api.post("/chat")
async def chat_with_project(body: ChatRequest, current=Depends(get_current_user)):
    proj = await db.projects.find_one({"id": body.project_id, "user_id": current["id"]}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    await require_quota(db, current["id"], "chat_msgs_day")
    context = await retrieve_context(body.project_id, body.question, k=6)
    system = "You are Stella, a friendly academic research assistant. Answer using ONLY the provided context when possible, otherwise say you need more sources."
    prompt = f"""Context from user's uploaded papers:
{context or '(no relevant papers found - answer briefly from general knowledge but be transparent)'}

Question: {body.question}

Give a concise, well-structured answer (3-6 sentences)."""
    answer = await claude_text(system, prompt, max_tokens=1500)
    return {"answer": answer, "used_context": bool(context)}

# ---------------------------------------------------------------------------
# Mount + CORS
# ---------------------------------------------------------------------------
app.include_router(api)
app.include_router(build_billing_router(db, get_current_user))
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def _shutdown():
    client.close()
