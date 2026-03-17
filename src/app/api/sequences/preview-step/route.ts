import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { substituteTemplate, dbLeadToVars } from "@/lib/sequence";

export interface LeadPreview {
  enrollmentId: string;
  leadId: string;
  leadName: string;
  email: string;
  company: string;
  subject: string;
  body: string;
  isHtml: boolean;
}

export async function POST(req: NextRequest) {
  const { sequenceId, leadIds } = await req.json();
  if (!sequenceId || !Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "Missing sequenceId or leadIds" }, { status: 400 });
  }

  // Batch fetch: steps, enrollments, and leads in 3 queries instead of 2 per lead
  const [stepsRes, enrollmentsRes, leadsRes] = await Promise.all([
    supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("step_order", { ascending: true }),
    supabase
      .from("sequence_enrollments")
      .select("id, lead_id, current_step, status")
      .eq("sequence_id", sequenceId)
      .in("lead_id", leadIds)
      .eq("current_step", 1)
      .neq("status", "completed"),
    supabase
      .from("leads")
      .select("id, first_name, last_name, email, company, job_title")
      .in("id", leadIds),
  ]);

  const steps = stepsRes.data ?? [];
  const step1 = steps.find((s: { step_order: number }) => s.step_order === 1);
  if (!step1) {
    return NextResponse.json({ error: "No step 1 found" }, { status: 400 });
  }

  const enrollments = (enrollmentsRes.data ?? []) as { id: string; lead_id: string; current_step: number; status: string }[];
  const leads = (leadsRes.data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; company: string | null; job_title: string | null }[];

  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const previews: LeadPreview[] = [];
  const skipped: string[] = [];

  for (const enrollment of enrollments) {
    const lead = leadMap.get(enrollment.lead_id);
    if (!lead || !lead.email) {
      skipped.push(enrollment.lead_id);
      continue;
    }

    const vars = dbLeadToVars({
      first_name: lead.first_name ?? undefined,
      last_name: lead.last_name ?? undefined,
      email: lead.email ?? undefined,
      company: lead.company ?? undefined,
      job_title: lead.job_title ?? undefined,
    });
    const subject = substituteTemplate(step1.subject_template ?? "", vars);
    const body = substituteTemplate(step1.body_template ?? "", vars);
    const isHtml = /<[a-zA-Z][\s\S]*?>/m.test(body.trim());

    previews.push({
      enrollmentId: enrollment.id,
      leadId: lead.id,
      leadName: `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.email,
      email: lead.email,
      company: lead.company ?? "",
      subject,
      body,
      isHtml,
    });
  }

  return NextResponse.json({ previews, skipped });
}
