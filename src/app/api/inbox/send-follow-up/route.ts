import { NextRequest, NextResponse } from "next/server";
import { findRecentSentMessageId, getValidAccessToken, getGraphClient, getUserId } from "@/lib/outlook";
import { getValidGoogleAccessToken, sendGmailEmail, getGoogleUserId } from "@/lib/google";
import { inlineEmailHtml } from "@/lib/sequence";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const userId = (await getUserId()) ?? (await getGoogleUserId());
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    outlookMessageId,
    outlookMessageDirection,
    to,
    subject,
    body,
    sequenceId,
    sequenceName,
    enrollmentId,
    leadId,
    leadName,
    leadEmail,
    company,
    stepNumber,
  } = await req.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!enrollmentId) {
    return NextResponse.json({ error: "Missing enrollment ID" }, { status: 400 });
  }

  const isHtml = /<[a-zA-Z][\s\S]*?>/m.test(body.trim());
  const finalBody = isHtml ? inlineEmailHtml(body) : body;

  let newOutlookMessageId: string | null = null;

  if (outlookMessageId) {
    // Send as an in-thread Outlook reply
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json({ error: "Outlook not authenticated" }, { status: 401 });
    }
    try {
      const client = getGraphClient(accessToken);
      const action = outlookMessageDirection === "outbound" ? "replyAll" : "reply";
      await client.api(`/me/messages/${outlookMessageId}/${action}`).post({
        message: {
          body: { contentType: isHtml ? "HTML" : "Text", content: finalBody },
        },
      });
      newOutlookMessageId = await findRecentSentMessageId(client, to, subject) ?? outlookMessageId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Outlook reply failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } else {
    // Generic send path (Gmail or Outlook new message)
    const outlookToken = await getValidAccessToken();
    if (outlookToken) {
      try {
        const client = getGraphClient(outlookToken);
        await client.api("/me/sendMail").post({
          message: {
            subject,
            body: { contentType: isHtml ? "HTML" : "Text", content: finalBody },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: true,
        });
        newOutlookMessageId = await findRecentSentMessageId(client, to, subject);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Outlook send failed";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    } else {
      const googleToken = await getValidGoogleAccessToken();
      if (googleToken) {
        try {
          await sendGmailEmail({ accessToken: googleToken, to, subject, body: finalBody, isHtml });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Gmail send failed";
          return NextResponse.json({ error: msg }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
    }
  }

  // Record the follow-up in sent_emails so it appears in the inbox
  const { data: inserted, error: insertError } = await supabase
    .from("sent_emails")
    .insert({
      user_id: userId,
      sequence_id: sequenceId ?? null,
      sequence_name: sequenceName ?? null,
      enrollment_id: enrollmentId,
      lead_id: leadId ?? null,
      lead_name: leadName ?? leadEmail,
      lead_email: leadEmail ?? to,
      company: company ?? null,
      step_number: stepNumber != null ? stepNumber + 1 : 2,
      subject,
      body: finalBody,
      is_html: isHtml,
      outlook_message_id: newOutlookMessageId,
    })
    .select("id, sequence_id, sequence_name, enrollment_id, lead_id, lead_name, lead_email, company, step_number, subject, body, is_html, sent_at, outlook_message_id")
    .single();

  if (insertError) {
    // Send succeeded but recording failed — still return success so the user isn't misled
    console.error("Failed to record follow-up in sent_emails:", insertError.message);
    return NextResponse.json({ success: true, recorded: false });
  }

  return NextResponse.json({ success: true, recorded: true, sentEmail: inserted });
}
