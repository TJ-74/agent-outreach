from typing import Any
from fastapi import APIRouter, HTTPException, Header, Body, Query
from fastapi.responses import StreamingResponse
from app.services.agent import (
    analyze_lead,
    suggest_email,
    generate_replies_for_needs_reply,
    sync_messages,
    summarize_messages,
    get_message_summaries,
)
from app.agent.graph import stream_agent
from app.models.schemas import EmailSuggestionRequest
from app.database import get_db

router = APIRouter()


@router.post("/analyze/{lead_id}")
async def analyze(
    lead_id: str,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    try:
        result = analyze_lead(lead_id, x_user_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-stream/{lead_id}")
async def analyze_stream(
    lead_id: str,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")

    task = (
        f"Analyze the lead with id={lead_id}. "
        "You will receive gathered lead and messages data. "
        "Identify which fields are null or empty (research, message summaries). "
        "Output ONLY the steps required to fill those gaps, then update the lead with engagement and action_needed."
    )

    return StreamingResponse(
        stream_agent(task, lead_id, x_user_id, task_type="analyze"),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-store",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        },
    )


@router.post("/generate-replies")
async def generate_replies(
    x_user_id: str | None = Header(None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    try:
        result = generate_replies_for_needs_reply(x_user_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suggest-email/{lead_id}")
async def suggest(
    lead_id: str,
    payload: EmailSuggestionRequest | None = Body(default=None),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    req = payload or EmailSuggestionRequest()
    try:
        result = suggest_email(lead_id, x_user_id, req.purpose, req.tone)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/message-summaries/{lead_id}")
async def fetch_summaries(
    lead_id: str,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    try:
        summaries = get_message_summaries(lead_id, x_user_id)
        return {"summaries": summaries}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/summarize-messages/{lead_id}")
async def summarize(
    lead_id: str,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    try:
        updated = summarize_messages(lead_id, x_user_id)
        return {"updated": updated}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/{lead_id}")
async def get_logs(
    lead_id: str,
    x_user_id: str | None = Header(None, alias="X-User-Id"),
    limit: int = Query(default=10, le=50),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    db = get_db()
    rows = (
        db.table("agent_logs")
        .select("id, task_type, steps, duration_ms, created_at")
        .eq("lead_id", lead_id)
        .eq("user_id", x_user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []
    return {"logs": rows}


@router.post("/sync-messages/{lead_id}")
async def sync(
    lead_id: str,
    messages: list[Any] = Body(..., embed=False),
    x_user_id: str | None = Header(None, alias="X-User-Id"),
):
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing X-User-Id header")
    try:
        result = sync_messages(lead_id, x_user_id, messages)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
