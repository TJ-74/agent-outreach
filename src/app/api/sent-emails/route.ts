import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const jar = await cookies();
  const userId = jar.get("ol_uid")?.value || jar.get("gg_uid")?.value || null;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sent_emails")
    .select("id, sequence_id, sequence_name, enrollment_id, lead_id, lead_name, lead_email, company, step_number, subject, body, is_html, sent_at, outlook_message_id")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sentEmails = data ?? [];

  const leadIds = [...new Set(sentEmails.map((e) => e.lead_id))];
  const leadProfiles: Record<string, { jobTitle: string; research: string; linkedIn: string; notes: string; status: string }> = {};

  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, job_title, research, linked_in, notes, status")
      .in("id", leadIds);

    if (leads) {
      for (const l of leads) {
        leadProfiles[l.id] = {
          jobTitle: l.job_title ?? "",
          research: l.research ?? "",
          linkedIn: l.linked_in ?? "",
          notes: l.notes ?? "",
          status: l.status ?? "new",
        };
      }
    }
  }

  const latestSentByLead = new Map<string, (typeof sentEmails)[number]>();
  for (const email of sentEmails) {
    if (!latestSentByLead.has(email.lead_id)) {
      latestSentByLead.set(email.lead_id, email);
    }
  }

  const { data: inboundMessages } = leadIds.length > 0
    ? await supabase
        .from("messages")
        .select("id, lead_id, outlook_message_id, direction, subject, body_preview, body_html, from_email, from_name, to_email, to_name, status, sent_at")
        .eq("user_id", userId)
        .eq("direction", "inbound")
        .in("lead_id", leadIds)
    : { data: [] };

  const enrichedSent = sentEmails.map((e) => ({
    ...e,
    direction: "outbound" as const,
    from_email: null,
    from_name: null,
    to_email: e.lead_email,
    to_name: e.lead_name,
    status: "sent",
    lead_profile: leadProfiles[e.lead_id] ?? null,
  }));

  const enrichedInbound = (inboundMessages ?? [])
    .map((message) => {
      const threadMeta = latestSentByLead.get(message.lead_id);
      if (!threadMeta) return null;

      return {
        id: `message:${message.id}`,
        sequence_id: threadMeta.sequence_id,
        sequence_name: threadMeta.sequence_name,
        enrollment_id: threadMeta.enrollment_id,
        lead_id: message.lead_id,
        lead_name: threadMeta.lead_name,
        lead_email: threadMeta.lead_email,
        company: threadMeta.company,
        step_number: threadMeta.step_number,
        subject: message.subject ?? "",
        body: message.body_html || message.body_preview || "",
        is_html: !!message.body_html,
        sent_at: message.sent_at,
        outlook_message_id: message.outlook_message_id,
        direction: "inbound" as const,
        from_email: message.from_email,
        from_name: message.from_name,
        to_email: message.to_email,
        to_name: message.to_name,
        status: message.status,
        lead_profile: leadProfiles[message.lead_id] ?? null,
      };
    })
    .filter((message): message is NonNullable<typeof message> => message !== null);

  const combined = [...enrichedSent, ...enrichedInbound]
    .sort((a, b) => new Date(b.sent_at ?? 0).getTime() - new Date(a.sent_at ?? 0).getTime());

  return NextResponse.json({ sentEmails: combined });
}

export async function DELETE(req: NextRequest) {
  const jar = await cookies();
  const userId = jar.get("ol_uid")?.value || jar.get("gg_uid")?.value || null;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sentEmailIds, messageIds, leadId, leadEmail } = await req.json();
  const sentIds = Array.isArray(sentEmailIds) ? sentEmailIds.filter(Boolean) : [];
  const msgIds = Array.isArray(messageIds) ? messageIds.filter(Boolean) : [];

  if (sentIds.length === 0 && msgIds.length === 0 && !leadId && !leadEmail) {
    return NextResponse.json({ error: "Missing conversation identifiers" }, { status: 400 });
  }

  if (sentIds.length > 0) {
    const { error } = await supabase
      .from("sent_emails")
      .delete()
      .eq("user_id", userId)
      .in("id", sentIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    let query = supabase.from("sent_emails").delete().eq("user_id", userId);
    query = leadId ? query.eq("lead_id", leadId) : query.eq("lead_email", leadEmail);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (msgIds.length > 0) {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("user_id", userId)
      .in("id", msgIds);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (leadId) {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("user_id", userId)
      .eq("lead_id", leadId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
