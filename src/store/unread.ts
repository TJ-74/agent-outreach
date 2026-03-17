import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UnreadState {
  totalUnread: number;
  unreadByLead: Record<string, number>;
  init: (userId: string) => void;
  refresh: (userId: string) => void;
  markRead: (leadId: string) => void;
}

let _channel: RealtimeChannel | null = null;
let _initialized = false;

export const useUnreadStore = create<UnreadState>((set, get) => ({
  totalUnread: 0,
  unreadByLead: {},

  init: (userId: string) => {
    if (_initialized) return;
    _initialized = true;

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("lead_id")
        .eq("user_id", userId)
        .eq("direction", "inbound")
        .eq("status", "unread");

      if (data) {
        const byLead: Record<string, number> = {};
        for (const row of data) {
          byLead[row.lead_id] = (byLead[row.lead_id] ?? 0) + 1;
        }
        set({ unreadByLead: byLead, totalUnread: data.length });
      }
    })();

    _channel = supabase
      .channel("unread-counter")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { direction?: string; lead_id?: string };
          if (row.direction !== "inbound" || !row.lead_id) return;
          const prev = get().unreadByLead;
          const count = (prev[row.lead_id] ?? 0) + 1;
          set({
            unreadByLead: { ...prev, [row.lead_id]: count },
            totalUnread: get().totalUnread + 1,
          });
        },
      )
      .subscribe();
  },

  refresh: (userId: string) => {
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("lead_id")
        .eq("user_id", userId)
        .eq("direction", "inbound")
        .eq("status", "unread");

      if (data) {
        const byLead: Record<string, number> = {};
        for (const row of data) {
          byLead[row.lead_id] = (byLead[row.lead_id] ?? 0) + 1;
        }
        set({ unreadByLead: byLead, totalUnread: data.length });
      }
    })();
  },

  markRead: (leadId: string) => {
    const prev = get().unreadByLead;
    const removed = prev[leadId] ?? 0;
    if (removed === 0) return;
    const { [leadId]: _, ...rest } = prev;
    set({ unreadByLead: rest, totalUnread: Math.max(0, get().totalUnread - removed) });
  },
}));
