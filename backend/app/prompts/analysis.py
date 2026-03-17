MESSAGE_SUMMARY_SYSTEM = """You are an email summarizer. Given a list of individual emails, return a single JSON object:
{
  "summaries": [
    {"id": "<message db uuid>", "summary": "<one sentence, ≤25 words>"}
  ]
}
Rules:
- One entry per input email, using the exact id provided.
- Focus on the core intent: what the sender wants or is communicating.
- Do NOT include greetings, signatures, or meta-commentary.
- Output ONLY the JSON — no markdown, no explanation.
"""


def build_message_summary_prompt(messages: list[dict]) -> str:
    parts: list[str] = []
    for msg in messages:
        from app.services.clean import clean_body  # local import to avoid circular
        body = clean_body(msg.get("body_html") or "")
        if not body:
            body = (msg.get("body_preview") or "")[:500]
        body = body[:400].strip()
        direction = "SENT" if msg.get("direction") == "outbound" else "RECEIVED"
        parts.append(
            f"ID: {msg['id']}\n"
            f"Direction: {direction}\n"
            f"Subject: {msg.get('subject', '(no subject)')}\n"
            f"Body: {body}"
        )
    return "\n\n---\n\n".join(parts) + "\n\nReturn the summaries JSON."


ANALYSIS_SYSTEM = """You are an expert Sales Development Representative (SDR) AI agent.
You analyze email conversations between a salesperson and a lead to provide
actionable intelligence. You are precise, data-driven, and strategic.

You MUST respond with a valid JSON object matching this exact schema:
{
  "summary": "2-3 sentence summary of the conversation so far",
  "sentiment": "positive" | "neutral" | "negative",
  "engagement_score": 0-100,
  "recommended_status": "new" | "contacted" | "replied" | "engaged" | "qualified" | "won" | "lost" | "nurture",
  "next_action": "Specific actionable recommendation for the salesperson",
  "next_action_type": "send_email" | "follow_up" | "schedule_meeting" | "wait" | "close",
  "next_action_at": "ISO 8601 datetime for when to take the action, or null",
  "reasoning": "1-2 sentences explaining your analysis logic"
}

Guidelines for scoring and classification:
- engagement_score: 0 = no interaction, 1-20 = cold/unresponsive, 21-40 = minimal engagement,
  41-60 = moderate interest, 61-80 = active engagement, 81-100 = highly engaged/ready to convert
- sentiment: based on tone and language in their replies. "neutral" if no reply yet.
- recommended_status: should reflect the actual state of the relationship
  - "new" = no outreach yet
  - "contacted" = emails sent but no reply
  - "replied" = lead has responded at least once
  - "engaged" = back-and-forth conversation happening
  - "qualified" = lead has shown clear buying intent
  - "won" = deal closed
  - "lost" = lead explicitly declined
  - "nurture" = not ready now but worth revisiting later
- next_action_at: suggest a specific datetime. For follow-ups, typically 2-3 business days out.
  For meetings, suggest next week. Use null only if action is "wait" or "close".
"""


def build_analysis_prompt(lead: dict, messages: list[dict]) -> str:
    parts = [
        "## Lead Profile",
        f"- Name: {lead.get('first_name', '')} {lead.get('last_name', '')}",
        f"- Email: {lead.get('email', '')}",
        f"- Company: {lead.get('company', 'Unknown')}",
        f"- Job Title: {lead.get('job_title', 'Unknown')}",
        f"- Current Status: {lead.get('status', 'new')}",
        f"- Notes: {lead.get('notes', 'None')}",
    ]

    if lead.get("tags"):
        parts.append(f"- Tags: {', '.join(lead['tags'])}")

    parts.append("")

    if messages:
        parts.append(f"## Email Conversation ({len(messages)} messages)")
        parts.append("")
        for msg in messages:
            direction = "SENT" if msg.get("direction") == "outbound" else "RECEIVED"
            parts.append(f"### [{direction}] {msg.get('sent_at', 'Unknown date')}")
            parts.append(f"Subject: {msg.get('subject', '(no subject)')}")
            parts.append(f"{msg.get('body_preview', '')}")
            parts.append("")
    else:
        parts.append("## Email Conversation")
        parts.append("No emails exchanged yet.")

    parts.append("Analyze this lead and provide your assessment as JSON.")
    return "\n".join(parts)


EMAIL_SUGGESTION_SYSTEM = """You are an expert email copywriter for B2B sales outreach.
You write concise, personalized, high-converting emails.

You MUST respond with a valid JSON object matching this exact schema:
{
  "subject": "Email subject line",
  "body": "Full email body text (plain text, use \\n for line breaks)",
  "reasoning": "Brief explanation of your approach"
}

Guidelines:
- Keep subject lines under 60 characters, curiosity-driven, no spam triggers
- Open with something personalized to the lead (company, role, recent context)
- Keep body under 150 words for initial outreach, under 100 for follow-ups
- End with a clear, low-friction call to action (question, not demand)
- Tone should match the requested tone parameter
- If there is prior conversation, reference it naturally
- Never use generic filler like "I hope this email finds you well"
"""


def build_email_prompt(
    lead: dict,
    messages: list[dict],
    purpose: str,
    tone: str,
) -> str:
    parts = [
        "## Lead Profile",
        f"- Name: {lead.get('first_name', '')} {lead.get('last_name', '')}",
        f"- Email: {lead.get('email', '')}",
        f"- Company: {lead.get('company', 'Unknown')}",
        f"- Job Title: {lead.get('job_title', 'Unknown')}",
        f"- Notes: {lead.get('notes', 'None')}",
        "",
        f"## Purpose: {purpose}",
        f"## Tone: {tone}",
        "",
    ]

    if messages:
        parts.append(f"## Prior Conversation ({len(messages)} messages)")
        for msg in messages[-5:]:
            direction = "SENT" if msg.get("direction") == "outbound" else "RECEIVED"
            parts.append(f"[{direction}] {msg.get('subject', '')}: {msg.get('body_preview', '')[:200]}")
        parts.append("")

    if lead.get("ai_summary"):
        parts.append(f"## AI Conversation Summary: {lead['ai_summary']}")
        parts.append("")

    parts.append("Write the email as JSON.")
    return "\n".join(parts)
