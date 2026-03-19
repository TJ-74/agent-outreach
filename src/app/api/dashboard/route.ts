import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const jar = await cookies();
  const userId = jar.get("ol_uid")?.value || jar.get("gg_uid")?.value || null;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [
    leadsRes,
    sequencesRes,
    sentRes,
    enrollmentsRes,
    recentSentRes,
    recentLeadsRes,
  ] = await Promise.all([
    supabase.from("leads").select("id, status, action_needed, created_at").eq("user_id", userId),
    supabase.from("sequences").select("id, name, status, created_at").eq("user_id", userId),
    supabase.from("sent_emails").select("id, sent_at").eq("user_id", userId),
    supabase
      .from("sequence_enrollments")
      .select("id, status, current_step")
      .eq("user_id", userId)
      .eq("status", "active"),
    supabase
      .from("sent_emails")
      .select("id, lead_name, lead_email, company, subject, sequence_name, sent_at")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(6),
    supabase
      .from("leads")
      .select("id, first_name, last_name, email, company, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const leads = leadsRes.data ?? [];
  const sequences = sequencesRes.data ?? [];
  const sentEmails = sentRes.data ?? [];
  const enrollments = enrollmentsRes.data ?? [];
  const recentSent = recentSentRes.data ?? [];
  const recentLeads = recentLeadsRes.data ?? [];

  // Lead status breakdown
  const statusCounts: Record<string, number> = {};
  for (const l of leads) {
    statusCounts[l.status] = (statusCounts[l.status] ?? 0) + 1;
  }

  // Action needed breakdown
  const actionCounts: Record<string, number> = {};
  for (const l of leads) {
    if (l.action_needed && l.action_needed !== "none") {
      actionCounts[l.action_needed] = (actionCounts[l.action_needed] ?? 0) + 1;
    }
  }

  // Sequence status breakdown
  const seqStatusCounts: Record<string, number> = {};
  for (const s of sequences) {
    seqStatusCounts[s.status] = (seqStatusCounts[s.status] ?? 0) + 1;
  }

  // Sent emails per day (last 7 days)
  const now = new Date();
  const dailySent: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = sentEmails.filter(
      (e) => e.sent_at && e.sent_at.slice(0, 10) === dateStr,
    ).length;
    dailySent.push({ date: dateStr, count });
  }

  // Pending approvals (active enrollments at step 1)
  const pendingApprovals = enrollments.filter((e) => e.current_step === 1).length;

  return NextResponse.json({
    totals: {
      leads: leads.length,
      sequences: sequences.length,
      sentEmails: sentEmails.length,
      activeEnrollments: enrollments.length,
      pendingApprovals,
    },
    statusCounts,
    actionCounts,
    seqStatusCounts,
    dailySent,
    recentSent,
    recentLeads,
  });
}
