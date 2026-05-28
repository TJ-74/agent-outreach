"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Search, Plus, Trash2, ExternalLink, Users, Mail, Pencil, MessageSquare, FileText, Upload, Loader2, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import { useLeadStore, type Lead, type ActionNeeded } from "@/store/leads";
import { useOutlookStore } from "@/store/outlook";
import { useGoogleStore } from "@/store/google";
import { useDraftStore } from "@/store/drafts";
import ActionBadge from "@/components/StatusBadge";
import CreateLeadModal from "@/components/CreateLeadModal";
import ImportLeadsCsvModal from "@/components/ImportLeadsCsvModal";
import EditLeadModal from "@/components/EditLeadModal";
import SendEmailModal from "@/components/SendEmailModal";
import LeadThreadPanel from "@/components/LeadThreadPanel";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import clsx from "clsx";

const tabs: { label: string; shortLabel: string; value: ActionNeeded | "all" }[] = [
  { label: "All", shortLabel: "All", value: "all" },
  { label: "Needs Reply", shortLabel: "Reply", value: "needs_reply" },
  { label: "Waiting", shortLabel: "Wait", value: "waiting_for_reply" },
  { label: "Needs Human", shortLabel: "Human", value: "needs_human" },
];

export default function LeadsPage() {
  const {
    leads, loading, searchQuery, filterStatus, page, pageSize, totalCount,
    setSearch, setFilter, setPage, deleteLead, fetchLeads, fetchAllMatchingLeads,
  } = useLeadStore();
  const { checkConnection: checkOutlookConnection } = useOutlookStore();
  const { checkConnection: checkGoogleConnection } = useGoogleStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [emailLead, setEmailLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [generatingReplies, setGeneratingReplies] = useState(false);
  const [generateRepliesMessage, setGenerateRepliesMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<"leads" | "companies">("leads");
  const [companyLeads, setCompanyLeads] = useState<Lead[]>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyPage, setCompanyPage] = useState(1);
  const fetchDrafts = useDraftStore((s) => s.fetchDrafts);
  const draftCountByLead = useDraftStore((s) => s.draftCountByLead);
  const fetchDraftCounts = useDraftStore((s) => s.fetchDraftCounts);
  const selectedLead = selectedLeadId
    ? (leads.find((l) => l.id === selectedLeadId) ?? companyLeads.find((l) => l.id === selectedLeadId) ?? null)
    : null;

  const needsReplyLeads = useMemo(
    () => leads.filter((l) => l.actionNeeded === "needs_reply"),
    [leads]
  );
  const draftLeadCount = useMemo(
    () => Object.values(draftCountByLead).filter((c) => c > 0).length,
    [draftCountByLead],
  );
  const needsReplyCount = filterStatus === "needs_reply" ? totalCount : needsReplyLeads.length;

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  const companyGroups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of companyLeads) {
      const company = lead.company.trim() || "No company";
      if (!map.has(company)) map.set(company, []);
      map.get(company)!.push(lead);
    }
    return Array.from(map.entries())
      .map(([company, groupedLeads]) => ({ company, leads: groupedLeads }))
      .sort((a, b) => {
        if (a.company === "No company") return 1;
        if (b.company === "No company") return -1;
        return a.company.localeCompare(b.company);
      });
  }, [companyLeads]);

  const companyPageSize = 8;
  const companyTotalPages = Math.max(1, Math.ceil(companyGroups.length / companyPageSize));
  const clampedCompanyPage = Math.min(companyPage, companyTotalPages);
  const companyRangeStart = companyGroups.length === 0 ? 0 : (clampedCompanyPage - 1) * companyPageSize + 1;
  const companyRangeEnd = Math.min(clampedCompanyPage * companyPageSize, companyGroups.length);
  const paginatedCompanyGroups = companyGroups.slice(companyRangeStart - 1, companyRangeEnd);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteLead(deleteTarget.id);
    setCompanyLeads((current) => current.filter((lead) => lead.id !== deleteTarget.id));
    if (selectedLeadId === deleteTarget.id) setSelectedLeadId(null);
    setDeleting(false);
    setDeleteTarget(null);
  };

  useEffect(() => {
    checkOutlookConnection();
    checkGoogleConnection();
    fetchDraftCounts();
  }, [checkOutlookConnection, checkGoogleConnection, fetchDraftCounts]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      fetchLeads();
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchLeads(), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (initialMount.current) return;
    fetchLeads();
  }, [page, filterStatus]);

  useEffect(() => {
    if (viewMode !== "companies") return;
    let cancelled = false;
    setCompanyPage(1);
    setCompanyLoading(true);
    fetchAllMatchingLeads()
      .then((allLeads) => {
        if (!cancelled) setCompanyLeads(allLeads);
      })
      .finally(() => {
        if (!cancelled) setCompanyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, searchQuery, filterStatus, fetchAllMatchingLeads]);

  useEffect(() => {
    if (companyPage > companyTotalPages) setCompanyPage(companyTotalPages);
  }, [companyPage, companyTotalPages]);

  const goToCompanyPage = useCallback((p: number) => {
    if (p < 1 || p > companyTotalPages) return;
    setCompanyPage(p);
  }, [companyTotalPages]);

  const goToPage = useCallback((p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  }, [totalPages, setPage]);

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

  const renderLeadRow = (lead: Lead, i: number) => (
    <tr
      key={lead.id}
      onClick={() => setSelectedLeadId(lead.id)}
      className="animate-fade-up cursor-pointer transition-colors duration-150 hover:bg-cream/60"
      style={{ animationDelay: `${i * 35}ms` }}
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-2 min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">
            {lead.firstName} {lead.lastName}
          </p>
          {(draftCountByLead[lead.id] ?? 0) > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sage-light px-2 py-0.5 text-[10px] font-semibold text-sage border border-sage-muted">
              <FileText className="h-3 w-3" />
              {draftCountByLead[lead.id] === 1 ? "Draft" : `${draftCountByLead[lead.id]} Drafts`}
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="block truncate text-[13px] text-ink-mid">
          {lead.email}
        </span>
      </td>
      <td className="hidden px-5 py-4 md:table-cell">
        <span className="block truncate text-[13px] text-ink-mid">
          {lead.company || "\u2014"}
        </span>
      </td>
      <td className="hidden px-5 py-4 lg:table-cell">
        <span className="block truncate text-[13px] text-ink-mid">
          {lead.jobTitle || "\u2014"}
        </span>
      </td>
      <td className="px-5 py-4">
        <ActionBadge action={lead.actionNeeded} />
      </td>
      <td className="px-5 py-4">
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
            onClick={() => setDeleteTarget(lead)}
            className="cursor-pointer rounded-[7px] p-[6px] text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
          >
            <Trash2 className="h-[15px] w-[15px]" />
          </button>
        </div>
      </td>
    </tr>
  );

  const renderLeadCard = (lead: Lead, i: number) => (
    <div
      key={lead.id}
      onClick={() => setSelectedLeadId(lead.id)}
      className="animate-fade-up cursor-pointer rounded-[14px] border border-edge bg-surface p-4 shadow-xs transition-colors hover:bg-cream/50"
      style={{ animationDelay: `${i * 35}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-semibold text-ink">
              {lead.firstName} {lead.lastName}
            </p>
            {(draftCountByLead[lead.id] ?? 0) > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sage-light px-2 py-0.5 text-[10px] font-semibold text-sage border border-sage-muted">
                <FileText className="h-3 w-3" />
                {draftCountByLead[lead.id]}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-[12px] text-ink-mid">{lead.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-light">
            {lead.company && (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-cream px-2 py-1">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{lead.company}</span>
              </span>
            )}
            {lead.jobTitle && (
              <span className="truncate rounded-full bg-cream px-2 py-1">{lead.jobTitle}</span>
            )}
          </div>
        </div>
        <ActionBadge action={lead.actionNeeded} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-edge pt-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setEmailLead(lead)}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-copper-light px-3 py-2 text-[12px] font-semibold text-copper"
        >
          <Mail className="h-3.5 w-3.5" />
          Email
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditLead(lead)}
            title="Edit lead"
            className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream-deep hover:text-ink"
          >
            <Pencil className="h-[15px] w-[15px]" />
          </button>
          {lead.linkedIn && (
            <a
              href={lead.linkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-sage-light hover:text-sage"
            >
              <ExternalLink className="h-[15px] w-[15px]" />
            </a>
          )}
          <button
            onClick={() => setDeleteTarget(lead)}
            className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
          >
            <Trash2 className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </div>
  );

  if (loading && leads.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-copper" />
        <p className="text-[13px] text-ink-mid">Loading leads…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
      {/* Header — title hidden on mobile since the top bar already shows "Leads" */}
      <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="hidden sm:block">
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            Leads
          </h1>
          <p className="mt-2 text-[14px] text-ink-mid">
            Manage your outreach contacts.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {needsReplyLeads.length > 0 && (
            <button
              onClick={handleGenerateReplies}
              disabled={generatingReplies}
              className={clsx(
                "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-edge px-4 py-[10px] text-[13px] font-semibold shadow-xs transition-all disabled:opacity-50 sm:w-auto",
                "bg-amber-light text-amber border-amber/30 hover:border-amber/50"
              )}
            >
              <MessageSquare className="h-4 w-4" strokeWidth={2.5} />
              {generatingReplies
                ? "Generating…"
                : `Generate replies${needsReplyLeads.length > 1 ? ` (${needsReplyLeads.length})` : ""}`}
            </button>
          )}
          {generateRepliesMessage && (
            <span className="text-[12px] text-ink-mid sm:text-[13px]">{generateRepliesMessage}</span>
          )}
          <div className="flex w-full gap-2 sm:w-auto">
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-edge bg-surface px-4 py-[10px] text-[13px] font-semibold text-ink-mid shadow-xs transition-all hover:bg-cream hover:text-ink sm:flex-none"
            >
              <Upload className="h-4 w-4" strokeWidth={2.5} />
              Import CSV
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98] sm:flex-none"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Lead
            </button>
          </div>
        </div>
      </div>

      {/* Stats — compact on mobile */}
      {totalCount > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-2.5 animate-fade-up sm:mb-6 sm:gap-4">
          <div className="rounded-[12px] border border-edge bg-surface px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <Users className="h-3 w-3 text-copper sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-ink-light sm:text-[10px]">Total</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-ink sm:text-[24px]">{totalCount}</p>
          </div>
          <div className="rounded-[12px] border border-amber/20 bg-amber-light/30 px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-amber sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-amber/70 sm:text-[10px]">Need Reply</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-amber sm:text-[24px]">{needsReplyCount}</p>
          </div>
          <div className="rounded-[12px] border border-sage/20 bg-sage-light/40 px-3 py-3 shadow-xs sm:rounded-[14px] sm:px-5 sm:py-4">
            <div className="mb-1 flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-sage sm:h-3.5 sm:w-3.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-sage/70 sm:text-[10px]">Drafts</span>
            </div>
            <p className="text-[20px] font-bold leading-none text-sage sm:text-[24px]">{draftLeadCount}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className={clsx("mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center", selectedLeadId && "hidden md:flex")}>
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
        <div className="flex w-full overflow-x-auto rounded-[10px] border border-edge bg-surface p-[4px] shadow-xs sm:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={clsx(
                "shrink-0 cursor-pointer rounded-[7px] px-2.5 py-[6px] text-[11px] font-semibold transition-all duration-150 sm:px-3 sm:text-[12px]",
                filterStatus === tab.value
                  ? "bg-copper text-white shadow-xs"
                  : "text-ink-mid hover:bg-cream hover:text-ink"
              )}
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={clsx("mb-5 flex gap-[4px] rounded-[12px] border border-edge bg-surface p-[5px] shadow-xs", selectedLeadId && "hidden md:flex")}>
        {([
          { value: "leads", label: "Leads", icon: Users },
          { value: "companies", label: "Companies", icon: Building2 },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              onClick={() => setViewMode(tab.value)}
              className={clsx(
                "inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[8px] px-4 py-2 text-[13px] font-semibold transition-all duration-150",
                viewMode === tab.value
                  ? "bg-copper text-white shadow-xs"
                  : "text-ink-mid hover:bg-cream hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Table / cards */}
      <div className={clsx(selectedLeadId && "hidden md:block")}>
      {viewMode === "leads" && leads.length > 0 ? (
        <>
          <div className="space-y-3 md:hidden">
            {leads.map(renderLeadCard)}
          </div>
          <div className="hidden overflow-hidden rounded-[16px] border border-edge bg-surface shadow-xs md:block">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[24%]" />
                <col className="w-[16%]" />
                <col className="hidden lg:table-column w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-edge bg-cream">
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                    Name
                  </th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                    Email
                  </th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                    Company
                  </th>
                  <th className="hidden px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light lg:table-cell">
                    Title
                  </th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                    Status
                  </th>
                  <th className="px-5 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {leads.map(renderLeadRow)}
              </tbody>
            </table>
          </div>
        </>
      ) : viewMode === "companies" ? (
        companyLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] border border-edge bg-surface py-20">
            <Loader2 className="h-6 w-6 animate-spin text-copper" />
            <p className="text-[13px] text-ink-mid">Loading companies…</p>
          </div>
        ) : companyGroups.length > 0 ? (
          <>
            <div className="space-y-4">
              {paginatedCompanyGroups.map((group) => (
                <div key={group.company} className="overflow-hidden rounded-[14px] border border-edge bg-surface shadow-xs sm:rounded-[16px]">
                  <div className="flex items-center justify-between border-b border-edge bg-cream px-4 py-3 sm:px-5 sm:py-3.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0 text-copper" />
                      <p className="truncate text-[14px] font-bold text-ink">{group.company}</p>
                    </div>
                    <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-mid">
                      {group.leads.length} lead{group.leads.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-3 p-3 md:hidden">
                    {group.leads.map(renderLeadCard)}
                  </div>
                  <div className="hidden md:block">
                    <table className="w-full table-fixed">
                      <colgroup>
                        <col className="w-[22%]" />
                        <col className="w-[24%]" />
                        <col className="w-[16%]" />
                        <col className="hidden lg:table-column w-[16%]" />
                        <col className="w-[12%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <tbody className="divide-y divide-edge">
                        {group.leads.map(renderLeadRow)}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-[12px] border border-edge bg-surface px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[12px] text-ink-mid">
                Showing <span className="font-semibold text-ink">{companyRangeStart}–{companyRangeEnd}</span> of{" "}
                <span className="font-semibold text-ink">{companyGroups.length}</span> companies
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => goToCompanyPage(clampedCompanyPage - 1)}
                  disabled={clampedCompanyPage <= 1}
                  className="cursor-pointer rounded-[8px] p-[7px] text-ink-mid transition-colors hover:bg-cream hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: companyTotalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === companyTotalPages || Math.abs(p - clampedCompanyPage) <= 1)
                  .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "ellipsis" ? (
                      <span key={`ce${idx}`} className="px-1 text-[12px] text-ink-light">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => goToCompanyPage(item)}
                        className={clsx(
                          "cursor-pointer rounded-[8px] px-2.5 py-[5px] text-[12px] font-semibold transition-colors",
                          clampedCompanyPage === item
                            ? "bg-copper text-white shadow-xs"
                            : "text-ink-mid hover:bg-cream hover:text-ink"
                        )}
                      >
                        {item}
                      </button>
                    )
                  )}
                <button
                  onClick={() => goToCompanyPage(clampedCompanyPage + 1)}
                  disabled={clampedCompanyPage >= companyTotalPages}
                  className="cursor-pointer rounded-[8px] p-[7px] text-ink-mid transition-colors hover:bg-cream hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface px-4 py-16 sm:py-20">
            <div className="rounded-[14px] bg-copper-light p-5">
              <Building2 className="h-7 w-7 text-copper" strokeWidth={1.6} />
            </div>
            <h3 className="mt-5 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
              No companies found
            </h3>
            <p className="mt-1.5 max-w-[280px] text-center text-[13px] text-ink-mid">
              Try adjusting your search or filters.
            </p>
          </div>
        )
      ) : !loading ? (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface px-4 py-16 sm:py-20">
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
      ) : null}

      {/* Pagination */}
      {viewMode === "leads" && totalCount > 0 && (
        <div className="mt-4 flex flex-col gap-2 rounded-[12px] border border-edge bg-surface px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[12px] text-ink-mid">
            Showing <span className="font-semibold text-ink">{rangeStart}–{rangeEnd}</span> of{" "}
            <span className="font-semibold text-ink">{totalCount}</span> lead{totalCount !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="cursor-pointer rounded-[8px] p-[7px] text-ink-mid transition-colors hover:bg-cream hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("ellipsis");
                acc.push(p);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e${idx}`} className="px-1 text-[12px] text-ink-light">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => goToPage(item)}
                    className={clsx(
                      "cursor-pointer rounded-[8px] px-2.5 py-[5px] text-[12px] font-semibold transition-colors",
                      page === item
                        ? "bg-copper text-white shadow-xs"
                        : "text-ink-mid hover:bg-cream hover:text-ink"
                    )}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="cursor-pointer rounded-[8px] p-[7px] text-ink-mid transition-colors hover:bg-cream hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      </div>

      <CreateLeadModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ImportLeadsCsvModal open={importOpen} onClose={() => setImportOpen(false)} />
      <EditLeadModal lead={editLead} onClose={() => setEditLead(null)} />
      <SendEmailModal lead={emailLead} onClose={() => setEmailLead(null)} />
      {selectedLead && (
        <LeadThreadPanel
          lead={selectedLead}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete lead?"
        description={`Delete ${deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}`.trim() || deleteTarget.email : "this lead"} and related outreach data? This cannot be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
