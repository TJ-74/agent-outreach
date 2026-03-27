"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Inbox,
  Loader2,
  Search,
  Send,
  Building2,
  Briefcase,
  Calendar,
  Mail,
  Globe,
  StickyNote,
  ArrowRight,
  Linkedin,
  ExternalLink,
  Check,
  Filter,
  X,
  GitBranch,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

interface LeadProfile {
  jobTitle: string;
  research: string;
  linkedIn: string;
  notes: string;
  status: string;
}

interface SentEmail {
  id: string;
  sequence_id: string;
  sequence_name: string;
  lead_id: string;
  lead_name: string;
  lead_email: string;
  company: string | null;
  step_number: number;
  subject: string;
  body: string;
  is_html: boolean;
  sent_at: string;
  lead_profile: LeadProfile | null;
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    elements.push(
      <ul key={key++} className="my-2 space-y-1.5 pl-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-[1.65] text-ink-mid">
            <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-copper/50" />
            <span>{inlineParse(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  const inlineParse = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let k = 0;
    while ((match = re.exec(str)) !== null) {
      if (match.index > last) parts.push(str.slice(last, match.index));
      parts.push(<strong key={k++} className="font-semibold text-ink">{match[1]}</strong>);
      last = re.lastIndex;
    }
    if (last < str.length) parts.push(str.slice(last));
    return parts;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      flushBullets();
      elements.push(
        <h3 key={key++} className="mt-4 mb-1.5 flex items-center gap-2 text-[13px] font-bold text-ink first:mt-0">
          <span className="h-[3px] w-[3px] rounded-full bg-copper" />
          {inlineParse(trimmed.slice(3))}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      flushBullets();
      elements.push(
        <h2 key={key++} className="mt-5 mb-2 text-[15px] font-bold text-ink first:mt-0">
          {inlineParse(trimmed.slice(2))}
        </h2>
      );
    } else if (/^[-*•]\s/.test(trimmed)) {
      bulletBuffer.push(trimmed.replace(/^[-*•]\s+/, ""));
    } else if (trimmed === "") {
      flushBullets();
    } else {
      flushBullets();
      elements.push(
        <p key={key++} className="my-1.5 text-[13px] leading-[1.7] text-ink-mid">
          {inlineParse(trimmed)}
        </p>
      );
    }
  }
  flushBullets();
  return <div>{elements}</div>;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatFullDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const prefix = sameDay ? "Today" : formatDate(iso);
  return prefix + ", " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function MultiSelectDropdown({
  label,
  icon: Icon,
  options,
  selected,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (val: string) => {
    const next = new Set(selected);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(next);
  };

  const selectAll = () => onChange(new Set());

  const count = selected.size;

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen((s) => !s)}
        className={`cursor-pointer flex w-full items-center gap-1.5 rounded-[8px] border px-2.5 py-[7px] text-[11px] font-medium transition-all ${
          count > 0
            ? "border-copper/40 bg-copper-light text-copper"
            : "border-edge bg-cream text-ink-mid hover:border-edge-strong"
        }`}
      >
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate flex-1 text-left">
          {count === 0 ? label : count === 1 ? [...selected][0] : `${count} selected`}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[220px] overflow-y-auto rounded-[10px] border border-edge bg-surface py-1 shadow-md animate-fade-up">
          <button
            onClick={selectAll}
            className={`cursor-pointer flex w-full items-center gap-2 px-3 py-[7px] text-left text-[11px] transition-colors hover:bg-cream ${
              count === 0 ? "font-semibold text-copper" : "text-ink-mid"
            }`}
          >
            <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border ${
              count === 0 ? "border-copper bg-copper" : "border-edge"
            }`}>
              {count === 0 && <Check className="h-2.5 w-2.5 text-white" />}
            </span>
            All
          </button>
          {options.map((opt) => {
            const checked = selected.has(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={`cursor-pointer flex w-full items-center gap-2 px-3 py-[7px] text-left text-[11px] transition-colors hover:bg-cream ${
                  checked ? "font-semibold text-ink" : "text-ink-mid"
                }`}
              >
                <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-all ${
                  checked ? "border-copper bg-copper" : "border-edge"
                }`}>
                  {checked && <Check className="h-2.5 w-2.5 text-white" />}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<"email" | "research">("email");
  const contentRef = useRef<HTMLDivElement>(null);

  const [filterSequences, setFilterSequences] = useState<Set<string>>(new Set());
  const [filterCompanies, setFilterCompanies] = useState<Set<string>>(new Set());
  const [filterDate, setFilterDate] = useState<"all" | "today" | "week" | "month">("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetch("/api/sent-emails")
      .then((r) => r.json())
      .then((data) => {
        const list: SentEmail[] = Array.isArray(data.sentEmails) ? data.sentEmails : [];
        setEmails(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const sequences = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of emails) map.set(e.sequence_id, e.sequence_name);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [emails]);

  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const e of emails) if (e.company) set.add(e.company);
    return Array.from(set).sort();
  }, [emails]);

  const activeFilterCount = (filterSequences.size > 0 ? 1 : 0) + (filterCompanies.size > 0 ? 1 : 0) + (filterDate !== "all" ? 1 : 0);

  const filtered = useMemo(() => {
    let result = emails;

    if (filterSequences.size > 0) {
      result = result.filter((e) => filterSequences.has(e.sequence_id));
    }
    if (filterCompanies.size > 0) {
      result = result.filter((e) => e.company != null && filterCompanies.has(e.company));
    }
    if (filterDate !== "all") {
      const now = new Date();
      const start = new Date();
      if (filterDate === "today") start.setHours(0, 0, 0, 0);
      else if (filterDate === "week") start.setDate(now.getDate() - 7);
      else if (filterDate === "month") start.setMonth(now.getMonth() - 1);
      result = result.filter((e) => new Date(e.sent_at) >= start);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.lead_name.toLowerCase().includes(q) ||
          e.lead_email.toLowerCase().includes(q) ||
          (e.company ?? "").toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.sequence_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [emails, searchQuery, filterSequences, filterCompanies, filterDate]);

  const clearAllFilters = () => {
    setFilterSequences(new Set());
    setFilterCompanies(new Set());
    setFilterDate("all");
  };

  const { theme } = useTheme();
  const selected = selectedId ? emails.find((e) => e.id === selectedId) ?? null : null;

  const selectEmail = (id: string) => {
    setSelectedId(id);
    setContentTab("email");
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-sage/10 animate-ping" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-sage-light">
            <Loader2 className="h-5 w-5 animate-spin text-sage" />
          </div>
        </div>
        <p className="mt-2 text-[13px] font-medium text-ink-mid">Loading inbox…</p>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center px-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-[20px] bg-cream-deep shadow-inner">
          <Inbox className="h-9 w-9 text-ink-faint" strokeWidth={1.3} />
        </div>
        <p className="mt-6 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
          No sent emails yet
        </p>
        <p className="mt-1.5 max-w-[320px] text-center text-[13px] leading-[1.6] text-ink-mid">
          Emails you approve and send from the approval queue will appear here.
        </p>
        <Link
          href="/approval"
          className="mt-7 inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-2.5 text-[13px] font-semibold text-white shadow-copper transition-all hover:bg-copper-hover active:scale-[0.98]"
        >
          Go to Approval Queue
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-cream">
      {/* ── Left sidebar: lead list ── */}
      <div className="flex w-[280px] shrink-0 flex-col border-r border-edge bg-surface">
        {/* Header */}
        <div className="border-b border-edge px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-sage/10">
              <Inbox className="h-3.5 w-3.5 text-sage" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-ink">Sent Emails</p>
              <p className="text-[10px] text-ink-light">
                {activeFilterCount > 0 ? `${filtered.length} of ${emails.length}` : emails.length} email{emails.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Search + Filter toggle */}
        <div className="border-b border-edge px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-light" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-[8px] border border-edge bg-cream py-[7px] pl-8 pr-3 text-[12px] text-ink placeholder:text-ink-light outline-none transition-all focus:border-sage focus:ring-[2px] focus:ring-sage-light"
              />
            </div>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className={`relative cursor-pointer shrink-0 rounded-[8px] border p-[7px] transition-all ${
                showFilters || activeFilterCount > 0
                  ? "border-copper/40 bg-copper-light text-copper"
                  : "border-edge bg-cream text-ink-light hover:text-ink-mid"
              }`}
              title="Filters"
            >
              <Filter className="h-3.5 w-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-copper text-[8px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="border-b border-edge bg-cream/50 px-3 py-3 space-y-2.5 animate-fade-up">
            {/* Date dropdown */}
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0">
                <button
                  className="sr-only"
                  aria-label="Date filter"
                />
                <div className="flex items-center gap-1">
                  {([["all", "All time"], ["today", "Today"], ["week", "Week"], ["month", "Month"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setFilterDate(val)}
                      className={`cursor-pointer flex-1 rounded-[6px] py-[6px] text-center text-[10px] font-semibold transition-all ${
                        filterDate === val
                          ? "bg-copper text-white shadow-xs"
                          : "bg-surface border border-edge text-ink-mid hover:border-edge-strong"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dropdowns row */}
            <div className="flex items-center gap-1.5">
              {sequences.length > 0 && (
                <MultiSelectDropdown
                  label="Sequence"
                  icon={GitBranch}
                  options={sequences.map((s) => ({ value: s.id, label: s.name }))}
                  selected={filterSequences}
                  onChange={setFilterSequences}
                />
              )}
              {companies.length > 0 && (
                <MultiSelectDropdown
                  label="Company"
                  icon={Building2}
                  options={companies.map((c) => ({ value: c, label: c }))}
                  selected={filterCompanies}
                  onChange={setFilterCompanies}
                />
              )}
            </div>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-medium text-copper hover:underline"
              >
                <X className="h-3 w-3" />
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Active filter chips (when panel is closed) */}
        {!showFilters && activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-edge px-3 py-2">
            {filterDate !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-copper-light px-2 py-[3px] text-[10px] font-semibold text-copper">
                <Calendar className="h-2.5 w-2.5" />
                {filterDate === "today" ? "Today" : filterDate === "week" ? "This week" : "This month"}
                <button onClick={() => setFilterDate("all")} className="cursor-pointer ml-0.5 hover:text-copper-hover"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {filterSequences.size > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-copper-light px-2 py-[3px] text-[10px] font-semibold text-copper max-w-[160px]">
                <GitBranch className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">
                  {filterSequences.size === 1
                    ? sequences.find((s) => filterSequences.has(s.id))?.name
                    : `${filterSequences.size} sequences`}
                </span>
                <button onClick={() => setFilterSequences(new Set())} className="cursor-pointer shrink-0 ml-0.5 hover:text-copper-hover"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {filterCompanies.size > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-copper-light px-2 py-[3px] text-[10px] font-semibold text-copper max-w-[160px]">
                <Building2 className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">
                  {filterCompanies.size === 1
                    ? [...filterCompanies][0]
                    : `${filterCompanies.size} companies`}
                </span>
                <button onClick={() => setFilterCompanies(new Set())} className="cursor-pointer shrink-0 ml-0.5 hover:text-copper-hover"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
          </div>
        )}

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Search className="mx-auto h-5 w-5 text-ink-light" />
              <p className="mt-2 text-[12px] text-ink-mid">No matches</p>
            </div>
          )}
          {filtered.map((email) => {
            const active = email.id === selectedId;
            return (
              <button
                key={email.id}
                onClick={() => selectEmail(email.id)}
                className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-all border-b border-edge/50 ${
                  active
                    ? "bg-sage-light/60 border-l-[3px] border-l-sage"
                    : "border-l-[3px] border-l-transparent hover:bg-cream/70"
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  active ? "bg-sage text-white" : "bg-cream-deep text-ink-mid"
                }`}>
                  {initials(email.lead_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[12px] font-semibold ${active ? "text-ink" : "text-ink-mid"}`}>
                      {email.lead_name}
                    </p>
                    <span className="shrink-0 text-[10px] text-ink-light">{formatDate(email.sent_at)}</span>
                  </div>
                  <p className="truncate text-[11px] text-ink-light mt-0.5">{email.subject || "(No subject)"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {email.company && (
                      <span className="truncate text-[10px] text-ink-light">{email.company}</span>
                    )}
                    {email.lead_profile?.research && (
                      <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-copper" title="Has research" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {selected ? (
          <>
            {/* Content */}
            <div ref={contentRef} className="flex-1 overflow-y-auto">
              <div className="p-6 md:p-8 animate-fade-up" key={selected.id}>
                {/* Recipient bar */}
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage-light font-[family-name:var(--font-display)] text-[14px] font-bold text-sage">
                      {initials(selected.lead_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">{selected.lead_name}</p>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-ink-mid">
                        <span className="truncate">{selected.lead_email}</span>
                        {selected.company && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span className="flex items-center gap-1 shrink-0">
                              <Building2 className="h-3 w-3" />{selected.company}
                            </span>
                          </>
                        )}
                        {selected.lead_profile?.jobTitle && (
                          <>
                            <span className="text-ink-faint">·</span>
                            <span className="flex items-center gap-1 shrink-0">
                              <Briefcase className="h-3 w-3" />{selected.lead_profile.jobTitle}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 ml-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-copper-light px-2.5 py-1 text-[10px] font-semibold text-copper">
                      <Send className="h-3 w-3" />{selected.sequence_name}
                    </span>
                    <span className="rounded-full bg-sage-light px-2.5 py-1 text-[10px] font-semibold text-sage">
                      Step {selected.step_number}
                    </span>
                    {selected.lead_profile?.linkedIn && (
                      <a
                        href={selected.lead_profile.linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-[7px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-copper"
                        title="LinkedIn"
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Sent status */}
                <div className="mb-5 flex items-center gap-2 rounded-[10px] bg-sage-light px-4 py-2.5">
                  <Check className="h-3.5 w-3.5 text-sage" />
                  <span className="text-[12px] font-semibold text-sage">Sent</span>
                  <span className="text-[12px] text-sage/70">·</span>
                  <span className="flex items-center gap-1 text-[12px] text-sage/70">
                    <Calendar className="h-3 w-3" />
                    {formatFullDate(selected.sent_at)}
                  </span>
                </div>

                {/* Content tabs */}
                <div className="mb-5 flex items-center gap-1 rounded-[10px] bg-cream-deep/60 p-1">
                  <button
                    onClick={() => setContentTab("email")}
                    className={`cursor-pointer flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-all ${
                      contentTab === "email"
                        ? "bg-surface text-ink shadow-xs"
                        : "text-ink-mid hover:text-ink"
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </button>
                  <button
                    onClick={() => setContentTab("research")}
                    className={`cursor-pointer flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-all ${
                      contentTab === "research"
                        ? "bg-surface text-ink shadow-xs"
                        : "text-ink-mid hover:text-ink"
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Research
                    {selected.lead_profile?.research && (
                      <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                    )}
                  </button>
                </div>

                {contentTab === "email" ? (
                  <>
                    {/* Email card */}
                    <div className="rounded-[14px] border border-edge bg-surface shadow-xs overflow-hidden">
                      <div className="flex items-center gap-3 border-b border-edge px-5 py-3">
                        <Mail className="h-4 w-4 shrink-0 text-ink-light" />
                        <p className="text-[14px] font-semibold text-ink flex-1 min-w-0 truncate">
                          {selected.subject || "(No subject)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 border-b border-edge/60 px-5 py-2">
                        <span className="text-[11px] font-medium text-ink-light">To:</span>
                        <span className="rounded-full bg-cream px-2.5 py-[2px] text-[11px] font-medium text-ink-mid">
                          {selected.lead_email}
                        </span>
                      </div>
                      <div className="px-5 py-4 min-h-[180px]">
                        {selected.is_html ? (
                          <iframe
                            srcDoc={
                              `<style>*{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif!important}body{margin:0;padding:0;font-size:13px;line-height:1.7;color:${theme === "dark" ? "#EDE9E4" : "#2C2925"};background:${theme === "dark" ? "#1F272E" : "#ffffff"}}</style>` +
                              selected.body
                            }
                            sandbox="allow-same-origin"
                            className="w-full rounded-[8px] bg-surface"
                            style={{ border: "none", minHeight: 200 }}
                            onLoad={(e) => {
                              const iframe = e.currentTarget;
                              const doc = iframe.contentDocument;
                              if (doc) iframe.style.height = Math.min(doc.documentElement.scrollHeight + 8, 520) + "px";
                            }}
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-[13px] leading-[1.7] text-ink-mid">
                            {selected.body || "(No body)"}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {selected.lead_profile?.notes && (
                      <div className="mt-5 rounded-[12px] border border-edge bg-surface p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <StickyNote className="h-3.5 w-3.5 text-ink-light" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Notes</span>
                        </div>
                        <p className="text-[13px] leading-[1.65] text-ink-mid">{selected.lead_profile.notes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Research */}
                    {selected.lead_profile?.research ? (
                      <div className="rounded-[14px] border border-edge bg-surface shadow-xs overflow-hidden">
                        <div className="flex items-center gap-3 border-b border-edge px-5 py-3">
                          <Globe className="h-4 w-4 text-copper" />
                          <p className="text-[14px] font-semibold text-ink flex-1">Research — {selected.lead_name}</p>
                        </div>
                        <div className="px-5 py-5">
                          <SimpleMarkdown text={selected.lead_profile.research} />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[14px] border border-edge bg-surface px-6 py-14 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream-deep">
                          <Search className="h-5 w-5 text-ink-light" />
                        </div>
                        <p className="mt-3 text-[14px] font-semibold text-ink">No research available</p>
                        <p className="mt-1 mx-auto max-w-[280px] text-[13px] text-ink-mid">
                          Research data will appear here if it was generated during the sequence.
                        </p>
                        <Link
                          href="/leads"
                          className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-copper hover:underline"
                        >
                          View in Leads <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}

                    {/* Profile card */}
                    <div className="mt-5 rounded-[12px] border border-edge bg-surface p-5">
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Lead Profile</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sage-light font-[family-name:var(--font-display)] text-[13px] font-bold text-sage">
                            {initials(selected.lead_name)}
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-ink">{selected.lead_name}</p>
                            <p className="text-[12px] text-ink-mid">{selected.lead_email}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-[8px] bg-cream px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Company</p>
                            <p className="mt-0.5 text-[13px] font-medium text-ink">{selected.company || "—"}</p>
                          </div>
                          <div className="rounded-[8px] bg-cream px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Job Title</p>
                            <p className="mt-0.5 text-[13px] font-medium text-ink">{selected.lead_profile?.jobTitle || "—"}</p>
                          </div>
                          <div className="rounded-[8px] bg-cream px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Status</p>
                            <p className="mt-0.5 text-[13px] font-medium text-ink capitalize">{selected.lead_profile?.status || "—"}</p>
                          </div>
                          <div className="rounded-[8px] bg-cream px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Sequence</p>
                            <p className="mt-0.5 text-[13px] font-medium text-ink truncate">{selected.sequence_name}</p>
                          </div>
                        </div>
                        {selected.lead_profile?.linkedIn && (
                          <a
                            href={selected.lead_profile.linkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-[8px] border border-edge px-3 py-2 text-[12px] font-medium text-copper transition-all hover:border-copper hover:bg-copper-light"
                          >
                            <Linkedin className="h-3.5 w-3.5" />
                            View LinkedIn Profile
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-cream-deep">
              <Mail className="h-6 w-6 text-ink-light" />
            </div>
            <p className="mt-4 text-[14px] font-semibold text-ink">Select an email</p>
            <p className="mt-1 text-[13px] text-ink-mid">Choose an email from the list to view its details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
