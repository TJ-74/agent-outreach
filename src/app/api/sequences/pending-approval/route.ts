import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { chunkArray, SUPABASE_IN_FILTER_CHUNK_SIZE, SUPABASE_PAGE_SIZE } from "@/lib/batch";

type EnrollmentSequenceRow = { sequence_id: string };

async function fetchAllPendingRows(userId: string): Promise<EnrollmentSequenceRow[]> {
  const rows: EnrollmentSequenceRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("sequence_enrollments")
      .select("sequence_id")
      .eq("user_id", userId)
      .eq("current_step", 1)
      .neq("status", "completed")
      .range(from, to);

    if (error || !data) break;
    rows.push(...(data as EnrollmentSequenceRow[]));
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllApprovedRows(userId: string): Promise<EnrollmentSequenceRow[]> {
  const rows: EnrollmentSequenceRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("sequence_enrollments")
      .select("sequence_id")
      .eq("user_id", userId)
      .or("current_step.gt.1,status.eq.completed")
      .range(from, to);

    if (error || !data) break;
    rows.push(...(data as EnrollmentSequenceRow[]));
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

/** Returns pending (step 1) and approved (step > 1) sequences for the approval page. */
export async function GET() {
  const jar = await cookies();
  const userId = jar.get("ol_uid")?.value || jar.get("gg_uid")?.value || null;
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Two targeted queries instead of fetching ALL enrollments
  const [pendingEnrollments, approvedRaw] = await Promise.all([
    fetchAllPendingRows(userId),
    fetchAllApprovedRows(userId),
  ]);

  const pendingSeqIds = new Set(pendingEnrollments.map((e) => e.sequence_id));

  // Approved section: only sequences that have NO pending leads (all sent)
  const approvedBySeq = new Map<string, number>();
  for (const e of approvedRaw) {
    if (pendingSeqIds.has(e.sequence_id)) continue;
    approvedBySeq.set(e.sequence_id, (approvedBySeq.get(e.sequence_id) ?? 0) + 1);
  }

  const pendingCountBySeq = new Map<string, number>();
  for (const e of pendingEnrollments) {
    pendingCountBySeq.set(e.sequence_id, (pendingCountBySeq.get(e.sequence_id) ?? 0) + 1);
  }

  const allSeqIds = [
    ...new Set([...pendingCountBySeq.keys(), ...approvedBySeq.keys()]),
  ];

  if (allSeqIds.length === 0) {
    return NextResponse.json({ pending: [], approved: [] });
  }

  const sequenceResponses = await Promise.all(
    chunkArray(allSeqIds, SUPABASE_IN_FILTER_CHUNK_SIZE).map((chunk) =>
      supabase
        .from("sequences")
        .select("id, name, status")
        .in("id", chunk),
    ),
  );
  const sequences = sequenceResponses.flatMap((res) => res.data ?? []);

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
