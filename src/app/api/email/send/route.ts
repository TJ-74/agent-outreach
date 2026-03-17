import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient } from "@/lib/outlook";
import { getValidGoogleAccessToken, sendGmailEmail } from "@/lib/google";
import { inlineEmailHtml } from "@/lib/sequence";

export async function POST(req: NextRequest) {
  const { to, subject, body } = await req.json();
  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 });
  }

  const isHtml = /<[a-zA-Z][\s\S]*?>/m.test(body.trim());
  const finalBody = isHtml ? inlineEmailHtml(body) : body;

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
      return NextResponse.json({ success: true, provider: "outlook" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Outlook send failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  const googleToken = await getValidGoogleAccessToken();
  if (googleToken) {
    try {
      await sendGmailEmail({
        accessToken: googleToken,
        to,
        subject,
        body: finalBody,
        isHtml,
      });
      return NextResponse.json({ success: true, provider: "google" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google send failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}
