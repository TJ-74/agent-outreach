import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export type LeadStatus =
  | "new"
  | "contacted"
  | "replied"
  | "engaged"
  | "qualified"
  | "won"
  | "lost"
  | "nurture";

export type ActionNeeded = "needs_reply" | "waiting_for_reply" | "needs_human" | "none";
export type LeadInput = Omit<
  Lead,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "engagementScore"
  | "sentiment"
  | "aiSummary"
  | "nextAction"
  | "nextActionType"
  | "nextActionAt"
  | "lastContactedAt"
  | "lastRepliedAt"
  | "tags"
  | "actionNeeded"
>;

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  linkedIn: string;
  status: LeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
  engagementScore: number;
  sentiment: string;
  aiSummary: string;
  nextAction: string;
  nextActionType: string;
  nextActionAt: string | null;
  lastContactedAt: string | null;
  lastRepliedAt: string | null;
  tags: string[];
  research: string;
  actionNeeded: ActionNeeded;
}

interface DbRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  job_title: string;
  linked_in: string;
  status: LeadStatus;
  notes: string;
  created_at: string;
  updated_at: string;
  engagement_score: number;
  sentiment: string;
  ai_summary: string;
  next_action: string;
  next_action_type: string;
  next_action_at: string | null;
  last_contacted_at: string | null;
  last_replied_at: string | null;
  tags: string[];
  research: string;
  action_needed: ActionNeeded;
}

function rowToLead(row: DbRow): Lead {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    company: row.company ?? "",
    jobTitle: row.job_title ?? "",
    linkedIn: row.linked_in ?? "",
    status: row.status ?? "new",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    engagementScore: row.engagement_score ?? 0,
    sentiment: row.sentiment ?? "unknown",
    aiSummary: row.ai_summary ?? "",
    nextAction: row.next_action ?? "",
    nextActionType: row.next_action_type ?? "",
    nextActionAt: row.next_action_at,
    lastContactedAt: row.last_contacted_at,
    lastRepliedAt: row.last_replied_at,
    tags: row.tags ?? [],
    research: row.research ?? "",
    actionNeeded: row.action_needed ?? "none",
  };
}

function getUserId(): string | null {
  if (typeof document === "undefined") return null;
  const olMatch = document.cookie.match(/(?:^|;\s*)ol_uid=([^;]*)/);
  if (olMatch) return decodeURIComponent(olMatch[1]);
  const ggMatch = document.cookie.match(/(?:^|;\s*)gg_uid=([^;]*)/);
  return ggMatch ? decodeURIComponent(ggMatch[1]) : null;
}

interface LeadState {
  leads: Lead[];
  searchQuery: string;
  filterStatus: ActionNeeded | "all";
  loading: boolean;
  fetchLeads: () => Promise<void>;
  addLead: (lead: LeadInput) => Promise<void>;
  addLeadsBulk: (leads: LeadInput[]) => Promise<{ inserted: number; skipped: number; leadIds: string[] }>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  setSearch: (query: string) => void;
  setFilter: (status: ActionNeeded | "all") => void;
}

export const useLeadStore = create<LeadState>((set) => ({
  leads: [],
  searchQuery: "",
  filterStatus: "all",
  loading: false,

  fetchLeads: async () => {
    const uid = getUserId();
    if (!uid) {
      set({ leads: [], loading: false });
      return;
    }

    set({ loading: true });
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!error && data) {
      set({ leads: (data as DbRow[]).map(rowToLead) });
    }
    set({ loading: false });
  },

  addLead: async (lead) => {
    const uid = getUserId();
    if (!uid) return;

    const { data, error } = await supabase
      .from("leads")
      .insert({
        user_id: uid,
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        company: lead.company,
        job_title: lead.jobTitle,
        linked_in: lead.linkedIn,
        status: lead.status,
        notes: lead.notes,
      })
      .select()
      .single();

    if (!error && data) {
      set((state) => ({
        leads: [rowToLead(data as DbRow), ...state.leads],
      }));
    }
  },

  addLeadsBulk: async (leads) => {
    const uid = getUserId();
    if (!uid || leads.length === 0) return { inserted: 0, skipped: leads.length, leadIds: [] };

    const rows = leads.map((lead) => ({
      user_id: uid,
      first_name: lead.firstName,
      last_name: lead.lastName,
      email: lead.email,
      company: lead.company,
      job_title: lead.jobTitle,
      linked_in: lead.linkedIn,
      status: lead.status,
      notes: lead.notes,
    }));

    const { data, error } = await supabase
      .from("leads")
      .insert(rows)
      .select();

    if (error || !data) {
      return { inserted: 0, skipped: leads.length, leadIds: [] };
    }

    const insertedRows = (data as DbRow[]).map(rowToLead);
    set((state) => ({
      leads: [...insertedRows, ...state.leads],
    }));

    return {
      inserted: insertedRows.length,
      skipped: Math.max(0, leads.length - insertedRows.length),
      leadIds: insertedRows.map((row) => row.id),
    };
  },

  updateLead: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
    if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.company !== undefined) dbUpdates.company = updates.company;
    if (updates.jobTitle !== undefined) dbUpdates.job_title = updates.jobTitle;
    if (updates.linkedIn !== undefined) dbUpdates.linked_in = updates.linkedIn;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.engagementScore !== undefined) dbUpdates.engagement_score = updates.engagementScore;
    if (updates.sentiment !== undefined) dbUpdates.sentiment = updates.sentiment;
    if (updates.aiSummary !== undefined) dbUpdates.ai_summary = updates.aiSummary;
    if (updates.nextAction !== undefined) dbUpdates.next_action = updates.nextAction;
    if (updates.nextActionType !== undefined) dbUpdates.next_action_type = updates.nextActionType;
    if (updates.nextActionAt !== undefined) dbUpdates.next_action_at = updates.nextActionAt;
    if (updates.lastContactedAt !== undefined) dbUpdates.last_contacted_at = updates.lastContactedAt;
    if (updates.lastRepliedAt !== undefined) dbUpdates.last_replied_at = updates.lastRepliedAt;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.actionNeeded !== undefined) dbUpdates.action_needed = updates.actionNeeded;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("leads")
      .update(dbUpdates)
      .eq("id", id);

    if (!error) {
      set((state) => ({
        leads: state.leads.map((l) =>
          l.id === id ? { ...l, ...updates } : l
        ),
      }));
    }
  },

  deleteLead: async (id) => {
    const { error } = await supabase.from("leads").delete().eq("id", id);

    if (!error) {
      set((state) => ({
        leads: state.leads.filter((l) => l.id !== id),
      }));
    }
  },

  setSearch: (query) => set({ searchQuery: query }),
  setFilter: (status) => set({ filterStatus: status }),
}));
