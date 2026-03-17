import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

/** Returns pending (step 1) and approved (step > 1) sequences for the approval page. */
export async function GET() {
  const jar = await cookies();
  const userId = jar.get("ol_uid")?.value || jar.get("gg_uid")?.value || null;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Two targeted queries instead of fetching ALL enrollments
  const [pendingRes, approvedRes] = await Promise.all([
    supabase
      .from("sequence_enrollments")
      .select("sequence_id")
      .eq("user_id", userId)
      .eq("current_step", 1)
      .neq("status", "completed"),
    supabase
      .from("sequence_enrollments")
      .select("sequence_id")
      .eq("user_id", userId)
      .or("current_step.gt.1,status.eq.completed"),
  ]);

  const pendingEnrollments = pendingRes.data ?? [];
  const approvedRaw = approvedRes.data ?? [];

  type Row = { sequence_id: string };
  const pendingSeqIds = new Set(pendingEnrollments.map((e: Row) => e.sequence_id));

  // Approved section: only sequences that have NO pending leads (all sent)
  const approvedBySeq = new Map<string, number>();
  for (const e of approvedRaw as Row[]) {
    if (pendingSeqIds.has(e.sequence_id)) continue;
    approvedBySeq.set(e.sequence_id, (approvedBySeq.get(e.sequence_id) ?? 0) + 1);
  }

  const pendingCountBySeq = new Map<string, number>();
  for (const e of pendingEnrollments as Row[]) {
    pendingCountBySeq.set(e.sequence_id, (pendingCountBySeq.get(e.sequence_id) ?? 0) + 1);
  }

  const allSeqIds = [
    ...new Set([...pendingCountBySeq.keys(), ...approvedBySeq.keys()]),
  ];

  if (allSeqIds.length === 0) {
    return NextResponse.json({ pending: [], approved: [] });
  }

  const { data: sequences } = await supabase
    .from("sequences")
    .select("id, name, status")
    .in("id", allSeqIds);

  const seqMap = new Map(
    (sequences ?? []).map((s: { id: string; name: string; status: string }) => [s.id, s])
  );

  const pending = [...pendingCountBySeq.entries()]
    .map(([seqId, count]) => ({
      sequenceId: seqId,
      name: seqMap.get(seqId)?.name ?? "Unknown",
      pendingCount: count,
    }))
    .sort((a, b) => b.pendingCount - a.pendingCount);

  const approved = [...approvedBySeq.entries()]
    .map(([seqId, count]) => ({
      sequenceId: seqId,
      name: seqMap.get(seqId)?.name ?? "Unknown",
      approvedCount: count,
      isCompleted: seqMap.get(seqId)?.status === "completed",
    }))
    .sort((a, b) => b.approvedCount - a.approvedCount);

  return NextResponse.json({ pending, approved });
}
