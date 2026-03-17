import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const jar = await cookies();
  const userId = jar.get("ol_uid")?.value || jar.get("gg_uid")?.value || null;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("sent_emails")
    .select("id, sequence_id, sequence_name, lead_id, lead_name, lead_email, company, step_number, subject, body, is_html, sent_at")
    .eq("user_id", userId)
    .order("sent_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sentEmails: data ?? [] });
}
