import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  applyUserSignatureToGeneratedBody,
  substituteTemplate,
  dbLeadToVars,
} from "@/lib/sequence";
import { chunkArray, SUPABASE_IN_FILTER_CHUNK_SIZE, SUPABASE_PAGE_SIZE } from "@/lib/batch";

const DEFAULT_APPROVAL_PAGE_SIZE = 25;
const MAX_APPROVAL_PAGE_SIZE = 100;

export interface LeadPreview {
  enrollmentId: string;
  leadId: string;
  leadName: string;
  email: string;
  company: string;
  /** Lead's LinkedIn profile URL when stored */
  linkedIn: string;
  subject: string;
  body: string;
  isHtml: boolean;
  research: string;
  hasPreviousConversation: boolean;
  previousConversationCount: number;
  previousConversationAt: string | null;
  previousConversationSubject: string;
}

interface EnrollmentRow {
  id: string;
  lead_id: string;
  user_id: string;
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
  linked_in: string | null;
}

interface ConversationRow {
  lead_id: string;
  subject: string | null;
  sent_at: string | null;
}

interface PreviousConversationInfo {
  count: number;
  latestAt: string | null;
  latestSubject: string;
}

async function fetchPendingEnrollments(sequenceId: string): Promise<EnrollmentRow[]> {
  const rows: EnrollmentRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("sequence_enrollments")
      .select(
        "id, lead_id, user_id, current_step, status, generated_subject, generated_body, is_html, generated_at",
      )
      .eq("sequence_id", sequenceId)
      .eq("current_step", 1)
      .neq("status", "completed")
      .order("enrolled_at", { ascending: false })
      .range(from, to);

    if (error || !data) break;
    rows.push(...(data as EnrollmentRow[]));
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchPendingEnrollmentPage(
  sequenceId: string,
  page: number,
  pageSize: number,
): Promise<{ rows: EnrollmentRow[]; total: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("sequence_enrollments")
    .select(
      "id, lead_id, user_id, current_step, status, generated_subject, generated_body, is_html, generated_at",
      { count: "exact" },
    )
    .eq("sequence_id", sequenceId)
    .eq("current_step", 1)
    .neq("status", "completed")
    .order("enrolled_at", { ascending: false })
    .range(from, to);

  if (error || !data) {
    return { rows: [], total: 0 };
  }

  return { rows: data as EnrollmentRow[], total: count ?? 0 };
}

async function fetchPendingEnrollmentsForLeads(
  sequenceId: string,
  leadIds: string[],
): Promise<EnrollmentRow[]> {
  const rows: EnrollmentRow[] = [];

  for (const chunk of chunkArray(leadIds, SUPABASE_IN_FILTER_CHUNK_SIZE)) {
    const { data } = await supabase
      .from("sequence_enrollments")
      .select(
        "id, lead_id, user_id, current_step, status, generated_subject, generated_body, is_html, generated_at",
      )
      .eq("sequence_id", sequenceId)
      .in("lead_id", chunk)
      .eq("current_step", 1)
      .neq("status", "completed");

    rows.push(...((data ?? []) as EnrollmentRow[]));
  }

  return rows;
}

async function fetchLeads(leadIds: string[]): Promise<LeadRow[]> {
  const rows: LeadRow[] = [];

  for (const chunk of chunkArray(leadIds, SUPABASE_IN_FILTER_CHUNK_SIZE)) {
    const { data } = await supabase
      .from("leads")
      .select("id, first_name, last_name, email, company, job_title, research, linked_in")
      .in("id", chunk);

    rows.push(...((data ?? []) as LeadRow[]));
  }

  return rows;
}

async function fetchPreviousConversations(
  userIds: string[],
  leadIds: string[],
): Promise<Map<string, PreviousConversationInfo>> {
  const history = new Map<string, PreviousConversationInfo>();
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const uniqueLeadIds = [...new Set(leadIds.filter(Boolean))];
  if (uniqueUserIds.length === 0 || uniqueLeadIds.length === 0) return history;

  const addRows = (rows: ConversationRow[]) => {
    for (const row of rows) {
      if (!row.lead_id) continue;
      const current = history.get(row.lead_id) ?? {
        count: 0,
        latestAt: null,
        latestSubject: "",
      };
      current.count += 1;

      const rowTime = row.sent_at ? new Date(row.sent_at).getTime() : 0;
      const latestTime = current.latestAt ? new Date(current.latestAt).getTime() : 0;
      if (rowTime >= latestTime) {
        current.latestAt = row.sent_at;
        current.latestSubject = row.subject ?? "";
      }
      history.set(row.lead_id, current);
    }
  };

  for (const userChunk of chunkArray(uniqueUserIds, SUPABASE_IN_FILTER_CHUNK_SIZE)) {
    for (const leadChunk of chunkArray(uniqueLeadIds, SUPABASE_IN_FILTER_CHUNK_SIZE)) {
      const [{ data: sentRows }, { data: inboundRows }] = await Promise.all([
        supabase
          .from("sent_emails")
          .select("lead_id, subject, sent_at")
          .in("user_id", userChunk)
          .in("lead_id", leadChunk),
        supabase
          .from("messages")
          .select("lead_id, subject, sent_at")
          .in("user_id", userChunk)
          .in("lead_id", leadChunk),
      ]);

      addRows((sentRows ?? []) as ConversationRow[]);
      addRows((inboundRows ?? []) as ConversationRow[]);
    }
  }

  return history;
}

export async function POST(req: NextRequest) {
  const { sequenceId, leadIds, page: pageInput, pageSize: pageSizeInput } = await req.json();
  const requestedLeadIds = Array.isArray(leadIds) ? (leadIds as string[]) : null;
  const page =
    typeof pageInput === "number" && Number.isFinite(pageInput)
      ? Math.max(1, Math.floor(pageInput))
      : null;
  const pageSize =
    typeof pageSizeInput === "number" && Number.isFinite(pageSizeInput)
      ? Math.min(MAX_APPROVAL_PAGE_SIZE, Math.max(1, Math.floor(pageSizeInput)))
      : DEFAULT_APPROVAL_PAGE_SIZE;
  if (!sequenceId) {
    return NextResponse.json({ error: "Missing sequenceId" }, { status: 400 });
  }
  if (requestedLeadIds && requestedLeadIds.length === 0) {
    return NextResponse.json({ previews: [], skipped: [], pagination: { page: 1, pageSize, total: 0 } });
  }

  const pagedEnrollments =
    !requestedLeadIds && page
      ? await fetchPendingEnrollmentPage(sequenceId, page, pageSize)
      : null;

  const [stepsRes, enrollments] = await Promise.all([
    supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("step_order", { ascending: true }),
    pagedEnrollments
      ? Promise.resolve(pagedEnrollments.rows)
      : requestedLeadIds
        ? fetchPendingEnrollmentsForLeads(sequenceId, requestedLeadIds)
        : fetchPendingEnrollments(sequenceId),
  ]);

  const steps = stepsRes.data ?? [];
  const step1 = steps.find((s: { step_order: number }) => s.step_order === 1);

  const previewLeadIds = [...new Set(enrollments.map((e) => e.lead_id))];
  const leads = previewLeadIds.length > 0 ? await fetchLeads(previewLeadIds) : [];

  const leadMap = new Map(leads.map((l) => [l.id, l]));
  const previews: LeadPreview[] = [];
  const skipped: string[] = [];
  const toUpsert: { id: string; generated_subject: string; generated_body: string; is_html: boolean; generated_at: string }[] = [];

  const ownerIds = [...new Set(enrollments.map((e) => e.user_id).filter(Boolean))];
  const previousConversationByLead = await fetchPreviousConversations(ownerIds, previewLeadIds);
  const signatureUsers =
    ownerIds.length === 0
      ? []
      : (
          await Promise.all(
            chunkArray(ownerIds, SUPABASE_IN_FILTER_CHUNK_SIZE).map((chunk) =>
              supabase
                .from("users")
                .select("id, email_signature, email_signature_enabled")
                .in("id", chunk),
            ),
          )
        ).flatMap((res) => res.data ?? []);

  const sigByUser = new Map<
    string,
    { html: string; enabled: boolean }
  >();
  for (const u of signatureUsers) {
    sigByUser.set(u.id, {
      html: u.email_signature ?? "",
      enabled: u.email_signature_enabled !== false,
    });
  }

  for (const enrollment of enrollments) {
    const lead = leadMap.get(enrollment.lead_id);
    if (!lead || !lead.email) {
      skipped.push(enrollment.lead_id);
      continue;
    }

    const leadName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.email;
    const previousConversation = previousConversationByLead.get(lead.id);
    const previousConversationFields = {
      hasPreviousConversation: !!previousConversation?.count,
      previousConversationCount: previousConversation?.count ?? 0,
      previousConversationAt: previousConversation?.latestAt ?? null,
      previousConversationSubject: previousConversation?.latestSubject ?? "",
    };

    // If we already generated and saved this email, use the saved version
    if (enrollment.generated_at && enrollment.generated_subject !== null) {
      previews.push({
        enrollmentId: enrollment.id,
        leadId: lead.id,
        leadName,
        email: lead.email,
        company: lead.company ?? "",
        linkedIn: lead.linked_in?.trim() ?? "",
        subject: enrollment.generated_subject ?? "",
        body: enrollment.generated_body ?? "",
        isHtml: enrollment.is_html ?? false,
        research: lead.research ?? "",
        ...previousConversationFields,
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

    if (body.trim().length > 0) {
      const ownerSig = sigByUser.get(enrollment.user_id);
      const withSig = applyUserSignatureToGeneratedBody(
        body,
        ownerSig?.html ?? "",
        ownerSig?.enabled ?? true,
      );
      body = withSig.body;
      isHtml = withSig.isHtml;
    }

    previews.push({
      enrollmentId: enrollment.id,
      leadId: lead.id,
      leadName,
      email: lead.email,
      company: lead.company ?? "",
      linkedIn: lead.linked_in?.trim() ?? "",
      subject,
      body,
      isHtml,
      research: lead.research ?? "",
      ...previousConversationFields,
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
    for (const chunk of chunkArray(toUpsert, SUPABASE_IN_FILTER_CHUNK_SIZE)) {
      await Promise.all(
        chunk.map((row) =>
          supabase
            .from("sequence_enrollments")
            .update({
              generated_subject: row.generated_subject,
              generated_body: row.generated_body,
              is_html: row.is_html,
              generated_at: row.generated_at,
            })
            .eq("id", row.id),
        ),
      );
    }
  }

  return NextResponse.json({
    previews,
    skipped,
    pagination: pagedEnrollments
      ? {
          page: page ?? 1,
          pageSize,
          total: pagedEnrollments.total,
        }
      : undefined,
  });
}
