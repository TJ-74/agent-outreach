import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { chunkArray, SUPABASE_PAGE_SIZE, SUPABASE_WRITE_CHUNK_SIZE } from "@/lib/batch";

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

type MemberWithLeadRow = MemberRow & {
  leads: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    company: string | null;
  } | null;
};

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

function rowToMemberWithLead(row: MemberWithLeadRow): GroupMember {
  const firstName = row.leads?.first_name ?? "";
  const lastName = row.leads?.last_name ?? "";
  const leadName = `${firstName} ${lastName}`.trim();

  return {
    ...rowToMember(row),
    leadName: leadName || undefined,
    leadEmail: row.leads?.email ?? undefined,
    leadCompany: row.leads?.company ?? undefined,
  };
}

async function fetchAllGroupMemberRows(groupId: string): Promise<MemberWithLeadRow[]> {
  const rows: MemberWithLeadRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("group_members")
      .select("*, leads(first_name, last_name, email, company)")
      .eq("group_id", groupId)
      .order("added_at", { ascending: false })
      .range(from, to);

    if (error || !data) break;
    rows.push(...(data as MemberWithLeadRow[]));
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllGroupLeadIds(groupId: string): Promise<string[]> {
  const leadIds: string[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("group_members")
      .select("lead_id")
      .eq("group_id", groupId)
      .range(from, to);

    if (error || !data) break;
    leadIds.push(...data.map((row) => row.lead_id));
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }

  return leadIds;
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

    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const { count } = await supabase
          .from("group_members")
          .select("id", { count: "exact", head: true })
          .eq("group_id", group.id);

        return { ...group, memberCount: count ?? 0 };
      })
    );

    set({ groups: groupsWithCounts, loading: false });
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
    const rows = await fetchAllGroupMemberRows(groupId);
    const members = rows.map(rowToMemberWithLead);

    set((s) => ({
      members,
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, memberCount: members.length } : g
      ),
    }));
  },

  addMembers: async (groupId, leadIds) => {
    if (leadIds.length === 0) return;

    const existing = await fetchAllGroupLeadIds(groupId);
    const newIds = leadIds.filter((id) => !existing.includes(id));
    if (newIds.length === 0) return;

    const rows = newIds.map((leadId) => ({ group_id: groupId, lead_id: leadId }));
    const chunks = chunkArray(rows, SUPABASE_WRITE_CHUNK_SIZE);

    for (const chunk of chunks) {
      const { error } = await supabase.from("group_members").insert(chunk);
      if (error) return;
    }

    await get().fetchMembers(groupId);
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
