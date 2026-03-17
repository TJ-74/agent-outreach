import { NextRequest, NextResponse } from "next/server";
import { getValidGoogleAccessToken, sendGmailEmail } from "@/lib/google";
import { inlineEmailHtml } from "@/lib/sequence";

export async function POST(req: NextRequest) {
  const accessToken = await getValidGoogleAccessToken();
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
    await sendGmailEmail({
      accessToken,
      to,
      subject,
      body: finalBody,
      isHtml,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Send failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
