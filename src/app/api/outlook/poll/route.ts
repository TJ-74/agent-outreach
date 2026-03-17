import { NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient, getUserId } from "@/lib/outlook";
import { supabase } from "@/lib/supabase";

export async function POST() {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Missing user" }, { status: 401 });
  }

  try {
    const client = getGraphClient(accessToken);

    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const inbox = await client
      .api("/me/mailFolders/Inbox/messages")
      .filter(`receivedDateTime ge ${since}`)
      .select("id,subject,body,bodyPreview,from,toRecipients,receivedDateTime,isRead")
      .top(20)
      .orderby("receivedDateTime desc")
      .get();

    const graphMessages = inbox.value ?? [];
    if (graphMessages.length === 0) {
      return NextResponse.json({ newMessages: 0 });
    }

    const { data: leads } = await supabase
      .from("leads")
      .select("id, email, status")
      .eq("user_id", userId);

    if (!leads || leads.length === 0) {
      return NextResponse.json({ newMessages: 0 });
    }

    const emailToLead = new Map<string, { id: string; status: string }>();
    for (const lead of leads) {
      emailToLead.set(lead.email.toLowerCase(), { id: lead.id, status: lead.status });
    }

    const newByLead: Record<string, number> = {};
    let inserted = 0;

    for (const msg of graphMessages) {
      const fromEmail = (msg.from?.emailAddress?.address ?? "").toLowerCase();
      const fromName = (msg.from?.emailAddress?.name ?? "").trim();
      if (!fromEmail) continue;

      const lead = emailToLead.get(fromEmail);
      if (!lead) continue;

      const { data: existing } = await supabase
        .from("messages")
        .select("id")
        .eq("outlook_message_id", msg.id)
        .single();

      if (existing) continue;

      const toRecipients = (msg.toRecipients ?? []) as Array<{
        emailAddress?: { address?: string; name?: string };
      }>;
      const toEmail = toRecipients
        .map((r) => r.emailAddress?.address?.trim())
        .filter(Boolean)
        .join(", ")
        .toLowerCase();
      const toName = toRecipients
        .map((r) => (r.emailAddress?.name ?? "").trim())
        .filter(Boolean)
        .join(", ");

      const bodyHtml =
        msg.body?.contentType === "html" ? (msg.body.content ?? "") : "";

      await supabase.from("messages").insert({
        lead_id: lead.id,
        user_id: userId,
        outlook_message_id: msg.id,
        direction: "inbound",
        subject: msg.subject || "",
        body_preview: msg.bodyPreview || "",
        body_html: bodyHtml,
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        to_name: toName,
        status: msg.isRead ? "read" : "unread",
        sent_at: msg.receivedDateTime,
      });

      inserted++;
      newByLead[lead.id] = (newByLead[lead.id] ?? 0) + 1;

      const shouldUpdateStatus =
        lead.status === "new" || lead.status === "contacted";
      await supabase
        .from("leads")
        .update({
          last_replied_at: msg.receivedDateTime,
          ...(shouldUpdateStatus ? { status: "replied" } : {}),
          action_needed: "needs_reply",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
    }

    const affectedLeadIds = Object.keys(newByLead);
    if (affectedLeadIds.length > 0) {
      triggerAI(affectedLeadIds, userId);
    }

    return NextResponse.json({ newMessages: inserted, newByLead });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Poll failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function triggerAI(leadIds: string[], userId: string) {
  const base = "http://localhost:8000";
  const headers = { "Content-Type": "application/json", "X-User-Id": userId };

  for (const leadId of leadIds) {
    fetch(`${base}/agent/summarize-messages/${leadId}`, {
      method: "POST",
      headers,
    }).catch(() => {});

    fetch(`${base}/agent/analyze/${leadId}`, {
      method: "POST",
      headers,
    }).catch(() => {});
  }
}
