import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient } from "@/lib/outlook";
import { inlineEmailHtml } from "@/lib/sequence";

export async function POST(req: NextRequest) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { to, subject, body } = await req.json();
  if (!to || !subject || !body) {
    return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 });
  }

  const isHtml = /<[a-zA-Z][\s\S]*?>/m.test(body.trim());
  const finalBody = isHtml ? inlineEmailHtml(body) : body;

  try {
    const client = getGraphClient(accessToken);

    await client.api("/me/sendMail").post({
      message: {
        subject,
        body: { contentType: isHtml ? "HTML" : "Text", content: finalBody },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
