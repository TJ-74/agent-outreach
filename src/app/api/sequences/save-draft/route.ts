import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { enrollmentId, subject, body, isHtml } = await req.json();

  if (!enrollmentId || subject == null || body == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await supabase
    .from("sequence_enrollments")
    .update({
      generated_subject: subject,
      generated_body: body,
      is_html: isHtml ?? false,
      generated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
