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
  leadJobTitle?: string;
  leadLinkedIn?: string;
  leadNotes?: string;
  leadStatus?: string;
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
    job_title: string | null;
    linked_in: string | null;
    notes: string | null;
    status: string | null;
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
    leadJobTitle: row.leads?.job_title ?? undefined,
    leadLinkedIn: row.leads?.linked_in ?? undefined,
    leadNotes: row.leads?.notes ?? undefined,
    leadStatus: row.leads?.status ?? undefined,
  };
}

async function fetchAllGroupMemberRows(groupId: string): Promise<MemberWithLeadRow[]> {
  const rows: MemberWithLeadRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("group_members")
      .select("*, leads(first_name, last_name, email, company, job_title, linked_in, notes, status)")
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
  membersLoading: boolean;

  fetchGroups: () => Promise<void>;
  fetchGroup: (id: string) => Promise<Group | null>;
  createGroup: (name: string, description?: string) => Promise<Group | null>;
  updateGroup: (id: string, updates: Partial<Pick<Group, "name" | "description">>) => Promise<boolean>;
  deleteGroup: (id: string) => Promise<boolean>;
  deleteGroups: (ids: string[]) => Promise<{ deleted: number; failed: number }>;

  fetchMembers: (groupId: string) => Promise<void>;
  addMembers: (groupId: string, leadIds: string[]) => Promise<boolean>;
  removeMember: (memberId: string) => Promise<boolean>;
  removeMembers: (memberIds: string[]) => Promise<{ removed: number; failed: number }>;
  patchMemberLead: (leadId: string, updates: Partial<Pick<GroupMember, "leadName" | "leadEmail" | "leadCompany" | "leadJobTitle" | "leadLinkedIn" | "leadNotes" | "leadStatus">>) => void;
}

export const useGroupStore = create<GroupState>((set, get) => ({
  groups: [],
  members: [],
  loading: false,
  membersLoading: false,

  fetchGroups: async () => {
    const uid = getUserId();
    if (!uid) { set({ groups: [], loading: false }); return; }

    set({ loading: true });

    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error || !data) { set({ loading: false }); return; }

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

  fetchGroup: async (id) => {
    const uid = getUserId();
    if (!uid) return null;

    const cached = get().groups.find((g) => g.id === id);
    if (cached) return cached;

    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle();

    if (error || !data) return null;

    const group = { ...rowToGroup(data as GroupRow), memberCount: 0 };
    const { count } = await supabase
      .from("group_members")
      .select("id", { count: "exact", head: true })
      .eq("group_id", id);
    group.memberCount = count ?? 0;

    set((s) => ({
      groups: s.groups.some((g) => g.id === id) ? s.groups : [group, ...s.groups],
    }));
    return group;
  },

  createGroup: async (name, description = "") => {
    const uid = getUserId();
    if (!uid) return null;

    const { data, error } = await supabase
      .from("groups")
      .insert({ user_id: uid, name: name.trim(), description: description.trim() })
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
    if (updates.name !== undefined) dbUpdates.name = updates.name.trim();
    if (updates.description !== undefined) dbUpdates.description = updates.description.trim();

    const { error } = await supabase.from("groups").update(dbUpdates).eq("id", id);
    if (!error) {
      const next = {
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.description !== undefined ? { description: updates.description.trim() } : {}),
        updatedAt: new Date().toISOString(),
      };
      set((s) => ({
        groups: s.groups.map((g) => g.id === id ? { ...g, ...next } : g),
      }));
      return true;
    }
    return false;
  },

  deleteGroup: async (id) => {
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (!error) {
      set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
      return true;
    }
    return false;
  },

  deleteGroups: async (ids) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return { deleted: 0, failed: 0 };

    const { error } = await supabase.from("groups").delete().in("id", unique);
    if (!error) {
      const removed = new Set(unique);
      set((s) => ({ groups: s.groups.filter((g) => !removed.has(g.id)) }));
      return { deleted: unique.length, failed: 0 };
    }

    // Fallback: delete one-by-one if bulk delete fails
    let deleted = 0;
    for (const id of unique) {
      if (await get().deleteGroup(id)) deleted++;
    }
    return { deleted, failed: unique.length - deleted };
  },

  fetchMembers: async (groupId) => {
    set({ membersLoading: true, members: [] });
    const rows = await fetchAllGroupMemberRows(groupId);
    const members = rows.map(rowToMemberWithLead);

    set((s) => ({
      members,
      membersLoading: false,
      groups: s.groups.map((g) =>
        g.id === groupId ? { ...g, memberCount: members.length } : g
      ),
    }));
  },

  addMembers: async (groupId, leadIds) => {
    if (leadIds.length === 0) return true;

    const existing = await fetchAllGroupLeadIds(groupId);
    const newIds = leadIds.filter((id) => !existing.includes(id));
    if (newIds.length === 0) return true;

    const rows = newIds.map((leadId) => ({ group_id: groupId, lead_id: leadId }));
    const chunks = chunkArray(rows, SUPABASE_WRITE_CHUNK_SIZE);

    for (const chunk of chunks) {
      const { error } = await supabase.from("group_members").insert(chunk);
      if (error) return false;
    }

    await get().fetchMembers(groupId);
    return true;
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
      return true;
    }
    return false;
  },

  removeMembers: async (memberIds) => {
    const unique = [...new Set(memberIds.filter(Boolean))];
    if (unique.length === 0) return { removed: 0, failed: 0 };

    const toRemove = get().members.filter((m) => unique.includes(m.id));
    const groupId = toRemove[0]?.groupId;
    const { error } = await supabase.from("group_members").delete().in("id", unique);

    if (!error) {
      const removedSet = new Set(unique);
      set((s) => ({
        members: s.members.filter((m) => !removedSet.has(m.id)),
        groups: groupId
          ? s.groups.map((g) =>
              g.id === groupId
                ? { ...g, memberCount: Math.max(0, (g.memberCount ?? unique.length) - unique.length) }
                : g
            )
          : s.groups,
      }));
      return { removed: unique.length, failed: 0 };
    }

    let removed = 0;
    for (const id of unique) {
      if (await get().removeMember(id)) removed++;
    }
    return { removed, failed: unique.length - removed };
  },

  patchMemberLead: (leadId, updates) => {
    set((s) => ({
      members: s.members.map((m) =>
        m.leadId === leadId ? { ...m, ...updates } : m
      ),
    }));
  },
}));
