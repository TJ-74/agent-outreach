import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getGraphClient } from "@/lib/outlook";

export async function GET(req: NextRequest) {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const emailsParam = req.nextUrl.searchParams.get("emails");
  if (!emailsParam) {
    return NextResponse.json({ error: "Missing emails parameter" }, { status: 400 });
  }

  const emails = emailsParam.split(",").map((e) => e.trim().toLowerCase());

  try {
    const client = getGraphClient(accessToken);

    const results = await Promise.all(
      emails.map((email) =>
        client
          .api("/me/messages")
          .search(`"from:${email}"`)
          .select("from")
          .top(1)
          .get()
          .then((res) => {
            const hasReply = (res.value || []).some(
              (msg: { from?: { emailAddress?: { address?: string } } }) =>
                msg.from?.emailAddress?.address?.toLowerCase() === email
            );
            return hasReply ? email : null;
          })
          .catch(() => null)
      )
    );

    return NextResponse.json({
      repliedEmails: results.filter(Boolean),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch replies";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
