from pydantic import BaseModel
from datetime import datetime


# --- Lead ---

class LeadProfile(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    company: str = ""
    job_title: str = ""
    linked_in: str = ""
    status: str = "new"
    notes: str = ""
    engagement_score: int = 0
    sentiment: str = "unknown"
    ai_summary: str = ""
    next_action: str = ""
    next_action_type: str = ""
    tags: list[str] = []


# --- Messages ---

class Message(BaseModel):
    id: str
    direction: str
    subject: str
    body_preview: str
    from_email: str
    to_email: str
    sent_at: str


# --- Agent Analysis ---

class AnalysisResult(BaseModel):
    summary: str
    sentiment: str
    engagement_score: int
    recommended_status: str
    next_action: str
    next_action_type: str
    next_action_at: str | None = None
    reasoning: str


class AnalysisResponse(BaseModel):
    run_id: str
    lead_id: str
    analysis: AnalysisResult
    tokens_used: int
    duration_ms: int


# --- Email Suggestion ---

class EmailSuggestionRequest(BaseModel):
    purpose: str = "initial outreach"
    tone: str = "professional and friendly"


class EmailSuggestionResponse(BaseModel):
    subject: str
    body: str
    reasoning: str


# --- Agent Runs ---

class AgentRunSummary(BaseModel):
    id: str
    status: str
    summary: str
    sentiment: str
    engagement_score: int
    recommended_action: str
    reasoning: str
    model: str
    tokens_used: int
    duration_ms: int
    created_at: str
    completed_at: str | None = None


# --- Sync ---

class SyncResult(BaseModel):
    synced: int
    skipped: int
    total: int
