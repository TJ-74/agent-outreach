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
  research: string;
}

interface EnrollmentRow {
  id: string;
  lead_id: string;
  current_step: number;
  status: string;
  generated_subject: string | null;
  generated_body: string | null;
  is_html: boolean | null;
  generated_at: string | null;
}

interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  job_title: string | null;
  research: string | null;
}

export async function POST(req: NextRequest) {
  const { sequenceId, leadIds } = await req.json();
  if (!sequenceId || !Array.isArray(leadIds) || leadIds.length === 0) {
    return NextResponse.json({ error: "Missing sequenceId or leadIds" }, { status: 400 });
  }

  const [stepsRes, enrollmentsRes, leadsRes] = await Promise.all([
    supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("step_order", { ascending: true }),
    supabase
      .from("sequence_enrollments")
      .select("id, lead_id, current_step, status, generated_subject, generated_body, is_html, generated_at")
      .eq("sequence_id", sequenceId)
      .in("lead_id", leadIds)
      .eq("current_step", 1)
      .neq("status", "completed"),
    supabase
      .from("leads")
      .select("id, first_name, last_name, email, company, job_title, research")
      .in("id", leadIds),
  ]);

  const steps = stepsRes.data ?? [];
  const step1 = steps.find((s: { step_order: number }) => s.step_order === 1);

  const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[];
  const leads = (leadsRes.data ?? []) as LeadRow[];

  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const previews: LeadPreview[] = [];
  const skipped: string[] = [];
  const toUpsert: { id: string; generated_subject: string; generated_body: string; is_html: boolean; generated_at: string }[] = [];

  for (const enrollment of enrollments) {
    const lead = leadMap.get(enrollment.lead_id);
    if (!lead || !lead.email) {
      skipped.push(enrollment.lead_id);
      continue;
    }

    const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.email;

    // If we already generated and saved this email, use the saved version
    if (enrollment.generated_at && enrollment.generated_subject !== null) {
      previews.push({
        enrollmentId: enrollment.id,
        leadId: lead.id,
        leadName,
        email: lead.email,
        company: lead.company ?? "",
        subject: enrollment.generated_subject ?? "",
        body: enrollment.generated_body ?? "",
        isHtml: enrollment.is_html ?? false,
        research: lead.research ?? "",
      });
      continue;
    }

    // Generate from template (empty if no step1 — AI will generate later)
    let subject = "";
    let body = "";
    let isHtml = false;

    if (step1) {
      const vars = dbLeadToVars({
        first_name: lead.first_name ?? undefined,
        last_name: lead.last_name ?? undefined,
        email: lead.email ?? undefined,
        company: lead.company ?? undefined,
        job_title: lead.job_title ?? undefined,
      });
      subject = substituteTemplate(step1.subject_template ?? "", vars);
      body = substituteTemplate(step1.body_template ?? "", vars);
      isHtml = /<[a-zA-Z][\s\S]*?>/m.test(body.trim());
    }

    previews.push({
      enrollmentId: enrollment.id,
      leadId: lead.id,
      leadName,
      email: lead.email,
      company: lead.company ?? "",
      subject,
      body,
      isHtml,
      research: lead.research ?? "",
    });

    toUpsert.push({
      id: enrollment.id,
      generated_subject: subject,
      generated_body: body,
      is_html: isHtml,
      generated_at: new Date().toISOString(),
    });
  }

  // Persist generated emails so they survive page reloads and edits
  if (toUpsert.length > 0) {
    const updates = toUpsert.map((row) =>
      supabase
        .from("sequence_enrollments")
        .update({
          generated_subject: row.generated_subject,
          generated_body: row.generated_body,
          is_html: row.is_html,
          generated_at: row.generated_at,
        })
        .eq("id", row.id)
    );
    await Promise.all(updates);
  }

  return NextResponse.json({ previews, skipped });
}
