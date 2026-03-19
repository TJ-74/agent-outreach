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

  const sentEmails = data ?? [];

  const leadIds = [...new Set(sentEmails.map((e) => e.lead_id))];
  let leadProfiles: Record<string, { jobTitle: string; research: string; linkedIn: string; notes: string; status: string }> = {};

  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, job_title, research, linked_in, notes, status")
      .in("id", leadIds);

    if (leads) {
      for (const l of leads) {
        leadProfiles[l.id] = {
          jobTitle: l.job_title ?? "",
          research: l.research ?? "",
          linkedIn: l.linked_in ?? "",
          notes: l.notes ?? "",
          status: l.status ?? "new",
        };
      }
    }
  }

  const enriched = sentEmails.map((e) => ({
    ...e,
    lead_profile: leadProfiles[e.lead_id] ?? null,
  }));

  return NextResponse.json({ sentEmails: enriched });
}
