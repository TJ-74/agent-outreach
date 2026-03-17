import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface Draft {
  id: string;
  leadId: string;
  userId: string;
  subject: string;
  body: string;
  replyToMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DbRow {
  id: string;
  lead_id: string;
  user_id: string;
  subject: string;
  body: string;
  reply_to_message_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToDraft(row: DbRow): Draft {
  return {
    id: row.id,
    leadId: row.lead_id,
    userId: row.user_id,
    subject: row.subject,
    body: row.body,
    replyToMessageId: row.reply_to_message_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getUserId(): string | null {
  if (typeof document === "undefined") return null;
  const olMatch = document.cookie.match(/(?:^|;\s*)ol_uid=([^;]*)/);
  if (olMatch) return decodeURIComponent(olMatch[1]);
  const ggMatch = document.cookie.match(/(?:^|;\s*)gg_uid=([^;]*)/);
  return ggMatch ? decodeURIComponent(ggMatch[1]) : null;
}

interface DraftState {
  drafts: Draft[];
  draftCountByLead: Record<string, number>;
  fetchDrafts: (leadId: string) => Promise<void>;
  fetchDraftCounts: () => Promise<void>;
  saveDraft: (leadId: string, subject: string, body: string) => Promise<Draft | null>;
  updateDraft: (id: string, subject: string, body: string) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
}

export const useDraftStore = create<DraftState>((set) => ({
  drafts: [],
  draftCountByLead: {},

  fetchDraftCounts: async () => {
    const uid = getUserId();
    if (!uid) return;

    const { data } = await supabase
      .from("drafts")
      .select("lead_id")
      .eq("user_id", uid);

    if (data) {
      const counts: Record<string, number> = {};
      for (const row of data) {
        const lid = (row as { lead_id: string }).lead_id;
        counts[lid] = (counts[lid] || 0) + 1;
      }
      set({ draftCountByLead: counts });
    }
  },

  fetchDrafts: async (leadId) => {
    const uid = getUserId();
    if (!uid) return;

    const { data } = await supabase
      .from("drafts")
      .select("*")
      .eq("lead_id", leadId)
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (data) {
      set({ drafts: (data as DbRow[]).map(rowToDraft) });
    }
  },

  saveDraft: async (leadId, subject, body) => {
    const uid = getUserId();
    if (!uid) return null;

    const { data, error } = await supabase
      .from("drafts")
      .insert({
        lead_id: leadId,
        user_id: uid,
        subject,
        body,
      })
      .select()
      .single();

    if (!error && data) {
      const draft = rowToDraft(data as DbRow);
      set((state) => ({
        drafts: [draft, ...state.drafts],
        draftCountByLead: {
          ...state.draftCountByLead,
          [leadId]: (state.draftCountByLead[leadId] || 0) + 1,
        },
      }));
      return draft;
    }
    return null;
  },

  updateDraft: async (id, subject, body) => {
    const { error } = await supabase
      .from("drafts")
      .update({ subject, body, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      set((state) => ({
        drafts: state.drafts.map((d) =>
          d.id === id ? { ...d, subject, body, updatedAt: new Date().toISOString() } : d
        ),
      }));
    }
  },

  deleteDraft: async (id) => {
    const { error } = await supabase.from("drafts").delete().eq("id", id);

    if (!error) {
      set((state) => {
        const deleted = state.drafts.find((d) => d.id === id);
        const newCounts = { ...state.draftCountByLead };
        if (deleted && newCounts[deleted.leadId]) {
          newCounts[deleted.leadId] = Math.max(0, newCounts[deleted.leadId] - 1);
          if (newCounts[deleted.leadId] === 0) delete newCounts[deleted.leadId];
        }
        return {
          drafts: state.drafts.filter((d) => d.id !== id),
          draftCountByLead: newCounts,
        };
      });
    }
  },
}));
