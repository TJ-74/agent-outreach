"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Trash2, Loader2, Save, Search, UserPlus, Upload, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useGroupStore, type Group } from "@/store/groups";
import type { GroupMember } from "@/store/groups";
import { useLeadStore, type Lead } from "@/store/leads";
import ImportLeadsCsvModal from "@/components/ImportLeadsCsvModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { clusterByDomain } from "@/lib/domain";
import clsx from "clsx";

const MEMBERS_PAGE_SIZE = 20;

interface Props {
  group: Group | null;
  isNew?: boolean;
  onClose: () => void;
}

export default function GroupDetailPanel({ group, isNew, onClose }: Props) {
  const {
    members,
    fetchMembers,
    addMembers,
    removeMember,
    createGroup,
    updateGroup,
  } = useGroupStore();
  const searchAllLeads = useLeadStore((s) => s.searchAllLeads);

  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(group?.id ?? null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (group?.id) {
      fetchMembers(group.id);
      setMembersPage(1);
    }
  }, [group?.id, fetchMembers]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search against full leads database
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

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);

    if (isNew && !groupId) {
      const created = await createGroup(name, description);
      if (created) setGroupId(created.id);
    } else if (groupId) {
      await updateGroup(groupId, { name, description });
    }

    setSaving(false);
    onClose();
  };

  const memberLeadIds = new Set(members.map((m) => m.leadId));

  const domainClusters = useMemo(
    () => clusterByDomain(members, (m) => m.leadEmail),
    [members],
  );
  const orgClusters = domainClusters.filter((c) => !c.isFree);

  const totalMemberPages = Math.max(1, Math.ceil(members.length / MEMBERS_PAGE_SIZE));
  const paginatedMembers = useMemo(() => {
    const start = (membersPage - 1) * MEMBERS_PAGE_SIZE;
    return members.slice(start, start + MEMBERS_PAGE_SIZE);
  }, [members, membersPage]);
  const memberRangeStart = members.length === 0 ? 0 : (membersPage - 1) * MEMBERS_PAGE_SIZE + 1;
  const memberRangeEnd = Math.min(membersPage * MEMBERS_PAGE_SIZE, members.length);

  useEffect(() => {
    if (membersPage > totalMemberPages) setMembersPage(totalMemberPages);
  }, [membersPage, totalMemberPages]);

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
    await addMembers(groupId, selectedLeadIds);
    setSelectedLeadIds([]);
    setSearchQuery("");
    setShowDropdown(false);
    setAdding(false);
  };

  const handleImported = async (leadIds: string[]) => {
    if (!groupId || leadIds.length === 0) return;
    await addMembers(groupId, leadIds);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    await removeMember(memberToRemove.id);
    setRemovingMember(false);
    setMemberToRemove(null);
  };

  const renderMemberCard = (member: GroupMember) => {
    const domain = member.leadEmail?.split("@")[1]?.toLowerCase();
    const cluster = domain ? orgClusters.find((c) => c.domain === domain) : undefined;
    return (
      <div
        key={member.id}
        className={clsx(
          "rounded-[12px] border border-edge bg-surface p-3.5 shadow-xs",
          cluster && "border-amber/20 bg-amber-light/10",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{member.leadName || "—"}</p>
            <p className="mt-0.5 truncate text-[12px] text-ink-mid">{member.leadEmail || "—"}</p>
            {member.leadCompany && (
              <p className="mt-1 truncate text-[11px] text-ink-light">{member.leadCompany}</p>
            )}
            {cluster && (
              <span className="mt-2 inline-flex items-center rounded-full bg-amber-light px-2 py-[2px] text-[10px] font-bold text-amber">
                {cluster.count} in org
              </span>
            )}
          </div>
          <button
            onClick={() => setMemberToRemove(member)}
            className="cursor-pointer shrink-0 rounded-[8px] p-2 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
            aria-label="Remove member"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-x-0 top-[52px] bottom-16 z-50 flex justify-end sm:inset-0 sm:top-0 sm:bottom-0">
      <div className="absolute inset-0 hidden bg-black/30 backdrop-blur-[2px] sm:block" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full flex-col bg-surface shadow-lg animate-slide-in sm:max-w-[640px]">
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
              {isNew ? "New Group" : name || "Edit Group"}
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
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>

        {/* Desktop header */}
        <div className="hidden border-b border-edge px-8 py-6 sm:block">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] bg-copper px-3.5 py-[7px] text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Mobile name/description fields */}
        <div className="border-b border-edge px-4 py-4 sm:hidden">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
                Enter a name and save the group first, then add leads.
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
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                  Members ({members.length})
                </p>

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

                {members.length === 0 ? (
                  <div className="rounded-[12px] border border-dashed border-edge-strong py-10 text-center">
                    <p className="text-[13px] text-ink-mid">No members yet. Search and add leads above.</p>
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
                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Name</th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Email</th>
                            <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light sm:table-cell">Company</th>
                            <th className="w-10 px-4 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-edge">
                          {paginatedMembers.map((member) => {
                            const domain = member.leadEmail?.split("@")[1]?.toLowerCase();
                            const cluster = domain ? orgClusters.find((c) => c.domain === domain) : undefined;
                            return (
                              <tr key={member.id} className={`transition-colors hover:bg-cream/60 ${cluster ? "bg-amber-light/10" : ""}`}>
                                <td className="px-4 py-2.5 text-[12px] font-semibold text-ink">
                                  {member.leadName || "—"}
                                </td>
                                <td className="px-4 py-2.5 text-[12px] text-ink-mid">
                                  <span>{member.leadEmail || "—"}</span>
                                  {cluster && (
                                    <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-light px-1.5 py-[1px] text-[9px] font-bold text-amber">
                                      {cluster.count} in org
                                    </span>
                                  )}
                                </td>
                                <td className="hidden px-4 py-2.5 text-[12px] text-ink-mid sm:table-cell">
                                  {member.leadCompany || "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <button
                                    onClick={() => setMemberToRemove(member)}
                                    className="cursor-pointer rounded-[6px] p-1 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {members.length > MEMBERS_PAGE_SIZE && (
                  <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-edge bg-cream/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-ink-mid">
                      Showing <span className="font-semibold text-ink">{memberRangeStart}–{memberRangeEnd}</span> of{" "}
                      <span className="font-semibold text-ink">{members.length}</span>
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
        description={`Remove ${memberToRemove?.leadName || memberToRemove?.leadEmail || "this lead"} from this group?`}
        confirmLabel="Remove"
        loading={removingMember}
        onConfirm={confirmRemoveMember}
        onClose={() => setMemberToRemove(null)}
      />
    </div>
  );
}
