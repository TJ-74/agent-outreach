"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Plus, Trash2, ExternalLink, Users, Mail, Pencil, MessageSquare, FileText, Upload } from "lucide-react";
import { useLeadStore, type Lead, type ActionNeeded } from "@/store/leads";
import { useOutlookStore } from "@/store/outlook";
import { useGoogleStore } from "@/store/google";
import { useUnreadStore } from "@/store/unread";
import { useDraftStore } from "@/store/drafts";
import ActionBadge from "@/components/StatusBadge";
import CreateLeadModal from "@/components/CreateLeadModal";
import ImportLeadsCsvModal from "@/components/ImportLeadsCsvModal";
import EditLeadModal from "@/components/EditLeadModal";
import SendEmailModal from "@/components/SendEmailModal";
import LeadThreadPanel from "@/components/LeadThreadPanel";
import clsx from "clsx";

const tabs: { label: string; value: ActionNeeded | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Needs Reply", value: "needs_reply" },
  { label: "Waiting", value: "waiting_for_reply" },
  { label: "Needs Human", value: "needs_human" },
];

export default function LeadsPage() {
  const { leads, searchQuery, filterStatus, setSearch, setFilter, deleteLead, fetchLeads } =
    useLeadStore();
  const { checkConnection: checkOutlookConnection } = useOutlookStore();
  const { checkConnection: checkGoogleConnection } = useGoogleStore();
  const unreadByLead = useUnreadStore((s) => s.unreadByLead);
  const markRead = useUnreadStore((s) => s.markRead);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [emailLead, setEmailLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const selectedLead = selectedLeadId ? (leads.find((l) => l.id === selectedLeadId) ?? null) : null;
  const [generatingReplies, setGeneratingReplies] = useState(false);
  const [generateRepliesMessage, setGenerateRepliesMessage] = useState<string | null>(null);
  const fetchDrafts = useDraftStore((s) => s.fetchDrafts);
  const draftCountByLead = useDraftStore((s) => s.draftCountByLead);
  const fetchDraftCounts = useDraftStore((s) => s.fetchDraftCounts);

  const needsReplyLeads = useMemo(
    () => leads.filter((l) => l.actionNeeded === "needs_reply"),
    [leads]
  );

  useEffect(() => {
    checkOutlookConnection();
    checkGoogleConnection();
    fetchLeads();
    fetchDraftCounts();
  }, [checkOutlookConnection, checkGoogleConnection, fetchLeads, fetchDraftCounts]);

  const filtered = useMemo(() => {
    let result = leads;
    if (filterStatus !== "all") {
      result = result.filter((l) => l.actionNeeded === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.firstName.toLowerCase().includes(q) ||
          l.lastName.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.company.toLowerCase().includes(q)
      );
    }
    return result;
  }, [leads, filterStatus, searchQuery]);

  const handleGenerateReplies = async () => {
    if (needsReplyLeads.length === 0) return;
    setGeneratingReplies(true);
    setGenerateRepliesMessage(null);
    try {
      const res = await fetch("/api/agent/generate-replies", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate replies");
      await fetchLeads();
      await fetchDraftCounts();
      if (selectedLeadId && data.lead_ids?.includes(selectedLeadId)) {
        fetchDrafts(selectedLeadId);
      }
      setGenerateRepliesMessage(
        `Generated ${data.generated ?? 0} draft${(data.generated ?? 0) !== 1 ? "s" : ""} for leads that need a reply.`
      );
      setTimeout(() => setGenerateRepliesMessage(null), 5000);
    } catch (err) {
      setGenerateRepliesMessage(err instanceof Error ? err.message : "Generate replies failed");
    } finally {
      setGeneratingReplies(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1080px] px-10 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            Leads
          </h1>
          <p className="mt-2 text-[14px] text-ink-mid">
            Manage your outreach contacts.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {needsReplyLeads.length > 0 && (
            <button
              onClick={handleGenerateReplies}
              disabled={generatingReplies}
              className={clsx(
                "inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-edge px-4 py-[10px] text-[13px] font-semibold shadow-xs transition-all disabled:opacity-50",
                "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300"
              )}
            >
              <MessageSquare className="h-4 w-4" strokeWidth={2.5} />
              {generatingReplies
                ? "Generating…"
                : `Generate replies${needsReplyLeads.length > 1 ? ` (${needsReplyLeads.length})` : ""}`}
            </button>
          )}
          {generateRepliesMessage && (
            <span className="text-[13px] text-ink-mid">{generateRepliesMessage}</span>
          )}
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-edge bg-surface px-4 py-[10px] text-[13px] font-semibold text-ink-mid shadow-xs transition-all hover:bg-cream hover:text-ink"
          >
            <Upload className="h-4 w-4" strokeWidth={2.5} />
            Import CSV
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-light" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full rounded-[10px] border border-edge bg-surface py-[10px] pl-10 pr-4 text-[13px] text-ink placeholder:text-ink-light shadow-xs outline-none transition-all hover:border-edge-strong focus:border-copper focus:ring-[3px] focus:ring-copper-light"
          />
        </div>
        <div className="flex gap-[3px] rounded-[10px] border border-edge bg-surface p-[4px] shadow-xs">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={clsx(
                "cursor-pointer rounded-[7px] px-3 py-[6px] text-[12px] font-semibold transition-all duration-150",
                filterStatus === tab.value
                  ? "bg-copper text-white shadow-xs"
                  : "text-ink-mid hover:bg-cream hover:text-ink"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="overflow-hidden rounded-[16px] border border-edge bg-surface shadow-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-edge bg-cream">
                <th className="px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                  Name
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                  Email
                </th>
                <th className="hidden px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light md:table-cell">
                  Company
                </th>
                <th className="hidden px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light lg:table-cell">
                  Title
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                  Status
                </th>
                <th className="px-6 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {filtered.map((lead, i) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className="animate-fade-up cursor-pointer transition-colors duration-150 hover:bg-cream/60"
                  style={{ animationDelay: `${i * 35}ms` }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-ink">
                        {lead.firstName} {lead.lastName}
                      </p>
                      {(unreadByLead[lead.id] ?? 0) > 0 && (
                        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-copper px-1 text-[10px] font-bold text-white">
                          {unreadByLead[lead.id]}
                        </span>
                      )}
                      {(draftCountByLead[lead.id] ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-200">
                          <FileText className="h-3 w-3" />
                          {draftCountByLead[lead.id] === 1 ? "Draft" : `${draftCountByLead[lead.id]} Drafts`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[13px] text-ink-mid">
                    {lead.email}
                  </td>
                  <td className="hidden px-6 py-4 text-[13px] text-ink-mid md:table-cell">
                    {lead.company || "\u2014"}
                  </td>
                  <td className="hidden px-6 py-4 text-[13px] text-ink-mid lg:table-cell">
                    {lead.jobTitle || "\u2014"}
                  </td>
                  <td className="px-6 py-4">
                    <ActionBadge action={lead.actionNeeded} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditLead(lead)}
                        title="Edit lead"
                        className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
                      >
                        <Pencil className="h-[15px] w-[15px]" />
                      </button>
                      <button
                        onClick={() => setEmailLead(lead)}
                        title="Send email"
                        className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-copper-light hover:text-copper"
                      >
                        <Mail className="h-[15px] w-[15px]" />
                      </button>
                      {lead.linkedIn && (
                        <a
                          href={lead.linkedIn}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-sage-light hover:text-sage"
                        >
                          <ExternalLink className="h-[15px] w-[15px]" />
                        </a>
                      )}
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                      >
                        <Trash2 className="h-[15px] w-[15px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface py-20">
          <div className="rounded-[14px] bg-copper-light p-5">
            <Users className="h-7 w-7 text-copper" strokeWidth={1.6} />
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
            {searchQuery || filterStatus !== "all"
              ? "No matches"
              : "No leads yet"}
          </h3>
          <p className="mt-1.5 max-w-[280px] text-center text-[13px] text-ink-mid">
            {searchQuery || filterStatus !== "all"
              ? "Try adjusting your search or filters."
              : "Add your first contact to get started."}
          </p>
          {!searchQuery && filterStatus === "all" && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-6 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Add Your First Lead
            </button>
          )}
        </div>
      )}

      <CreateLeadModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ImportLeadsCsvModal open={importOpen} onClose={() => setImportOpen(false)} />
      <EditLeadModal lead={editLead} onClose={() => setEditLead(null)} />
      <SendEmailModal lead={emailLead} onClose={() => setEmailLead(null)} />
      {selectedLead && (
        <LeadThreadPanel
          lead={selectedLead}
          onClose={() => setSelectedLeadId(null)}
          onOpen={() => markRead(selectedLead.id)}
        />
      )}
    </div>
  );
}
