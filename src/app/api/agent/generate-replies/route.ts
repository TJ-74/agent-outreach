import { NextResponse } from "next/server";
import { getUserId } from "@/lib/outlook";

const BACKEND = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

export async function POST() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const res = await fetch(`${BACKEND}/agent/generate-replies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-User-Id": userId,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || "Generate replies failed" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
