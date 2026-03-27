"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, Plus, Trash2, Loader2, Save, Search, UserPlus, Upload, AlertTriangle } from "lucide-react";
import { useGroupStore, type Group } from "@/store/groups";
import { useLeadStore } from "@/store/leads";
import ImportLeadsCsvModal from "@/components/ImportLeadsCsvModal";
import { clusterByDomain } from "@/lib/domain";

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
  const leads = useLeadStore((s) => s.leads);
  const fetchLeads = useLeadStore((s) => s.fetchLeads);

  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [groupId, setGroupId] = useState<string | null>(group?.id ?? null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    if (group?.id) {
      fetchMembers(group.id);
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

  const filteredLeads = leads.filter((lead) => {
    if (memberLeadIds.has(lead.id)) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      lead.firstName.toLowerCase().includes(q) ||
      lead.lastName.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.company.toLowerCase().includes(q)
    );
  });

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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative z-10 flex h-full w-full max-w-[640px] flex-col bg-surface shadow-lg animate-slide-in">
        {/* Header */}
        <div className="border-b border-edge px-8 py-6">
          <div className="flex items-start justify-between">
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
            <div className="flex items-center gap-2 ml-4 shrink-0">
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
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
                  </div>

                  {showDropdown && filteredLeads.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 flex max-h-[280px] flex-col rounded-[10px] border border-edge bg-surface shadow-md">
                      <div className="flex-1 overflow-y-auto">
                        {filteredLeads.slice(0, 20).map((lead) => {
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
                  <div className="overflow-hidden rounded-[12px] border border-edge">
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
                        {members.map((member) => {
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
                                  onClick={() => removeMember(member.id)}
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
    </div>
  );
}
