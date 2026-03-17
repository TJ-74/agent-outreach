import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient } from "@/lib/outlook";

export async function GET(req: NextRequest) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email")?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
  }

  try {
    const client = getGraphClient(accessToken);

    const selectFields =
      "id,subject,body,bodyPreview,from,toRecipients,receivedDateTime,sentDateTime,isRead";

    const [received, sent] = await Promise.all([
      client
        .api("/me/messages")
        .search(`"from:${email}"`)
        .select(selectFields)
        .top(30)
        .get()
        .catch(() => ({ value: [] })),
      client
        .api("/me/messages")
        .search(`"to:${email}"`)
        .select(selectFields)
        .top(30)
        .get()
        .catch(() => ({ value: [] })),
    ]);

    const toAddresses = (msg: {
      toRecipients?: Array<{ emailAddress?: { address?: string } }>;
    }): string => {
      const recipients = msg.toRecipients || [];
      return recipients
        .map((r) => r.emailAddress?.address?.trim())
        .filter(Boolean)
        .join(", ");
    };

    const bodyHtml = (msg: {
      body?: { contentType?: string; content?: string };
    }): string => {
      const b = msg.body;
      if (!b?.content) return "";
      return b.contentType === "html" ? b.content : "";
    };

    const seenIds = new Set<string>();
    const messages: Array<{
      id: string;
      subject: string;
      bodyPreview: string;
      bodyHtml: string;
      from: string;
      to: string;
      date: string;
      isFromMe: boolean;
      status: string;
    }> = [];

    for (const msg of received.value || []) {
      if (seenIds.has(msg.id)) continue;
      seenIds.add(msg.id);
      messages.push({
        id: msg.id,
        subject: msg.subject || "(No subject)",
        bodyPreview: msg.bodyPreview || "",
        bodyHtml: bodyHtml(msg),
        from: msg.from?.emailAddress?.address || "",
        to: toAddresses(msg),
        date: msg.receivedDateTime,
        isFromMe: false,
        status: msg.isRead !== false ? "read" : "unread",
      });
    }

    for (const msg of sent.value || []) {
      if (seenIds.has(msg.id)) continue;
      seenIds.add(msg.id);
      messages.push({
        id: msg.id,
        subject: msg.subject || "(No subject)",
        bodyPreview: msg.bodyPreview || "",
        bodyHtml: bodyHtml(msg),
        from: msg.from?.emailAddress?.address || "",
        to: toAddresses(msg),
        date: msg.sentDateTime || msg.receivedDateTime,
        isFromMe: true,
        status: "sent",
      });
    }

    messages.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({ messages });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch thread";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
