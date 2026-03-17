from __future__ import annotations

import json
import re
import time
import logging
from datetime import datetime, timezone
from typing import Literal, Generator

from langchain_core.messages import AIMessage, SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END, START

from app.agent.state import AgentState
from app.agent.tools import ALL_TOOLS, TOOL_MAP, _call_run_sql, _call_search_web
from app.agent.prompts import AGENT_SYSTEM, PLANNER_SYSTEM, SUMMARIZER_SYSTEM, SQL_GENERATOR_SYSTEM, DRAFT_SYNTHESIZER_SYSTEM, WRITE_OP_SYSTEM
from app.services.llm import get_chat_model, get_creative_chat_model, get_mini_chat_model
from app.database import get_db

logger = logging.getLogger(__name__)

MAX_PLAN_STEPS = 10


# ── Graph Nodes ──────────────────────────────────────────────────

def _gather_node(state: AgentState) -> dict:
    """For ANALYZE only: fetch lead and messages first so planner can identify gaps."""
    lead_id = state["lead_id"]
    user_id = state["user_id"]
    task_msg = ""
    for msg in state.get("messages", []):
        if isinstance(msg, HumanMessage) or (isinstance(msg, tuple) and msg[0] == "human"):
            task_msg = msg.content if isinstance(msg, HumanMessage) else msg[1]
            break

    step_results: list[dict] = []
    gathered_parts: list[str] = []

    try:
        s1: AgentState = {**state, "step_results": []}
        out1 = _run_sql_via_llm(s1, "Fetch lead profile from leads table for this lead_id")
        step_results.append({
            "index": 0,
            "tool": "run_sql",
            "description": "Fetch lead profile",
            "output": _truncate(out1, 2000),
        })
        gathered_parts.append(out1)

        s2: AgentState = {**state, "step_results": step_results}
        out2 = _run_sql_via_llm(s2, "Fetch messages for this lead_id ordered by sent_at")
        step_results.append({
            "index": 1,
            "tool": "run_sql",
            "description": "Fetch messages",
            "output": _truncate(out2, 2000),
        })
        gathered_parts.append(out2)
    except Exception as exc:
        logger.warning("Gather failed: %s", exc)
        gathered_parts.append(f"Gather error: {exc}")

    gathered_data = "\n\n---\n\n".join(gathered_parts)

    return {
        "step_results": step_results,
        "gathered_data": gathered_data,
        "plan": [],
        "current_step": 0,
    }


def _planner_node(state: AgentState) -> dict:
    """Ask the LLM to produce a JSON execution plan."""
    model = get_mini_chat_model()
    task_msg = ""
    for msg in state.get("messages", []):
        if isinstance(msg, HumanMessage) or (isinstance(msg, tuple) and msg[0] == "human"):
            task_msg = msg.content if isinstance(msg, HumanMessage) else msg[1]
            break

    gathered = state.get("gathered_data") or ""
    if gathered:
        task_msg = (
            f"{task_msg}\n\n---\nGathered data (lead and messages):\n{gathered}\n\n"
            "Identify which fields are null or empty (e.g. research, message summaries). "
            "Output ONLY the steps required to fill those gaps, then update the lead."
        )

    response = model.invoke([
        SystemMessage(content=PLANNER_SYSTEM),
        HumanMessage(content=task_msg),
    ])

    plan: list[dict] = []
    try:
        raw = response.content or ""
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            parsed = json.loads(raw[start:end])
            raw_steps = parsed.get("steps", parsed.get("plan", []))
            for i, s in enumerate(raw_steps[:MAX_PLAN_STEPS]):
                plan.append({
                    "index": i,
                    "tool": s.get("tool", ""),
                    "description": s.get("description", ""),
                    "status": "pending",
                })
    except (json.JSONDecodeError, AttributeError) as exc:
        logger.warning("Failed to parse plan: %s", exc)

    if not plan:
        if gathered:
            plan = [{"index": 0, "tool": "update_lead", "description": "Save engagement analysis to lead", "status": "pending"}]
        else:
            plan = [
                {"index": 0, "tool": "run_sql", "description": "Fetch lead profile", "status": "pending"},
                {"index": 1, "tool": "run_sql", "description": "Fetch conversation history", "status": "pending"},
                {"index": 2, "tool": "summarize_messages", "description": "Summarize unsummarized messages", "status": "pending"},
                {"index": 3, "tool": "update_lead", "description": "Save engagement analysis to lead", "status": "pending"},
            ]

    return {
        "plan": plan,
        "current_step": 0,
        "step_results": state.get("step_results", []),
        "messages": [AIMessage(content=f"Plan created with {len(plan)} steps.")],
    }


def _executor_node(state: AgentState) -> dict:
    """Execute the current step in the plan."""
    plan = state["plan"]
    idx = state["current_step"]
    step = plan[idx]
    tool_name = step["tool"]
    lead_id = state["lead_id"]
    user_id = state["user_id"]

    plan[idx]["status"] = "running"

    try:
        if tool_name == "update_lead":
            output = _run_write_via_llm(state, step["description"])
            plan[idx]["status"] = "complete"
        elif tool_name == "run_sql":
            output = _run_sql_via_llm(state, step["description"])
            plan[idx]["status"] = "complete"
        elif tool_name == "search_web":
            query = _build_search_query(state)
            output = _call_search_web(lead_id=lead_id, user_id=user_id, query=query)
            plan[idx]["status"] = "complete"
        elif tool_name == "summarize_messages":
            handler = TOOL_MAP["summarize_messages"]
            output = handler(lead_id=lead_id, user_id=user_id)
            plan[idx]["status"] = "complete"
        else:
            output = f"Unknown tool: {tool_name}"
            plan[idx]["status"] = "error"
    except Exception as exc:
        logger.warning("Executor step %d (%s) failed: %s", idx, tool_name, exc)
        output = f"Error: {exc}"
        plan[idx]["status"] = "error"

    result_entry = {
        "index": idx,
        "tool": tool_name,
        "description": step.get("description", ""),
        "output": _truncate(output, 1200),
    }

    return {
        "plan": plan,
        "current_step": idx + 1,
        "step_results": [*state["step_results"], result_entry],
        "messages": [AIMessage(content=f"Step {idx + 1} ({tool_name}): {_truncate(output, 300)}")],
    }


def _summarizer_node(state: AgentState) -> dict:
    """Produce a final summary from all step results."""
    model = get_mini_chat_model()

    context_parts = []
    for r in state["step_results"]:
        context_parts.append(f"## Step {r['index'] + 1}: {r['tool']}\n{r['output']}")
    context = "\n\n".join(context_parts)

    task_msg = ""
    for msg in state["messages"]:
        if isinstance(msg, HumanMessage) or (isinstance(msg, tuple) and msg[0] == "human"):
            task_msg = msg.content if isinstance(msg, HumanMessage) else msg[1]
            break

    response = model.invoke([
        SystemMessage(content=SUMMARIZER_SYSTEM),
        HumanMessage(content=f"Original task: {task_msg}\n\n---\n\nExecution results:\n\n{context}"),
    ])

    return {"messages": [AIMessage(content=response.content or "Analysis complete.")]}


def _draft_synthesizer_node(state: AgentState) -> dict:
    """Compose a high-quality email draft from gathered context, then persist it."""
    model = get_creative_chat_model()
    lead_id = state["lead_id"]
    user_id = state["user_id"]

    context_parts = []
    sender_name = ""
    for r in state["step_results"]:
        context_parts.append(f"## {r['description']}\n{r['output']}")
        if not sender_name:
            sender_name = _extract_sender_name(r.get("output", ""))
    context = "\n\n".join(context_parts)

    task_msg = ""
    for msg in state.get("messages", []):
        if isinstance(msg, HumanMessage) or (isinstance(msg, tuple) and msg[0] == "human"):
            task_msg = msg.content if isinstance(msg, HumanMessage) else msg[1]
            break

    sender_line = f"Sender name (use this for the email signature): {sender_name}" if sender_name else "No sender name found — use 'Best regards' without a name."

    response = model.invoke([
        SystemMessage(content=DRAFT_SYNTHESIZER_SYSTEM),
        HumanMessage(content=(
            f"Task: {task_msg}\n\n"
            f"lead_id: {lead_id}\nuser_id: {user_id}\n"
            f"{sender_line}\n\n"
            f"---\n\nGathered context:\n\n{context}"
        )),
    ])

    raw = response.content or "{}"
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        draft_data = json.loads(raw[start:end]) if start >= 0 and end > start else {}
    except json.JSONDecodeError:
        draft_data = {}

    subject = draft_data.get("subject", "Follow up")
    body = draft_data.get("body", "")
    reply_to = draft_data.get("reply_to_message_id")
    reasoning = draft_data.get("reasoning", "")

    insert_payload: dict = {
        "lead_id": lead_id,
        "user_id": user_id,
        "subject": subject,
        "body": body,
    }
    if reply_to:
        insert_payload["reply_to_message_id"] = reply_to

    db = get_db()
    try:
        db.table("drafts").insert(insert_payload).execute()
        save_status = "Draft saved"
    except Exception as exc:
        logger.warning("Draft insert failed: %s", exc)
        save_status = f"Draft save error: {exc}"

    result_entry = {
        "index": len(state["step_results"]),
        "tool": "draft_synthesizer",
        "description": "Compose and save email draft",
        "output": f"Subject: {subject}\n\n{body}\n\n---\nReasoning: {reasoning}\n{save_status}",
    }

    return {
        "step_results": [*state["step_results"], result_entry],
        "messages": [AIMessage(content=(
            f"Email draft composed.\n\nSubject: {subject}\nReasoning: {reasoning}"
        ))],
    }


# ── Helpers ──────────────────────────────────────────────────────

def _should_continue_executing(state: AgentState) -> Literal["executor", "summarizer", "draft_synthesizer"]:
    if state["current_step"] < len(state["plan"]):
        return "executor"
    if state.get("task_type") == "draft_email":
        return "draft_synthesizer"
    return "summarizer"


def _extract_sender_name(output: str) -> str:
    """Pull the sender's from_name from outbound messages in step output."""
    try:
        data = json.loads(output)
        rows = data if isinstance(data, list) else [data] if isinstance(data, dict) else []
        for row in rows:
            if row.get("direction") == "outbound" and row.get("from_name"):
                return row["from_name"]
    except (json.JSONDecodeError, TypeError):
        pass
    return ""


def _build_search_query(state: AgentState) -> str:
    """Build a search query from prior step results."""
    for r in state["step_results"]:
        if r["tool"] == "run_sql":
            output = r["output"]
            try:
                data = json.loads(output)
                if isinstance(data, list) and data:
                    row = data[0]
                elif isinstance(data, dict):
                    row = data
                else:
                    continue
                parts = []
                for key in ("first_name", "last_name"):
                    if row.get(key):
                        parts.append(row[key])
                for key in ("company", "job_title"):
                    val = row.get(key, "")
                    if val and val.lower() != "unknown":
                        parts.append(val)
                if parts:
                    return " ".join(parts)
            except (json.JSONDecodeError, TypeError):
                continue
    return f"lead {state['lead_id']}"


def _run_sql_via_llm(state: AgentState, step_description: str) -> str:
    """Use the LLM to generate SQL for this step, then execute it."""
    model = get_mini_chat_model()

    context_parts = []
    for r in state["step_results"]:
        context_parts.append(f"## Step: {r['description']}\n{r['output']}")
    prior_context = "\n\n".join(context_parts) if context_parts else "(no prior steps)"

    task_msg = ""
    for msg in state["messages"]:
        if isinstance(msg, HumanMessage) or (isinstance(msg, tuple) and msg[0] == "human"):
            task_msg = msg.content if isinstance(msg, HumanMessage) else msg[1]
            break

    prompt = (
        f"Original task: {task_msg}\n\n"
        f"Current step: {step_description}\n\n"
        f"lead_id: {state['lead_id']}\n"
        f"user_id: {state['user_id']}\n\n"
        f"Prior step results:\n{prior_context}\n\n"
        'Generate the SQL. Return ONLY: {"sql": "<SQL statement>"}'
    )

    response = model.invoke([
        SystemMessage(content=SQL_GENERATOR_SYSTEM),
        HumanMessage(content=prompt),
    ])

    raw = response.content or "{}"
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            fields = json.loads(raw[start:end])
        else:
            fields = {}
    except json.JSONDecodeError:
        fields = {}

    sql = fields.get("sql", "")
    if not sql:
        return "LLM did not produce a SQL statement."

    logger.info("Generated SQL for '%s': %s", step_description, sql[:200])
    return _call_run_sql(sql=sql, user_id=state["user_id"])


_WRITE_KEYWORDS = re.compile(r"\b(update|insert|save|write|set|store|persist)\b", re.IGNORECASE)
_READ_KEYWORDS  = re.compile(r"\b(fetch|select|get|load|retrieve|read)\b", re.IGNORECASE)
_ALLOWED_WRITE_TABLES = {"leads", "messages", "drafts"}


def _is_write_step(description: str) -> bool:
    """Return True if this step is a database write (UPDATE/INSERT) rather than a SELECT."""
    has_write = bool(_WRITE_KEYWORDS.search(description))
    has_read  = bool(_READ_KEYWORDS.search(description))
    return has_write and not has_read


def _run_write_via_llm(state: AgentState, step_description: str) -> str:
    """Ask the LLM for structured JSON data, then execute a parameterized Supabase write.

    This avoids SQL string interpolation so quotes in field values never break the query.
    """
    model = get_mini_chat_model()
    db = get_db()

    context_parts = []
    for r in state["step_results"]:
        context_parts.append(f"## Step: {r['description']}\n{r['output']}")
    prior_context = "\n\n".join(context_parts) if context_parts else "(no prior steps)"

    task_msg = ""
    for msg in state["messages"]:
        if isinstance(msg, HumanMessage) or (isinstance(msg, tuple) and msg[0] == "human"):
            task_msg = msg.content if isinstance(msg, HumanMessage) else msg[1]
            break

    prompt = (
        f"Original task: {task_msg}\n\n"
        f"Current step: {step_description}\n\n"
        f"lead_id: {state['lead_id']}\n"
        f"user_id: {state['user_id']}\n\n"
        f"Prior step results:\n{prior_context}\n\n"
        "Extract the values to write. Return ONLY the JSON object."
    )

    response = model.invoke([
        SystemMessage(content=WRITE_OP_SYSTEM),
        HumanMessage(content=prompt),
    ])

    raw = response.content or "{}"
    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        write_data = json.loads(raw[start:end]) if start >= 0 and end > start else {}
    except json.JSONDecodeError:
        write_data = {}

    table     = write_data.get("table", "")
    operation = write_data.get("operation", "")
    data      = write_data.get("data") or {}
    where     = write_data.get("where") or {}

    if table not in _ALLOWED_WRITE_TABLES:
        return f"Write blocked: table '{table}' not allowed."
    if not data:
        return "Write blocked: no data returned by LLM."

    # Server-side validation and clamping — LLM output is never trusted raw
    _VALID_SENTIMENT     = {"positive", "neutral", "negative"}
    _VALID_ACTION_NEEDED = {"needs_reply", "waiting_for_reply", "needs_human", "none"}
    _VALID_ACTION_TYPE   = {"send_email", "follow_up", "schedule_meeting", "wait", "close"}
    _VALID_STATUS        = {"new", "contacted", "replied", "engaged", "qualified", "won", "lost", "nurture"}

    if "engagement_score" in data:
        try:
            data["engagement_score"] = max(0, min(100, int(data["engagement_score"])))
        except (TypeError, ValueError):
            data["engagement_score"] = 0
    if "sentiment" in data and data["sentiment"] not in _VALID_SENTIMENT:
        data["sentiment"] = "neutral"
    if "action_needed" in data and data["action_needed"] not in _VALID_ACTION_NEEDED:
        data["action_needed"] = "none"
    if "next_action_type" in data and data["next_action_type"] not in _VALID_ACTION_TYPE:
        data["next_action_type"] = "follow_up"
    if "status" in data and data["status"] not in _VALID_STATUS:
        data["status"] = "contacted"
    # Always stamp updated_at from the server — never trust LLM's timestamp
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        if operation == "update":
            if not where:
                where = {"id": state["lead_id"], "user_id": state["user_id"]}
            q = db.table(table).update(data)
            for col, val in where.items():
                q = q.eq(col, val)
            q.execute()
            logger.info("Parameterized UPDATE %s set %s", table, list(data.keys()))
            return f"Updated {table} — fields: {', '.join(data.keys())}"

        elif operation == "insert":
            data.setdefault("lead_id", state["lead_id"])
            data.setdefault("user_id", state["user_id"])
            db.table(table).insert(data).execute()
            logger.info("Parameterized INSERT into %s", table)
            return f"Inserted into {table}"

        else:
            return f"Write blocked: unknown operation '{operation}'."

    except Exception as exc:
        logger.warning("Parameterized write failed: %s", exc)
        return f"Write error: {exc}"


def _route_entry(state: AgentState) -> str:
    """Send ANALYZE tasks to gather first; all others to planner."""
    return "gather" if state.get("task_type") == "analyze" else "planner"


# ── Graph Construction ───────────────────────────────────────────

def build_graph():
    graph = StateGraph(AgentState)

    graph.add_node("gather", _gather_node)
    graph.add_node("planner", _planner_node)
    graph.add_node("executor", _executor_node)
    graph.add_node("summarizer", _summarizer_node)
    graph.add_node("draft_synthesizer", _draft_synthesizer_node)

    graph.add_conditional_edges(START, _route_entry, {"gather": "gather", "planner": "planner"})
    graph.add_edge("gather", "planner")
    graph.add_edge("planner", "executor")
    graph.add_conditional_edges("executor", _should_continue_executing, {
        "executor": "executor",
        "summarizer": "summarizer",
        "draft_synthesizer": "draft_synthesizer",
    })
    graph.add_edge("summarizer", END)
    graph.add_edge("draft_synthesizer", END)

    return graph.compile()


_compiled = None


def get_graph():
    global _compiled
    if _compiled is None:
        _compiled = build_graph()
    return _compiled


# ── Truncation Helpers ───────────────────────────────────────────

def _truncate(text: str | None, limit: int = 400) -> str:
    if not text:
        return ""
    s = str(text)
    return s[:limit] + "…" if len(s) > limit else s


# ── Logging ──────────────────────────────────────────────────────

def _save_log(lead_id: str, user_id: str, task_type: str, steps: list[dict], duration_ms: int) -> None:
    try:
        db = get_db()
        db.table("agent_logs").insert({
            "lead_id": lead_id,
            "user_id": user_id,
            "task_type": task_type,
            "steps": steps,
            "duration_ms": duration_ms,
        }).execute()
    except Exception as exc:
        logger.warning("Failed to save agent log: %s", exc)


# ── Non-streaming invoke (kept for backward compat) ─────────────

def invoke_agent(task: str, lead_id: str, user_id: str, task_type: str = "") -> dict:
    graph = get_graph()
    initial_state: AgentState = {
        "messages": [
            SystemMessage(content=AGENT_SYSTEM),
            HumanMessage(content=task),
        ],
        "lead_id": lead_id,
        "user_id": user_id,
        "task_type": task_type,
        "plan": [],
        "current_step": 0,
        "step_results": [],
    }

    start = time.time()
    result = graph.invoke(
        initial_state,
        config={
            "configurable": {"user_id": user_id},
            "recursion_limit": MAX_PLAN_STEPS * 3,
        },
    )
    duration_ms = int((time.time() - start) * 1000)

    steps = result.get("step_results", [])
    _save_log(lead_id, user_id, task_type, steps, duration_ms)

    return result


# ── NDJSON Streaming ─────────────────────────────────────────────

def _ndjson(type_: str, **kwargs) -> str:
    """Return one NDJSON line with type merged into payload."""
    return json.dumps({"type": type_, **kwargs}) + "\n"


def stream_agent(task: str, lead_id: str, user_id: str, task_type: str = "") -> Generator[str, None, None]:
    """Stream the plan-and-execute agent as NDJSON lines.

    Each newline-terminated JSON object has a "type" field:
      plan          — {"steps": [{index, tool, description},...]}
      step_complete — {index, tool, description, output}
      response      — {content}
      error         — {message}
      done          — {duration_ms, total_steps}
    """
    graph = get_graph()
    initial_state: AgentState = {
        "messages": [
            SystemMessage(content=AGENT_SYSTEM),
            HumanMessage(content=task),
        ],
        "lead_id": lead_id,
        "user_id": user_id,
        "task_type": task_type,
        "plan": [],
        "current_step": 0,
        "step_results": [],
    }

    config = {
        "configurable": {"user_id": user_id},
        "recursion_limit": MAX_PLAN_STEPS * 3,
    }

    all_steps: list[dict] = []
    start = time.time()

    try:
        for event in graph.stream(initial_state, config=config, stream_mode="updates"):
            for node_name, node_output in event.items():

                if node_name == "planner":
                    plan = node_output.get("plan", [])
                    yield _ndjson("plan", steps=[
                        {"index": s["index"], "tool": s["tool"], "description": s["description"]}
                        for s in plan
                    ])

                elif node_name == "executor":
                    results = node_output.get("step_results", [])
                    if results:
                        latest = results[-1]
                        idx = latest["index"]
                        tool = latest["tool"]
                        desc = latest.get("description", "")
                        output = latest.get("output", "")

                        yield _ndjson("step_complete",
                            index=idx,
                            tool=tool,
                            description=desc,
                            output=output,
                        )

                        all_steps.append({"index": idx, "tool": tool, "description": desc, "output": output})

                elif node_name == "draft_synthesizer":
                    results = node_output.get("step_results", [])
                    if results:
                        latest = results[-1]
                        yield _ndjson("step_complete",
                            index=latest["index"],
                            tool=latest["tool"],
                            description=latest.get("description", ""),
                            output=latest.get("output", ""),
                        )
                        all_steps.append(latest)
                    for msg in node_output.get("messages", []):
                        if isinstance(msg, AIMessage) and msg.content:
                            yield _ndjson("response", content=_truncate(msg.content, 800))

                elif node_name == "summarizer":
                    for msg in node_output.get("messages", []):
                        if isinstance(msg, AIMessage) and msg.content:
                            yield _ndjson("response", content=_truncate(msg.content, 800))

    except Exception as exc:
        logger.exception("Stream agent error")
        yield _ndjson("error", message=str(exc))

    duration_ms = int((time.time() - start) * 1000)
    _save_log(lead_id, user_id, task_type, all_steps, duration_ms)

    yield _ndjson("done", duration_ms=duration_ms, total_steps=len(all_steps))
