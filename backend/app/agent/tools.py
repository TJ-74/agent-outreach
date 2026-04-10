from __future__ import annotations

import json
import re
import logging
from datetime import datetime, timezone

from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig

from app.database import get_db
from app.services.llm import chat_json
from app.config import get_settings as _get_settings
from app.prompts.analysis import MESSAGE_SUMMARY_SYSTEM, build_message_summary_prompt

logger = logging.getLogger(__name__)

ALLOWED_TABLES = {"leads", "messages", "drafts", "agent_logs"}
BLOCKED_KEYWORDS = re.compile(
    r"\b(DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b", re.IGNORECASE
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _uid(config: RunnableConfig) -> str:
    return config.get("configurable", {}).get("user_id", "")


def _normalize_sql(sql: str) -> str:
    """Take the first statement only; strip trailing semicolons and whitespace."""
    first = sql.strip().split(";")[0].strip()
    return first.rstrip(";").strip() or sql.strip()


def validate_sql(sql: str) -> tuple[str | None, str]:
    """Return (error_message, normalized_sql). If error is None, use normalized_sql for execution."""
    normalized = _normalize_sql(sql)
    upper = normalized.upper()

    if not (upper.startswith("SELECT") or upper.startswith("INSERT") or upper.startswith("UPDATE")
            or upper.startswith("WITH")):
        return "Only SELECT, INSERT, UPDATE (or WITH ... SELECT/INSERT/UPDATE) allowed.", normalized

    if BLOCKED_KEYWORDS.search(normalized):
        return "Blocked keyword detected in SQL.", normalized

    return None, normalized


# ── 1. run_sql ───────────────────────────────────────────────────

@tool
def run_sql(sql: str, config: RunnableConfig) -> str:
    """Execute a guarded SQL query (SELECT, INSERT, or UPDATE) against the database.
    Returns query results as JSON text."""
    error, normalized = validate_sql(sql)
    if error:
        return f"SQL blocked: {error}"

    db = get_db()
    try:
        result = db.rpc("exec_sql", {"query": normalized}).execute()
        data = result.data
        if data is None:
            return "(no rows returned)"
        if isinstance(data, list):
            return json.dumps(data, default=str, indent=2)[:2000]
        return json.dumps(data, default=str, indent=2)[:2000]
    except Exception as exc:
        logger.warning("run_sql error: %s\nSQL: %s", exc, normalized[:200])
        return f"SQL error: {exc}"


# ── 2. search_web ───────────────────────────────────────────────

@tool
def search_web(query: str, lead_id: str, config: RunnableConfig) -> str:
    """Search the web for information about a lead or company using Brave Search.
    Saves results to the lead's research field for future reference."""
    import requests
    from app.config import get_settings

    api_key = get_settings().brave_search_api_key
    if not api_key:
        return "Brave Search API key not configured (BRAVE_SEARCH_API_KEY)."

    try:
        resp = requests.get(
            "https://api.search.brave.com/res/v1/web/search",
            headers={"Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": api_key},
            params={"q": query, "count": 5},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Brave search failed: %s", exc)
        return f"Search failed: {exc}"

    web_results = data.get("web", {}).get("results", [])
    if not web_results:
        return "No results found."

    snippets: list[str] = []
    for r in web_results:
        snippets.append(f"• {r.get('title', '')}\n  {r.get('description', '')}\n  {r.get('url', '')}")
    research_text = f"Query: {query}\nDate: {_now_iso()[:10]}\n\n" + "\n\n".join(snippets)

    db = get_db()
    db.table("leads").update({
        "research": research_text,
        "updated_at": _now_iso(),
    }).eq("id", lead_id).execute()

    return research_text


# ── 3. summarize_messages ───────────────────────────────────────

@tool
def summarize_messages(lead_id: str, config: RunnableConfig) -> str:
    """Generate one-sentence summaries for all unsummarized messages of a lead.
    Writes summaries to the database and returns a count."""
    db = get_db()
    user_id = _uid(config)

    lead = (
        db.table("leads")
        .select("id")
        .eq("id", lead_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    ).data
    if not lead:
        return f"Lead {lead_id} not found."

    unsummarized = (
        db.table("messages")
        .select("id, outlook_message_id, direction, subject, body_html, body_preview")
        .eq("lead_id", lead_id)
        .eq("summary", "")
        .order("sent_at", desc=False)
        .execute()
    ).data or []

    if not unsummarized:
        return "All messages already have summaries."

    prompt = build_message_summary_prompt(unsummarized)
    result, _ = chat_json(MESSAGE_SUMMARY_SYSTEM, prompt)

    summaries = result.get("summaries", [])
    count = 0
    for item in summaries:
        msg_id = item.get("id")
        text = (item.get("summary") or "").strip()
        if msg_id and text:
            db.table("messages").update({"summary": text}).eq("id", msg_id).execute()
            count += 1

    return f"Summarized {count} of {len(unsummarized)} messages."


# ── All tools list ──────────────────────────────────────────────

ALL_TOOLS = [
    run_sql,
    search_web,
    summarize_messages,
]


# ── Direct-call wrappers for plan executor ──────────────────────

def _make_config(user_id: str) -> RunnableConfig:
    return {"configurable": {"user_id": user_id}}


def _call_run_sql(sql: str, user_id: str, **_: str) -> str:
    return run_sql.invoke({"sql": sql}, config=_make_config(user_id))


def _call_search_web(lead_id: str, user_id: str, query: str = "", **_: str) -> str:
    if not query:
        query = f"lead {lead_id}"
    return search_web.invoke({"query": query, "lead_id": lead_id}, config=_make_config(user_id))


def _call_summarize_messages(lead_id: str, user_id: str, **_: str) -> str:
    return summarize_messages.invoke({"lead_id": lead_id}, config=_make_config(user_id))


TOOL_MAP = {
    "run_sql": _call_run_sql,
    "search_web": _call_search_web,
    "summarize_messages": _call_summarize_messages,
}
