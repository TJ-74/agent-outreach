"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  Search,
  UserPlus,
  Upload,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
} from "lucide-react";
import { useGroupStore, type Group } from "@/store/groups";
import type { GroupMember } from "@/store/groups";
import { useLeadStore, type Lead } from "@/store/leads";
import ImportLeadsCsvModal from "@/components/ImportLeadsCsvModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import EditLeadModal from "@/components/EditLeadModal";
import { clusterByDomain } from "@/lib/domain";
import clsx from "clsx";

const MEMBERS_PAGE_SIZE = 20;

interface Props {
  group: Group | null;
  isNew?: boolean;
  onClose: () => void;
  /** "panel" = slide-over drawer (default), "page" = full page, no overlay/backdrop */
  variant?: "panel" | "page";
}

function memberToLeadStub(member: GroupMember): Lead {
  const parts = (member.leadName ?? "").trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return {
    id: member.leadId,
    firstName,
    lastName,
    email: member.leadEmail ?? "",
    company: member.leadCompany ?? "",
    jobTitle: member.leadJobTitle ?? "",
    linkedIn: member.leadLinkedIn ?? "",
    status: (member.leadStatus as Lead["status"]) || "new",
    notes: member.leadNotes ?? "",
    createdAt: member.addedAt,
    updatedAt: member.addedAt,
    engagementScore: 0,
    sentiment: "unknown",
    aiSummary: "",
    nextAction: "",
    nextActionType: "",
    nextActionAt: null,
    lastContactedAt: null,
    lastRepliedAt: null,
    tags: [],
    research: "",
    actionNeeded: "none",
  };
}

export default function GroupDetailPanel({ group, isNew, onClose, variant = "panel" }: Props) {
  const router = useRouter();
  const {
    members,
    membersLoading,
    fetchMembers,
    addMembers,
    removeMember,
    removeMembers,
    createGroup,
    updateGroup,
    patchMemberLead,
  } = useGroupStore();
  const searchAllLeads = useLeadStore((s) => s.searchAllLeads);
  const getLeadById = useLeadStore((s) => s.getLeadById);

  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(group?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const [memberFilter, setMemberFilter] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (group?.id) {
      setGroupId(group.id);
      setName(group.name);
      setDescription(group.description);
      fetchMembers(group.id);
      setMembersPage(1);
      setMemberFilter("");
      setSelectedMemberIds(new Set());
    }
  }, [group?.id, group?.name, group?.description, fetchMembers]);

  useEffect(() => {
    setSelectedMemberIds((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set(members.map((m) => m.id));
      const next = new Set([...prev].filter((id) => valid.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [members]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      const results = await searchAllLeads(searchQuery);
      setSearchResults(results);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, showDropdown, searchAllLeads]);

  useEffect(() => {
    if (!savedFlash) return;
    const t = setTimeout(() => setSavedFlash(false), 2000);
    return () => clearTimeout(t);
  }, [savedFlash]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    if (isNew && !groupId) {
      const created = await createGroup(name, description);
      setSaving(false);
      if (!created) {
        setError("Could not create group. Check that you're signed in and try again.");
        return;
      }
      setGroupId(created.id);
      setSavedFlash(true);
      if (variant === "page") {
        router.replace(`/groups/${created.id}`);
      }
      return;
    }

    if (groupId) {
      const ok = await updateGroup(groupId, { name, description });
      setSaving(false);
      if (!ok) {
        setError("Could not save group changes. Try again.");
        return;
      }
      setSavedFlash(true);
      return;
    }

    setSaving(false);
  };

  const memberLeadIds = useMemo(() => new Set(members.map((m) => m.leadId)), [members]);

  const domainClusters = useMemo(
    () => clusterByDomain(members, (m) => m.leadEmail),
    [members],
  );
  const orgClusters = domainClusters.filter((c) => !c.isFree);

  const filteredMembers = useMemo(() => {
    const q = memberFilter.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.leadName, m.leadEmail, m.leadCompany, m.leadJobTitle]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [members, memberFilter]);

  const totalMemberPages = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PAGE_SIZE));
  const paginatedMembers = useMemo(() => {
    const start = (membersPage - 1) * MEMBERS_PAGE_SIZE;
    return filteredMembers.slice(start, start + MEMBERS_PAGE_SIZE);
  }, [filteredMembers, membersPage]);
  const memberRangeStart = filteredMembers.length === 0 ? 0 : (membersPage - 1) * MEMBERS_PAGE_SIZE + 1;
  const memberRangeEnd = Math.min(membersPage * MEMBERS_PAGE_SIZE, filteredMembers.length);

  useEffect(() => {
    if (membersPage > totalMemberPages) setMembersPage(totalMemberPages);
  }, [membersPage, totalMemberPages]);

  useEffect(() => {
    setMembersPage(1);
  }, [memberFilter]);

  const goToMembersPage = (p: number) =>
    setMembersPage(Math.max(1, Math.min(totalMemberPages, p)));

  const filteredLeads = searchResults.filter((lead) => !memberLeadIds.has(lead.id));

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  const handleAddSelected = async () => {
    if (!groupId || selectedLeadIds.length === 0) return;
    setAdding(true);
    setError(null);
    const ok = await addMembers(groupId, selectedLeadIds);
    setAdding(false);
    if (!ok) {
      setError("Could not add leads to the group. Try again.");
      return;
    }
    setSelectedLeadIds([]);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleImported = async (leadIds: string[]) => {
    if (!groupId || leadIds.length === 0) return;
    setError(null);
    const ok = await addMembers(groupId, leadIds);
    if (!ok) setError("Imported leads were created, but some could not be added to this group.");
  };

  const filteredMemberIds = useMemo(() => filteredMembers.map((m) => m.id), [filteredMembers]);
  const allFilteredSelected =
    filteredMemberIds.length > 0 && filteredMemberIds.every((id) => selectedMemberIds.has(id));
  const allMembersSelected = members.length > 0 && selectedMemberIds.size === members.length;

  const toggleMemberSelected = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const selectAllMembers = () => setSelectedMemberIds(new Set(members.map((m) => m.id)));
  const selectAllFiltered = () => setSelectedMemberIds(new Set(filteredMemberIds));
  const clearMemberSelection = () => setSelectedMemberIds(new Set());

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    setError(null);
    const ok = await removeMember(memberToRemove.id);
    setRemovingMember(false);
    if (!ok) {
      setError("Could not remove lead from group. Try again.");
      return;
    }
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(memberToRemove.id);
      return next;
    });
    setMemberToRemove(null);
  };

  const confirmBulkRemove = async () => {
    const ids = [...selectedMemberIds];
    if (ids.length === 0) return;
    setRemovingMember(true);
    setError(null);
    const { removed, failed } = await removeMembers(ids);
    setRemovingMember(false);
    if (failed > 0) {
      setError(
        removed > 0
          ? `Removed ${removed} lead${removed !== 1 ? "s" : ""}, but ${failed} failed.`
          : "Could not remove the selected leads. Try again.",
      );
    }
    setSelectedMemberIds(new Set());
    setBulkRemoveOpen(false);
  };

  const SelectionCheck = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: () => void;
    label: string;
  }) => (
    <button
      type="button"
      onClick={onChange}
      aria-label={label}
      aria-pressed={checked}
      className={clsx(
        "flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-[1.5px] transition-colors",
        checked ? "border-copper bg-copper" : "border-edge-strong bg-surface hover:border-copper",
      )}
    >
      {checked && (
        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );

  const openEditLead = async (member: GroupMember) => {
    setLoadingEditId(member.leadId);
    setError(null);
    const lead = (await getLeadById(member.leadId)) ?? memberToLeadStub(member);
    setLoadingEditId(null);
    setEditLead(lead);
  };

  const handleLeadSaved = (updated: Lead) => {
    patchMemberLead(updated.id, {
      leadName: `${updated.firstName} ${updated.lastName}`.trim() || undefined,
      leadEmail: updated.email,
      leadCompany: updated.company || undefined,
      leadJobTitle: updated.jobTitle || undefined,
      leadLinkedIn: updated.linkedIn || undefined,
      leadNotes: updated.notes || undefined,
      leadStatus: updated.status,
    });
  };

  const renderMemberCard = (member: GroupMember) => {
    const domain = member.leadEmail?.split("@")[1]?.toLowerCase();
    const cluster = domain ? orgClusters.find((c) => c.domain === domain) : undefined;
    const editing = loadingEditId === member.leadId;
    const selected = selectedMemberIds.has(member.id);
    return (
      <div
        key={member.id}
        className={clsx(
          "rounded-[12px] border bg-surface p-3.5 shadow-xs",
          selected ? "border-copper ring-[2px] ring-copper-light" : "border-edge",
          cluster && !selected && "border-amber/20 bg-amber-light/10",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <div className="mt-0.5">
              <SelectionCheck
                checked={selected}
                onChange={() => toggleMemberSelected(member.id)}
                label={selected ? "Deselect lead" : "Select lead"}
              />
            </div>
            <button
              type="button"
              onClick={() => openEditLead(member)}
              className="min-w-0 flex-1 cursor-pointer text-left"
            >
              <p className="truncate text-[13px] font-semibold text-ink">{member.leadName || "—"}</p>
              <p className="mt-0.5 truncate text-[12px] text-ink-mid">{member.leadEmail || "—"}</p>
              {(member.leadCompany || member.leadJobTitle) && (
                <p className="mt-1 truncate text-[11px] text-ink-light">
                  {[member.leadJobTitle, member.leadCompany].filter(Boolean).join(" · ")}
                </p>
              )}
              {cluster && (
                <span className="mt-2 inline-flex items-center rounded-full bg-amber-light px-2 py-[2px] text-[10px] font-bold text-amber">
                  {cluster.count} in org
                </span>
              )}
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => openEditLead(member)}
              disabled={editing}
              className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream-deep hover:text-ink disabled:opacity-50"
              aria-label="Edit lead"
            >
              {editing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setMemberToRemove(member)}
              className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
              aria-label="Remove member"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const isPage = variant === "page";

  return (
    <div
      className={clsx(
        isPage
          ? "mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-12"
          : "fixed inset-x-0 top-[52px] bottom-16 z-50 flex justify-end sm:inset-0 sm:top-0 sm:bottom-0",
      )}
    >
      {!isPage && (
        <div className="absolute inset-0 hidden bg-black/30 backdrop-blur-[2px] sm:block" onClick={onClose} />
      )}

      <div
        className={clsx(
          "flex flex-col bg-surface",
          isPage
            ? "rounded-[16px] border border-edge shadow-xs"
            : "relative z-10 h-full w-full shadow-lg animate-slide-in sm:max-w-[640px]",
        )}
      >
        {/* Mobile header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-edge px-4 py-3 sm:hidden">
          <button
            onClick={onClose}
            className="cursor-pointer rounded-full p-1.5 text-ink-mid transition-colors hover:bg-cream hover:text-ink"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
              {isNew && !groupId ? "New Group" : name || "Edit Group"}
            </p>
            {groupId && (
              <p className="text-[11px] text-ink-mid">{members.length} member{members.length !== 1 ? "s" : ""}</p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-copper px-3 py-[7px] text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedFlash ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
            {savedFlash ? "Saved" : "Save"}
          </button>
        </div>

        {/* Desktop header */}
        <div className="hidden border-b border-edge px-8 py-6 sm:block">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null); }}
                placeholder="Group name..."
                className="w-full bg-transparent font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.02em] text-ink placeholder:text-ink-light outline-none"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description..."
                className="mt-1.5 w-full bg-transparent text-[13px] text-ink-mid placeholder:text-ink-light outline-none"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={onClose}
                className="cursor-pointer rounded-[8px] border border-edge px-3.5 py-[7px] text-[12px] font-semibold text-ink-mid transition-all hover:bg-cream hover:text-ink"
              >
                {isPage ? "Back" : "Cancel"}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-copper px-3.5 py-[7px] text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedFlash ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {savedFlash ? "Saved" : "Save"}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile name/description fields */}
        <div className="border-b border-edge px-4 py-4 sm:hidden">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="Group name..."
            className="w-full bg-transparent font-[family-name:var(--font-display)] text-[18px] font-bold tracking-[-0.02em] text-ink placeholder:text-ink-light outline-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            className="mt-1.5 w-full bg-transparent text-[13px] text-ink-mid placeholder:text-ink-light outline-none"
          />
        </div>

        {error && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-[10px] border border-rose/30 bg-rose-light/40 px-3.5 py-2.5 sm:mx-8">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose" />
            <p className="flex-1 text-[12px] text-ink-mid">{error}</p>
            <button
              onClick={() => setError(null)}
              className="cursor-pointer text-[11px] font-semibold text-ink-light hover:text-ink"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
          {!groupId ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="rounded-[14px] bg-cream-deep p-5">
                <UserPlus className="h-7 w-7 text-ink-light" />
              </div>
              <p className="mt-5 font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                Save to add members
              </p>
              <p className="mt-1 text-center text-[13px] text-ink-mid">
                Enter a name and save the group first, then add and edit leads.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Add members */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                  Add Leads
                </p>
                <button
                  onClick={() => setImportOpen(true)}
                  className="mb-3 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-edge px-3 py-[6px] text-[12px] font-semibold text-ink-mid transition-all hover:bg-cream hover:text-ink"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Import CSV to Group
                </button>
                <div ref={searchRef} className="relative">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-light" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                      onFocus={() => setShowDropdown(true)}
                      placeholder="Search leads by name, email, or company..."
                      className="w-full rounded-[10px] border border-edge bg-surface py-[9px] pl-9 pr-4 text-[13px] text-ink placeholder:text-ink-light outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
                    />
                    {searching && (
                      <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-ink-light" />
                    )}
                  </div>

                  {showDropdown && (filteredLeads.length > 0 || searching) && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 flex max-h-[280px] flex-col rounded-[10px] border border-edge bg-surface shadow-md">
                      <div className="flex-1 overflow-y-auto">
                        {searching && filteredLeads.length === 0 ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-[12px] text-ink-mid">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Searching leads...
                          </div>
                        ) : null}
                        {filteredLeads.map((lead) => {
                          const isSelected = selectedLeadIds.includes(lead.id);
                          return (
                            <button
                              key={lead.id}
                              onClick={() => toggleLeadSelection(lead.id)}
                              className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                isSelected ? "bg-copper-light" : "hover:bg-cream"
                              }`}
                            >
                              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border-[1.5px] ${
                                isSelected ? "border-copper bg-copper" : "border-edge-strong"
                              }`}>
                                {isSelected && (
                                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] font-semibold text-ink">
                                  {lead.firstName} {lead.lastName}
                                </p>
                                <p className="truncate text-[11px] text-ink-mid">
                                  {lead.email}{lead.company ? ` · ${lead.company}` : ""}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {selectedLeadIds.length > 0 && (
                        <div className="flex items-center gap-2 border-t border-edge bg-cream/60 px-4 py-2.5">
                          <span className="flex-1 text-[12px] font-medium text-ink-mid">
                            {selectedLeadIds.length} selected
                          </span>
                          <button
                            onClick={() => setSelectedLeadIds([])}
                            className="cursor-pointer text-[11px] font-medium text-ink-light hover:text-ink-mid"
                          >
                            Clear
                          </button>
                          <button
                            onClick={handleAddSelected}
                            disabled={adding}
                            className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-sage px-3 py-[5px] text-[12px] font-semibold text-white transition-all hover:bg-sage/90 disabled:opacity-50"
                          >
                            {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            Add to Group
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!showDropdown && selectedLeadIds.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[12px] text-ink-mid">
                      {selectedLeadIds.length} lead{selectedLeadIds.length !== 1 ? "s" : ""} selected
                    </span>
                    <button
                      onClick={handleAddSelected}
                      disabled={adding}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-sage px-3 py-[5px] text-[12px] font-semibold text-white transition-all hover:bg-sage/90 disabled:opacity-50"
                    >
                      {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Add to Group
                    </button>
                    <button
                      onClick={() => setSelectedLeadIds([])}
                      className="cursor-pointer text-[11px] font-medium text-ink-light hover:text-ink-mid"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Member list */}
              <div>
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                    Members ({members.length})
                    {memberFilter.trim() && filteredMembers.length !== members.length
                      ? ` · ${filteredMembers.length} match`
                      : ""}
                  </p>
                  {members.length > 0 && (
                    <div className="relative w-full sm:max-w-[240px]">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-light" />
                      <input
                        type="text"
                        value={memberFilter}
                        onChange={(e) => setMemberFilter(e.target.value)}
                        placeholder="Filter members..."
                        className="w-full rounded-[8px] border border-edge bg-surface py-[6px] pl-8 pr-3 text-[12px] text-ink placeholder:text-ink-light outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light"
                      />
                    </div>
                  )}
                </div>

                {members.length > 0 && !membersLoading && (
                  <div className="mb-3 flex flex-col gap-2 rounded-[10px] border border-edge bg-cream/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <SelectionCheck
                        checked={allFilteredSelected}
                        onChange={() => {
                          if (allFilteredSelected) clearMemberSelection();
                          else if (memberFilter.trim()) selectAllFiltered();
                          else selectAllMembers();
                        }}
                        label={allFilteredSelected ? "Clear selection" : "Select all"}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (allMembersSelected) clearMemberSelection();
                          else selectAllMembers();
                        }}
                        className="cursor-pointer text-[12px] font-semibold text-ink-mid transition-colors hover:text-ink"
                      >
                        {allMembersSelected ? "Clear selection" : "Select all"}
                      </button>
                      {selectedMemberIds.size > 0 && (
                        <span className="text-[12px] text-ink-light">
                          {selectedMemberIds.size} selected
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkRemoveOpen(true)}
                      disabled={selectedMemberIds.size === 0}
                      className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-rose px-3 py-[6px] text-[12px] font-semibold text-white transition-all hover:bg-rose/90 disabled:cursor-default disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {allMembersSelected && selectedMemberIds.size > 0
                        ? "Remove all"
                        : `Remove selected${selectedMemberIds.size > 0 ? ` (${selectedMemberIds.size})` : ""}`}
                    </button>
                  </div>
                )}

                {orgClusters.length > 0 && (
                  <div className="mb-3 rounded-[10px] border border-amber/30 bg-amber-light/30 px-3.5 py-2.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
                      <div>
                        <p className="text-[12px] font-semibold text-amber">
                          Same-organization contacts detected
                        </p>
                        <p className="mt-0.5 text-[11px] leading-[1.5] text-ink-mid">
                          Sending similar outreach to multiple people at the same company can look spammy.
                          Consider personalising messages or staggering sends.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {orgClusters.map((c) => (
                            <span
                              key={c.domain}
                              className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-surface px-2 py-[2px] text-[11px] font-medium text-ink-mid"
                            >
                              <span className="font-semibold text-amber">{c.count}</span>
                              @{c.domain}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {membersLoading ? (
                  <div className="flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-edge-strong py-12 text-[13px] text-ink-mid">
                    <Loader2 className="h-4 w-4 animate-spin text-copper" />
                    Loading members…
                  </div>
                ) : members.length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-edge-strong py-10 text-center">
                    <p className="text-[13px] text-ink-mid">No members yet. Search and add leads above.</p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-edge-strong py-10 text-center">
                    <p className="text-[13px] text-ink-mid">No members match “{memberFilter.trim()}”.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5 sm:hidden">
                      {paginatedMembers.map(renderMemberCard)}
                    </div>
                    <div className="hidden overflow-hidden rounded-[12px] border border-edge sm:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-edge bg-cream">
                            <th className="w-10 px-3 py-2.5">
                              <SelectionCheck
                                checked={allFilteredSelected}
                                onChange={() => {
                                  if (allFilteredSelected) clearMemberSelection();
                                  else if (memberFilter.trim()) selectAllFiltered();
                                  else selectAllMembers();
                                }}
                                label={allFilteredSelected ? "Clear selection" : "Select all"}
                              />
                            </th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Name</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Email</th>
                            <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light lg:table-cell">Title</th>
                            <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light sm:table-cell">Company</th>
                            <th className="w-20 px-4 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-edge">
                          {paginatedMembers.map((member) => {
                            const domain = member.leadEmail?.split("@")[1]?.toLowerCase();
                            const cluster = domain ? orgClusters.find((c) => c.domain === domain) : undefined;
                            const editing = loadingEditId === member.leadId;
                            const selected = selectedMemberIds.has(member.id);
                            return (
                              <tr
                                key={member.id}
                                className={clsx(
                                  "transition-colors hover:bg-cream/60",
                                  selected && "bg-copper-light/40",
                                  cluster && !selected && "bg-amber-light/10",
                                )}
                              >
                                <td className="px-3 py-2.5">
                                  <SelectionCheck
                                    checked={selected}
                                    onChange={() => toggleMemberSelected(member.id)}
                                    label={selected ? "Deselect lead" : "Select lead"}
                                  />
                                </td>
                                <td className="px-4 py-2.5">
                                  <button
                                    type="button"
                                    onClick={() => openEditLead(member)}
                                    className="cursor-pointer text-left text-[12px] font-semibold text-ink hover:text-copper"
                                  >
                                    {member.leadName || "—"}
                                  </button>
                                </td>
                                <td className="px-4 py-2.5 text-[12px] text-ink-mid">
                                  <span>{member.leadEmail || "—"}</span>
                                  {cluster && (
                                    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-light px-1.5 py-[1px] text-[9px] font-bold text-amber">
                                      {cluster.count} in org
                                    </span>
                                  )}
                                </td>
                                <td className="hidden px-4 py-2.5 text-[12px] text-ink-mid lg:table-cell">
                                  {member.leadJobTitle || "—"}
                                </td>
                                <td className="hidden px-4 py-2.5 text-[12px] text-ink-mid sm:table-cell">
                                  {member.leadCompany || "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="inline-flex items-center gap-0.5">
                                    <button
                                      onClick={() => openEditLead(member)}
                                      disabled={editing}
                                      className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-cream-deep hover:text-ink disabled:opacity-50"
                                      aria-label="Edit lead"
                                      title="Edit lead"
                                    >
                                      {editing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                      onClick={() => setMemberToRemove(member)}
                                      className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                                      aria-label="Remove from group"
                                      title="Remove from group"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {!membersLoading && filteredMembers.length > MEMBERS_PAGE_SIZE && (
                  <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-edge bg-cream/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-ink-mid">
                      Showing <span className="font-semibold text-ink">{memberRangeStart}–{memberRangeEnd}</span> of{" "}
                      <span className="font-semibold text-ink">{filteredMembers.length}</span>
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => goToMembersPage(membersPage - 1)}
                        disabled={membersPage <= 1}
                        className="cursor-pointer rounded-[8px] p-[6px] text-ink-mid transition-colors hover:bg-surface hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {Array.from({ length: totalMemberPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalMemberPages || Math.abs(p - membersPage) <= 1)
                        .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === "ellipsis" ? (
                            <span key={`e${idx}`} className="px-1 text-[11px] text-ink-light">…</span>
                          ) : (
                            <button
                              key={item}
                              onClick={() => goToMembersPage(item)}
                              className={clsx(
                                "cursor-pointer rounded-[8px] px-2 py-[4px] text-[11px] font-semibold transition-colors",
                                membersPage === item
                                  ? "bg-copper text-white shadow-xs"
                                  : "text-ink-mid hover:bg-surface hover:text-ink",
                              )}
                            >
                              {item}
                            </button>
                          ),
                        )}
                      <button
                        onClick={() => goToMembersPage(membersPage + 1)}
                        disabled={membersPage >= totalMemberPages}
                        className="cursor-pointer rounded-[8px] p-[6px] text-ink-mid transition-colors hover:bg-surface hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {groupId && (
        <ImportLeadsCsvModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          title="Import Leads to This Group"
          onImportedLeadIds={handleImported}
        />
      )}
      <ConfirmDeleteModal
        open={!!memberToRemove}
        title="Remove lead from group?"
        description={`Remove ${memberToRemove?.leadName || memberToRemove?.leadEmail || "this lead"} from this group? The lead itself will not be deleted.`}
        confirmLabel="Remove"
        loading={removingMember}
        onConfirm={confirmRemoveMember}
        onClose={() => setMemberToRemove(null)}
      />
      <ConfirmDeleteModal
        open={bulkRemoveOpen}
        title={allMembersSelected ? "Remove all leads from group?" : "Remove selected leads?"}
        description={
          allMembersSelected
            ? `Remove all ${selectedMemberIds.size} leads from this group? The leads themselves will not be deleted.`
            : `Remove ${selectedMemberIds.size} selected lead${selectedMemberIds.size !== 1 ? "s" : ""} from this group? The leads themselves will not be deleted.`
        }
        confirmLabel={allMembersSelected ? "Remove all" : "Remove selected"}
        loading={removingMember}
        onConfirm={confirmBulkRemove}
        onClose={() => setBulkRemoveOpen(false)}
      />
      <EditLeadModal
        lead={editLead}
        onClose={() => setEditLead(null)}
        onSaved={handleLeadSaved}
      />
    </div>
  );
}
