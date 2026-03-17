import json
import time
import logging
from datetime import datetime, timezone

from app.database import get_db
from app.agent.graph import invoke_agent

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ──────────────────────────────────────────────
# Analyze Lead  (graph-powered)
# ──────────────────────────────────────────────

def analyze_lead(lead_id: str, user_id: str) -> dict:
    start = time.time()

    task = (
        f"Analyze the lead with id={lead_id}.\n"
        "Steps:\n"
        "1. Use run_sql to fetch the lead profile.\n"
        "2. Use run_sql to fetch the conversation history.\n"
        "3. If the lead has no prior research, search the web for them.\n"
        "4. Summarize any unsummarized messages.\n"
        "5. Use run_sql to UPDATE the lead with your engagement analysis.\n"
        "Return a brief summary of what you found."
    )

    result = invoke_agent(task, lead_id, user_id, task_type="analyze")

    last_msg = result["messages"][-1]
    content = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    db = get_db()
    lead = (
        db.table("leads")
        .select("ai_summary, sentiment, engagement_score, status, next_action, next_action_type, next_action_at")
        .eq("id", lead_id)
        .single()
        .execute()
    ).data or {}

    duration_ms = int((time.time() - start) * 1000)
    return {
        "lead_id": lead_id,
        "analysis": {
            "summary": lead.get("ai_summary", ""),
            "sentiment": lead.get("sentiment", "neutral"),
            "engagement_score": lead.get("engagement_score", 0),
            "recommended_status": lead.get("status", "new"),
            "next_action": lead.get("next_action", ""),
            "next_action_type": lead.get("next_action_type", ""),
            "next_action_at": lead.get("next_action_at"),
            "reasoning": content[:500],
        },
        "tokens_used": 0,
        "duration_ms": duration_ms,
    }


# ──────────────────────────────────────────────
# Suggest Email  (graph-powered)
# ──────────────────────────────────────────────

def suggest_email(
    lead_id: str,
    user_id: str,
    purpose: str = "initial outreach",
    tone: str = "professional and friendly",
) -> dict:
    task = (
        f"Draft an email for the lead with id={lead_id}.\n"
        f"Purpose: {purpose}\n"
        f"Tone: {tone}\n"
        "Steps:\n"
        "1. Use run_sql to fetch the lead profile.\n"
        "2. Use run_sql to fetch the full conversation including body_preview, direction,\n"
        "   subject, from_name, outlook_message_id, sent_at.\n"
        "3. If the lead has no prior research, search the web.\n"
        "The email will be composed and saved automatically by the draft synthesizer.\n"
        "Do NOT use run_sql to INSERT into drafts."
    )

    result = invoke_agent(task, lead_id, user_id, task_type="draft_email")

    db = get_db()
    draft = (
        db.table("drafts")
        .select("subject, body")
        .eq("lead_id", lead_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ).data

    last_msg = result["messages"][-1]
    reasoning = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    if draft:
        return {
            "subject": draft[0].get("subject", ""),
            "body": draft[0].get("body", ""),
            "reasoning": reasoning[:500],
        }

    return {
        "subject": "",
        "body": "",
        "reasoning": reasoning[:500],
    }


# ──────────────────────────────────────────────
# Generate drafts for all "needs_reply" leads
# ──────────────────────────────────────────────

MAX_GENERATE_REPLIES = 10


def generate_replies_for_needs_reply(user_id: str, limit: int = MAX_GENERATE_REPLIES) -> dict:
    """Generate email drafts for all leads with action_needed = 'needs_reply'. Returns count and lead_ids."""
    db = get_db()
    rows = (
        db.table("leads")
        .select("id")
        .eq("user_id", user_id)
        .eq("action_needed", "needs_reply")
        .order("last_replied_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []

    lead_ids = [r["id"] for r in rows if r.get("id")]
    generated_ids = []
    errors = []

    for lead_id in lead_ids:
        try:
            suggest_email(lead_id, user_id, purpose="reply to lead", tone="professional and friendly")
            generated_ids.append(lead_id)
        except Exception as exc:
            logger.warning("generate_replies: lead %s failed: %s", lead_id, exc)
            errors.append({"lead_id": lead_id, "error": str(exc)})

    return {
        "generated": len(generated_ids),
        "total_needs_reply": len(lead_ids),
        "lead_ids": generated_ids,
        "errors": errors[:5],
    }


# ──────────────────────────────────────────────
# Fetch Stored Message Summaries  (direct DB — no agent)
# ──────────────────────────────────────────────

def get_message_summaries(lead_id: str, user_id: str) -> list[dict]:
    db = get_db()
    lead = (
        db.table("leads")
        .select("id")
        .eq("id", lead_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    ).data
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")

    rows = (
        db.table("messages")
        .select("outlook_message_id, summary")
        .eq("lead_id", lead_id)
        .neq("summary", "")
        .execute()
    ).data or []

    return [
        {"outlook_message_id": r["outlook_message_id"], "summary": r["summary"]}
        for r in rows
        if r.get("outlook_message_id") and r.get("summary")
    ]


# ──────────────────────────────────────────────
# Summarize Individual Messages  (graph-powered)
# ──────────────────────────────────────────────

def summarize_messages(lead_id: str, user_id: str) -> list[dict]:
    task = (
        f"Summarize all unsummarized messages for the lead with id={lead_id}.\n"
        "Call the summarize_messages tool with the lead id."
    )

    invoke_agent(task, lead_id, user_id, task_type="summarize")

    return get_message_summaries(lead_id, user_id)


# ──────────────────────────────────────────────
# Sync Messages from Outlook to Supabase  (direct DB — no agent)
# ──────────────────────────────────────────────

def sync_messages(lead_id: str, user_id: str, outlook_messages: list[dict]) -> dict:
    """Accepts a list of Outlook-formatted messages from the frontend
    and upserts them into the local messages table."""
    db = get_db()

    lead = (
        db.table("leads")
        .select("id, email")
        .eq("id", lead_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    ).data
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")

    lead_email = lead["email"].lower()
    synced = 0
    skipped = 0

    for msg in outlook_messages:
        outlook_id = msg.get("id")
        if not outlook_id:
            skipped += 1
            continue

        existing = (
            db.table("messages")
            .select("id")
            .eq("outlook_message_id", outlook_id)
            .execute()
        ).data
        if existing:
            skipped += 1
            continue

        raw_from = msg.get("from")
        from_email = (raw_from if isinstance(raw_from, str) else "").strip().lower()
        if not from_email and isinstance(raw_from, dict):
            from_email = (raw_from.get("emailAddress", {}).get("address") or "").strip().lower()
        is_from_lead = from_email == lead_email
        direction = "inbound" if is_from_lead else "outbound"

        raw_to = msg.get("to")
        if isinstance(raw_to, list):
            to_email = ", ".join(
                (r.get("emailAddress", {}).get("address") or "").strip()
                for r in raw_to
                if isinstance(r, dict)
            ).strip().lower()
        else:
            to_email = (raw_to if isinstance(raw_to, str) else "").strip().lower()
        if not to_email and direction == "outbound":
            to_email = lead_email

        body_html = msg.get("bodyHtml") or msg.get("body_html") or ""
        if not body_html and isinstance(msg.get("body"), dict):
            b = msg["body"]
            if b.get("contentType") == "html" and b.get("content"):
                body_html = b["content"]

        summary = msg.get("summary") or ""
        status = msg.get("status") or "read"
        if status not in ("read", "unread", "sent", "draft", "replied"):
            status = "read"

        db.table("messages").insert({
            "lead_id": lead_id,
            "user_id": user_id,
            "outlook_message_id": outlook_id,
            "direction": direction,
            "subject": msg.get("subject", ""),
            "body_preview": msg.get("bodyPreview", ""),
            "body_html": body_html,
            "from_email": from_email,
            "to_email": to_email,
            "summary": summary,
            "status": status,
            "sent_at": msg.get("date"),
        }).execute()
        synced += 1

        if direction == "inbound":
            db.table("leads").update({
                "last_replied_at": msg.get("date"),
                "updated_at": _now_iso(),
            }).eq("id", lead_id).execute()
        else:
            db.table("leads").update({
                "last_contacted_at": msg.get("date"),
                "updated_at": _now_iso(),
            }).eq("id", lead_id).execute()

    return {"synced": synced, "skipped": skipped, "total": len(outlook_messages)}
