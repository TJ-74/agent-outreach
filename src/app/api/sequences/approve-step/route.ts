import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient } from "@/lib/outlook";
import { getValidGoogleAccessToken, sendGmailEmail } from "@/lib/google";
import { bodyLooksLikeHtml, inlineEmailHtml } from "@/lib/sequence";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const outlookToken = await getValidAccessToken();
  const googleToken = outlookToken ? null : await getValidGoogleAccessToken();

  if (!outlookToken && !googleToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { enrollmentId, leadId, sequenceId, subject, body, isHtml } = await req.json();
  if (!enrollmentId || !leadId || !sequenceId || !subject || body == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: enrollment } = await supabase
    .from("sequence_enrollments")
    .select("user_id")
    .eq("id", enrollmentId)
    .single();

  const { data: lead } = await supabase
    .from("leads")
    .select("email, first_name, last_name, company")
    .eq("id", leadId)
    .single();

  if (!lead?.email) {
    return NextResponse.json({ error: "Lead not found or missing email" }, { status: 404 });
  }

  let senderName = "";
  let senderEmail = "";
  if (enrollment?.user_id) {
    const { data: sender } = await supabase
      .from("users")
      .select("name, email")
      .eq("id", enrollment.user_id)
      .single();
    senderName = sender?.name ?? "";
    senderEmail = sender?.email ?? "";
  }

  const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || lead.email;
  const sequenceName =
    (await supabase.from("sequences").select("name").eq("id", sequenceId).single()).data?.name ?? "";

  const effectiveIsHtml = !!isHtml || bodyLooksLikeHtml(body);
  const finalBody = effectiveIsHtml ? inlineEmailHtml(body) : body;

  try {
    if (outlookToken) {
      const client = getGraphClient(outlookToken);
      await client.api("/me/sendMail").post({
        message: {
          subject,
          body: { contentType: effectiveIsHtml ? "HTML" : "Text", content: finalBody },
          toRecipients: [{ emailAddress: { address: lead.email } }],
          from: senderName
            ? { emailAddress: { name: senderName, address: senderEmail } }
            : undefined,
        },
        saveToSentItems: true,
      });
    } else if (googleToken) {
      await sendGmailEmail({
        accessToken: googleToken,
        to: lead.email,
        subject,
        body: finalBody,
        isHtml: effectiveIsHtml,
        fromName: senderName,
        fromEmail: senderEmail,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const { data: steps } = await supabase
    .from("sequence_steps")
    .select("step_order, delay_days")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });

  const allSteps = steps ?? [];
  const nextStep = allSteps.find((s: { step_order: number }) => s.step_order === 2);
  const now = new Date();
  const updates: Record<string, unknown> = {
    current_step: 2,
    generated_subject: subject,
    generated_body: finalBody,
    is_html: effectiveIsHtml,
    generated_at: now.toISOString(),
  };

  if (nextStep) {
    updates.next_step_at = new Date(
      now.getTime() + nextStep.delay_days * 86400000
    ).toISOString();
  } else {
    updates.status = "completed";
    updates.completed_at = now.toISOString();
  }

  await supabase.from("sequence_enrollments").update(updates).eq("id", enrollmentId);

  if (enrollment?.user_id) {
    await supabase.from("sent_emails").insert({
      user_id: enrollment.user_id,
      sequence_id: sequenceId,
      sequence_name: sequenceName,
      enrollment_id: enrollmentId,
      lead_id: leadId,
      lead_name: leadName,
      lead_email: lead.email,
      company: lead.company ?? "",
      step_number: 1,
      subject,
      body: finalBody,
      is_html: effectiveIsHtml,
    });
  }

  const { data: remaining } = await supabase
    .from("sequence_enrollments")
    .select("id")
    .eq("sequence_id", sequenceId)
    .neq("status", "completed")
    .limit(1);

  let sequenceCompleted = false;
  if (remaining && remaining.length === 0) {
    await supabase
      .from("sequences")
      .update({ status: "completed", updated_at: now.toISOString() })
      .eq("id", sequenceId);
    sequenceCompleted = true;
  }

  return NextResponse.json({ success: true, sequenceCompleted });
}
