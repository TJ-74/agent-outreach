import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient } from "@/lib/outlook";
import { getValidGoogleAccessToken, sendGmailEmail } from "@/lib/google";
import { supabase } from "@/lib/supabase";
import { substituteTemplate, dbLeadToVars, inlineEmailHtml } from "@/lib/sequence";

export async function POST(req: NextRequest) {
  const outlookAccessToken = await getValidAccessToken();
  const googleAccessToken = outlookAccessToken ? null : await getValidGoogleAccessToken();
  if (!outlookAccessToken && !googleAccessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { sequenceId, leadIds } = await req.json();
  if (!sequenceId || !Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json(
      { error: "Missing sequenceId or leadIds" },
      { status: 400 }
    );
  }

  const { data: sequence } = await supabase
    .from("sequences")
    .select("id, status")
    .eq("id", sequenceId)
    .single();

  if (!sequence || sequence.status !== "active") {
    return NextResponse.json(
      { error: "Sequence not found or not active" },
      { status: 400 }
    );
  }

  const { data: steps } = await supabase
    .from("sequence_steps")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("step_order", { ascending: true });

  if (!steps || steps.length === 0) {
    return NextResponse.json(
      { error: "Sequence has no steps" },
      { status: 400 }
    );
  }

  const step1 = steps.find((s: { step_order: number }) => s.step_order === 1);
  if (!step1) {
    return NextResponse.json({ error: "No step 1 found" }, { status: 400 });
  }

  const step2 = steps.find((s: { step_order: number }) => s.step_order === 2);

  const client = outlookAccessToken ? getGraphClient(outlookAccessToken) : null;
  let sent = 0;
  const failed: { leadId: string; error: string }[] = [];

  for (const leadId of leadIds) {
    try {
      const { data: enrollment } = await supabase
        .from("sequence_enrollments")
        .select("id, current_step")
        .eq("sequence_id", sequenceId)
        .eq("lead_id", leadId)
        .single();

      if (!enrollment || enrollment.current_step !== 1) continue;

      const { data: lead } = await supabase
        .from("leads")
        .select("first_name, last_name, email, company, job_title")
        .eq("id", leadId)
        .single();

      if (!lead || !lead.email) {
        failed.push({ leadId, error: "Lead not found or missing email" });
        continue;
      }

      const vars = dbLeadToVars(lead);
      const subject = substituteTemplate(step1.subject_template ?? "", vars);
      const rawBody = substituteTemplate(step1.body_template ?? "", vars);
      const isHtml = /<[a-zA-Z][\s\S]*?>/m.test(rawBody.trim());
      const body = isHtml ? inlineEmailHtml(rawBody) : rawBody;

      if (client) {
        await client.api("/me/sendMail").post({
          message: {
            subject,
            body: { contentType: isHtml ? "HTML" : "Text", content: body },
            toRecipients: [{ emailAddress: { address: lead.email } }],
          },
          saveToSentItems: true,
        });
      } else if (googleAccessToken) {
        await sendGmailEmail({
          accessToken: googleAccessToken,
          to: lead.email,
          subject,
          body,
          isHtml,
        });
      } else {
        throw new Error("No active email provider session");
      }

      const now = new Date();
      const updates: Record<string, unknown> = { current_step: 2 };

      if (step2) {
        const nextDate = new Date(now.getTime() + step2.delay_days * 86400000);
        updates.next_step_at = nextDate.toISOString();
      } else {
        updates.status = "completed";
        updates.completed_at = now.toISOString();
      }

      await supabase
        .from("sequence_enrollments")
        .update(updates)
        .eq("id", enrollment.id);

      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Send failed";
      failed.push({ leadId, error: msg });
    }
  }

  // Check if all enrollments for this sequence are now completed
  let sequenceCompleted = false;
  if (sent > 0) {
    const { data: remaining } = await supabase
      .from("sequence_enrollments")
      .select("id")
      .eq("sequence_id", sequenceId)
      .neq("status", "completed")
      .limit(1);

    if (remaining && remaining.length === 0) {
      await supabase
        .from("sequences")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", sequenceId);
      sequenceCompleted = true;
    }
  }

  return NextResponse.json({ success: true, sent, failed, sequenceCompleted });
}
