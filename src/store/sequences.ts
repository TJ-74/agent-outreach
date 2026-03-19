import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export type SequenceStatus = "active" | "paused" | "draft" | "completed";

export interface Sequence {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: SequenceStatus;
  createdAt: string;
  updatedAt: string;
  stepCount?: number;
  enrolledCount?: number;
  groupId?: string | null;
  trainingConfigId?: string | null;
}

export interface SequenceStep {
  id: string;
  sequenceId: string;
  stepOrder: number;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceEnrollment {
  id: string;
  sequenceId: string;
  leadId: string;
  userId: string;
  currentStep: number;
  status: "active" | "completed" | "paused" | "stopped";
  enrolledAt: string;
  nextStepAt: string | null;
  completedAt: string | null;
}

interface SeqRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  status: SequenceStatus;
  created_at: string;
  updated_at: string;
  group_id: string | null;
  training_config_id: string | null;
}

interface StepRow {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_days: number;
  subject_template: string;
  body_template: string;
  created_at: string;
  updated_at: string;
}

interface EnrollRow {
  id: string;
  sequence_id: string;
  lead_id: string;
  user_id: string;
  current_step: number;
  status: "active" | "completed" | "paused" | "stopped";
  enrolled_at: string;
  next_step_at: string | null;
  completed_at: string | null;
}

function rowToSequence(row: SeqRow): Sequence {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? "",
    status: row.status ?? "paused",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    groupId: row.group_id ?? null,
    trainingConfigId: row.training_config_id ?? null,
  };
}

function rowToStep(row: StepRow): SequenceStep {
  return {
    id: row.id,
    sequenceId: row.sequence_id,
    stepOrder: row.step_order,
    delayDays: row.delay_days,
    subjectTemplate: row.subject_template ?? "",
    bodyTemplate: row.body_template ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function rowToEnrollment(row: EnrollRow): SequenceEnrollment {
  return {
    id: row.id,
    sequenceId: row.sequence_id,
    leadId: row.lead_id,
    userId: row.user_id,
    currentStep: row.current_step,
    status: row.status,
    enrolledAt: row.enrolled_at,
    nextStepAt: row.next_step_at,
    completedAt: row.completed_at,
  };
}

function getUserId(): string | null {
  if (typeof document === "undefined") return null;
  const olMatch = document.cookie.match(/(?:^|;\s*)ol_uid=([^;]*)/);
  if (olMatch) return decodeURIComponent(olMatch[1]);
  const ggMatch = document.cookie.match(/(?:^|;\s*)gg_uid=([^;]*)/);
  return ggMatch ? decodeURIComponent(ggMatch[1]) : null;
}

interface SequenceState {
  sequences: Sequence[];
  steps: SequenceStep[];
  enrollments: SequenceEnrollment[];
  loading: boolean;

  fetchSequences: () => Promise<void>;
  createSequence: (name: string, description?: string) => Promise<Sequence | null>;
  updateSequence: (id: string, updates: Partial<Pick<Sequence, "name" | "description" | "status" | "groupId" | "trainingConfigId">>) => Promise<void>;
  bulkEnroll: (sequenceId: string, leadIds: string[]) => Promise<void>;
  deleteSequence: (id: string) => Promise<void>;

  fetchSteps: (sequenceId: string) => Promise<void>;
  addStep: (sequenceId: string, step: Pick<SequenceStep, "stepOrder" | "delayDays" | "subjectTemplate" | "bodyTemplate">) => Promise<void>;
  updateStep: (id: string, updates: Partial<Pick<SequenceStep, "stepOrder" | "delayDays" | "subjectTemplate" | "bodyTemplate">>) => Promise<void>;
  removeStep: (id: string) => Promise<void>;
  reorderSteps: (sequenceId: string, orderedIds: string[]) => Promise<void>;

  fetchEnrollments: (sequenceId: string) => Promise<void>;
  enrollLead: (sequenceId: string, leadId: string) => Promise<void>;
  unenrollLead: (enrollmentId: string) => Promise<void>;
}

export const useSequenceStore = create<SequenceState>((set, get) => ({
  sequences: [],
  steps: [],
  enrollments: [],
  loading: false,

  fetchSequences: async () => {
    const uid = getUserId();
    if (!uid) { set({ sequences: [], loading: false }); return; }

    set({ loading: true });

    const { data: seqData } = await supabase
      .from("sequences")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!seqData) { set({ loading: false }); return; }

    const sequences = (seqData as SeqRow[]).map(rowToSequence);

    const ids = sequences.map((s) => s.id);
    if (ids.length > 0) {
      const [{ data: stepCounts }, { data: enrollCounts }] = await Promise.all([
        supabase.from("sequence_steps").select("sequence_id").in("sequence_id", ids),
        supabase.from("sequence_enrollments").select("sequence_id").in("sequence_id", ids),
      ]);

      const stMap = new Map<string, number>();
      const enMap = new Map<string, number>();
      for (const r of stepCounts ?? []) { stMap.set(r.sequence_id, (stMap.get(r.sequence_id) ?? 0) + 1); }
      for (const r of enrollCounts ?? []) { enMap.set(r.sequence_id, (enMap.get(r.sequence_id) ?? 0) + 1); }

      for (const seq of sequences) {
        seq.stepCount = stMap.get(seq.id) ?? 0;
        seq.enrolledCount = enMap.get(seq.id) ?? 0;
      }
    }

    set({ sequences, loading: false });
  },

  createSequence: async (name, description = "") => {
    const uid = getUserId();
    if (!uid) return null;

    const { data, error } = await supabase
      .from("sequences")
      .insert({ user_id: uid, name, description })
      .select()
      .single();

    if (!error && data) {
      const seq = { ...rowToSequence(data as SeqRow), stepCount: 0, enrolledCount: 0 };
      set((s) => ({ sequences: [seq, ...s.sequences] }));
      return seq;
    }
    return null;
  },

  updateSequence: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.groupId !== undefined) dbUpdates.group_id = updates.groupId;
    if (updates.trainingConfigId !== undefined) dbUpdates.training_config_id = updates.trainingConfigId;

    const { error } = await supabase.from("sequences").update(dbUpdates).eq("id", id);
    if (!error) {
      set((s) => ({
        sequences: s.sequences.map((sq) => sq.id === id ? { ...sq, ...updates, updatedAt: new Date().toISOString() } : sq),
      }));
    }
  },

  deleteSequence: async (id) => {
    const { error } = await supabase.from("sequences").delete().eq("id", id);
    if (!error) {
      set((s) => ({ sequences: s.sequences.filter((sq) => sq.id !== id) }));
    }
  },

  fetchSteps: async (sequenceId) => {
    const { data } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("step_order", { ascending: true });

    if (data) {
      set({ steps: (data as StepRow[]).map(rowToStep) });
    }
  },

  addStep: async (sequenceId, step) => {
    const { data, error } = await supabase
      .from("sequence_steps")
      .insert({
        sequence_id: sequenceId,
        step_order: step.stepOrder,
        delay_days: step.delayDays,
        subject_template: step.subjectTemplate,
        body_template: step.bodyTemplate,
      })
      .select()
      .single();

    if (!error && data) {
      const newStep = rowToStep(data as StepRow);
      set((s) => ({
        steps: [...s.steps, newStep].sort((a, b) => a.stepOrder - b.stepOrder),
        sequences: s.sequences.map((sq) =>
          sq.id === sequenceId ? { ...sq, stepCount: (sq.stepCount ?? 0) + 1 } : sq
        ),
      }));
    }
  },

  updateStep: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.stepOrder !== undefined) dbUpdates.step_order = updates.stepOrder;
    if (updates.delayDays !== undefined) dbUpdates.delay_days = updates.delayDays;
    if (updates.subjectTemplate !== undefined) dbUpdates.subject_template = updates.subjectTemplate;
    if (updates.bodyTemplate !== undefined) dbUpdates.body_template = updates.bodyTemplate;

    const { error } = await supabase.from("sequence_steps").update(dbUpdates).eq("id", id);
    if (!error) {
      set((s) => ({
        steps: s.steps.map((st) => st.id === id ? { ...st, ...updates, updatedAt: new Date().toISOString() } : st),
      }));
    }
  },

  removeStep: async (id) => {
    const step = get().steps.find((s) => s.id === id);
    const { error } = await supabase.from("sequence_steps").delete().eq("id", id);
    if (!error) {
      set((s) => ({
        steps: s.steps.filter((st) => st.id !== id),
        sequences: step
          ? s.sequences.map((sq) =>
              sq.id === step.sequenceId ? { ...sq, stepCount: Math.max(0, (sq.stepCount ?? 1) - 1) } : sq
            )
          : s.sequences,
      }));
    }
  },

  reorderSteps: async (sequenceId, orderedIds) => {
    const updates = orderedIds.map((id, i) =>
      supabase.from("sequence_steps").update({ step_order: i + 1, updated_at: new Date().toISOString() }).eq("id", id)
    );
    await Promise.all(updates);

    set((s) => ({
      steps: s.steps
        .map((st) => {
          const idx = orderedIds.indexOf(st.id);
          return idx >= 0 ? { ...st, stepOrder: idx + 1 } : st;
        })
        .sort((a, b) => a.stepOrder - b.stepOrder),
    }));
  },

  fetchEnrollments: async (sequenceId) => {
    const { data } = await supabase
      .from("sequence_enrollments")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("enrolled_at", { ascending: false });

    if (data) {
      set({ enrollments: (data as EnrollRow[]).map(rowToEnrollment) });
    }
  },

  enrollLead: async (sequenceId, leadId) => {
    const uid = getUserId();
    if (!uid) return;

    const { data, error } = await supabase
      .from("sequence_enrollments")
      .insert({ sequence_id: sequenceId, lead_id: leadId, user_id: uid })
      .select()
      .single();

    if (!error && data) {
      set((s) => ({
        enrollments: [rowToEnrollment(data as EnrollRow), ...s.enrollments],
        sequences: s.sequences.map((sq) =>
          sq.id === sequenceId ? { ...sq, enrolledCount: (sq.enrolledCount ?? 0) + 1 } : sq
        ),
      }));
    }
  },

  unenrollLead: async (enrollmentId) => {
    const enrollment = get().enrollments.find((e) => e.id === enrollmentId);
    const { error } = await supabase.from("sequence_enrollments").delete().eq("id", enrollmentId);
    if (!error) {
      set((s) => ({
        enrollments: s.enrollments.filter((e) => e.id !== enrollmentId),
        sequences: enrollment
          ? s.sequences.map((sq) =>
              sq.id === enrollment.sequenceId ? { ...sq, enrolledCount: Math.max(0, (sq.enrolledCount ?? 1) - 1) } : sq
            )
          : s.sequences,
      }));
    }
  },

  bulkEnroll: async (sequenceId, leadIds) => {
    const uid = getUserId();
    if (!uid || leadIds.length === 0) return;

    const existingLeadIds = new Set(
      get().enrollments.filter((e) => e.sequenceId === sequenceId).map((e) => e.leadId)
    );
    const newLeadIds = leadIds.filter((id) => !existingLeadIds.has(id));
    if (newLeadIds.length === 0) return;

    const rows = newLeadIds.map((leadId) => ({
      sequence_id: sequenceId,
      lead_id: leadId,
      user_id: uid,
    }));

    const { data, error } = await supabase
      .from("sequence_enrollments")
      .insert(rows)
      .select();

    if (!error && data) {
      const newEnrollments = (data as EnrollRow[]).map(rowToEnrollment);
      set((s) => ({
        enrollments: [...newEnrollments, ...s.enrollments],
        sequences: s.sequences.map((sq) =>
          sq.id === sequenceId ? { ...sq, enrolledCount: (sq.enrolledCount ?? 0) + newEnrollments.length } : sq
        ),
      }));
    }
  },
}));
