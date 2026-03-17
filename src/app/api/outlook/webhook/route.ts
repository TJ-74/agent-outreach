import { NextRequest, NextResponse } from "next/server";
import { getTokensForUser, getGraphClient } from "@/lib/outlook";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("validationToken");
  if (!token) {
    return NextResponse.json({ error: "Missing validationToken" }, { status: 400 });
  }
  return new Response(token, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

interface GraphNotification {
  subscriptionId: string;
  changeType: string;
  resource: string;
  resourceData?: { id?: string };
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("validationToken");
  if (token) {
    return new Response(token, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  let body: { value?: GraphNotification[] };
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 202 });
  }

  const notifications = body.value ?? [];

  for (const n of notifications) {
    try {
      await processNotification(n);
    } catch {
      // never block the 202 — Graph retries on failure
    }
  }

  return new Response(null, { status: 202 });
}

async function processNotification(n: GraphNotification) {
  const { data: sub } = await supabase
    .from("outlook_subscriptions")
    .select("user_id")
    .eq("subscription_id", n.subscriptionId)
    .single();

  if (!sub) return;

  const accessToken = await getTokensForUser(sub.user_id);
  if (!accessToken) return;

  const msgId = n.resourceData?.id;
  if (!msgId) return;

  const client = getGraphClient(accessToken);

  const msg = await client
    .api(`/me/messages/${msgId}`)
    .select("id,subject,body,bodyPreview,from,toRecipients,receivedDateTime,isRead")
    .get();

  const fromEmail = (msg.from?.emailAddress?.address ?? "").toLowerCase();
  const fromName = (msg.from?.emailAddress?.name ?? "").trim();
  if (!fromEmail) return;

  const { data: lead } = await supabase
    .from("leads")
    .select("id, status")
    .eq("user_id", sub.user_id)
    .ilike("email", fromEmail)
    .single();

  if (!lead) return;

  const { data: existing } = await supabase
    .from("messages")
    .select("id")
    .eq("outlook_message_id", msg.id)
    .single();

  if (existing) return;

  const toRecipients = (msg.toRecipients ?? []) as Array<{ emailAddress?: { address?: string; name?: string } }>;
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
    user_id: sub.user_id,
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

  triggerAI(lead.id, sub.user_id);
}

function triggerAI(leadId: string, userId: string) {
  const base = "http://localhost:8000";
  const headers = { "Content-Type": "application/json", "X-User-Id": userId };

  fetch(`${base}/agent/summarize-messages/${leadId}`, {
    method: "POST",
    headers,
  }).catch(() => {});

  fetch(`${base}/agent/analyze/${leadId}`, {
    method: "POST",
    headers,
  }).catch(() => {});
}
