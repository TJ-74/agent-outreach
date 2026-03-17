import { create } from "zustand";
import { supabase } from "@/lib/supabase";

export interface Group {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

export interface GroupMember {
  id: string;
  groupId: string;
  leadId: string;
  addedAt: string;
  leadName?: string;
  leadEmail?: string;
  leadCompany?: string;
}

interface GroupRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface MemberRow {
  id: string;
  group_id: string;
  lead_id: string;
  added_at: string;
}

function rowToGroup(row: GroupRow): Group {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function rowToMember(row: MemberRow): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    leadId: row.lead_id,
    addedAt: row.added_at,
  };
}

function getUserId(): string | null {
  if (typeof document === "undefined") return null;
  const olMatch = document.cookie.match(/(?:^|;\s*)ol_uid=([^;]*)/);
  if (olMatch) return decodeURIComponent(olMatch[1]);
  const ggMatch = document.cookie.match(/(?:^|;\s*)gg_uid=([^;]*)/);
  return ggMatch ? decodeURIComponent(ggMatch[1]) : null;
}

interface GroupState {
  groups: Group[];
  members: GroupMember[];
  loading: boolean;

  fetchGroups: () => Promise<void>;
  createGroup: (name: string, description?: string) => Promise<Group | null>;
  updateGroup: (id: string, updates: Partial<Pick<Group, "name" | "description">>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;

  fetchMembers: (groupId: string) => Promise<void>;
  addMembers: (groupId: string, leadIds: string[]) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  members: [],
  loading: false,

  fetchGroups: async () => {
    const uid = getUserId();
    if (!uid) { set({ groups: [], loading: false }); return; }

    set({ loading: true });

    const { data } = await supabase
      .from("groups")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (!data) { set({ loading: false }); return; }

    const groups = (data as GroupRow[]).map(rowToGroup);

    const ids = groups.map((g) => g.id);
    if (ids.length > 0) {
      const { data: memberRows } = await supabase
        .from("group_members")
        .select("group_id")
        .in("group_id", ids);

      const countMap = new Map<string, number>();
      for (const r of memberRows ?? []) {
        countMap.set(r.group_id, (countMap.get(r.group_id) ?? 0) + 1);
      }
      for (const g of groups) {
        g.memberCount = countMap.get(g.id) ?? 0;
      }
    }

    set({ groups, loading: false });
  },

  createGroup: async (name, description = "") => {
    const uid = getUserId();
    if (!uid) return null;

    const { data, error } = await supabase
      .from("groups")
      .insert({ user_id: uid, name, description })
      .select()
      .single();

    if (!error && data) {
      const group = { ...rowToGroup(data as GroupRow), memberCount: 0 };
      set((s) => ({ groups: [group, ...s.groups] }));
      return group;
    }
    return null;
  },

  updateGroup: async (id, updates) => {
    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;

    const { error } = await supabase.from("groups").update(dbUpdates).eq("id", id);
    if (!error) {
      set((s) => ({
        groups: s.groups.map((g) => g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g),
      }));
    }
  },

  deleteGroup: async (id) => {
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (!error) {
      set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
    }
  },

  fetchMembers: async (groupId) => {
    const { data } = await supabase
      .from("group_members")
      .select("*, leads(first_name, last_name, email, company)")
      .eq("group_id", groupId)
      .order("added_at", { ascending: false });

    if (data) {
      const members: GroupMember[] = data.map((row: Record<string, unknown>) => {
        const lead = row.leads as Record<string, string> | null;
        return {
          id: row.id as string,
          groupId: row.group_id as string,
          leadId: row.lead_id as string,
          addedAt: row.added_at as string,
          leadName: lead ? `${lead.first_name} ${lead.last_name}` : undefined,
          leadEmail: lead?.email,
          leadCompany: lead?.company,
        };
      });
      set({ members });
    }
  },

  addMembers: async (groupId, leadIds) => {
    if (leadIds.length === 0) return;

    const existing = get().members.map((m) => m.leadId);
    const newIds = leadIds.filter((id) => !existing.includes(id));
    if (newIds.length === 0) return;

    const rows = newIds.map((leadId) => ({ group_id: groupId, lead_id: leadId }));
    const { error } = await supabase.from("group_members").insert(rows);

    if (!error) {
      await get().fetchMembers(groupId);
      set((s) => ({
        groups: s.groups.map((g) =>
          g.id === groupId ? { ...g, memberCount: (g.memberCount ?? 0) + newIds.length } : g
        ),
      }));
    }
  },

  removeMember: async (memberId) => {
    const member = get().members.find((m) => m.id === memberId);
    const { error } = await supabase.from("group_members").delete().eq("id", memberId);
    if (!error) {
      set((s) => ({
        members: s.members.filter((m) => m.id !== memberId),
        groups: member
          ? s.groups.map((g) =>
              g.id === member.groupId ? { ...g, memberCount: Math.max(0, (g.memberCount ?? 1) - 1) } : g
            )
          : s.groups,
      }));
    }
  },
}));
