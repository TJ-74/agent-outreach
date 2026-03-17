import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  const { sequenceId } = await params;
  if (!sequenceId) {
    return NextResponse.json({ error: "Missing sequenceId" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("sequences")
    .select("id, name, status")
    .eq("id", sequenceId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    status: data.status,
  });
}
