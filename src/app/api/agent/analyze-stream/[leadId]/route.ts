export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;
  const userId = req.headers.get("X-User-Id") ?? "";

  const upstream = await fetch(
    `http://localhost:8000/agent/analyze-stream/${leadId}`,
    {
      method: "POST",
      headers: {
        "X-User-Id": userId,
        "Accept": "application/x-ndjson",
      },
    }
  );

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, { status: upstream.status });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
