import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient } from "@/lib/outlook";
import { inlineEmailHtml } from "@/lib/sequence";

export async function POST(req: NextRequest) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { messageId, body } = await req.json();
  if (!messageId || !body) {
    return NextResponse.json(
      { error: "Missing messageId or body" },
      { status: 400 }
    );
  }

  const isHtml = /<[a-zA-Z][\s\S]*?>/m.test(body.trim());
  const finalBody = isHtml ? inlineEmailHtml(body) : body;

  try {
    const client = getGraphClient(accessToken);

    await client.api(`/me/messages/${messageId}/reply`).post({
      message: {
        body: { contentType: isHtml ? "HTML" : "Text", content: finalBody },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reply failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
