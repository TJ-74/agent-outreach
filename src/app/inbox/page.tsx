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
  ChevronRight,
  Sparkles,
  RotateCcw,
  MessageSquare,
  Trash2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/ThemeProvider";
import { buildPreviewSrcDoc } from "@/lib/html-preview";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { useDraftStore } from "@/store/drafts";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center rounded-[8px] border border-edge bg-cream py-10">
      <Loader2 className="h-4 w-4 animate-spin text-copper" />
    </div>
  ),
});

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
  enrollment_id: string;
  lead_id: string;
  lead_name: string;
  lead_email: string;
  company: string | null;
  step_number: number;
  subject: string;
  body: string;
  is_html: boolean;
  sent_at: string;
  outlook_message_id: string | null;
  direction?: "outbound" | "inbound";
  from_email?: string | null;
  from_name?: string | null;
  to_email?: string | null;
  to_name?: string | null;
  status?: string | null;
  lead_profile: LeadProfile | null;
}

interface Thread {
  key: string;
  emails: SentEmail[]; // sorted oldest → newest
  latest: SentEmail;
  first: SentEmail;
}

const FOLLOW_UP_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

type SortFilter = "newest" | "oldest" | "lead" | "company" | "needsFollowUp";
type DateFilter = "all" | "today" | "week" | "month" | "custom";
type DirectionFilter = "all" | "latestOutbound" | "latestInbound";
type ResearchFilter = "all" | "with" | "without";

function needsFollowUp(thread: Thread, nowMs: number) {
  const latest = thread.latest;
  if (latest.direction === "inbound") return false;
  return nowMs - new Date(latest.sent_at).getTime() >= FOLLOW_UP_THRESHOLD_MS;
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
  placement = "bottom",
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placement?: "top" | "bottom";
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

  const count = selected.size;
  const singleSelectedLabel =
    count === 1
      ? options.find((opt) => selected.has(opt.value))?.label ?? [...selected][0]
      : null;

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
          {count === 0 ? label : count === 1 ? singleSelectedLabel : `${count} selected`}
        </span>
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 right-0 z-[90] max-h-[220px] overflow-y-auto rounded-[10px] border border-edge bg-surface py-1 shadow-md animate-fade-up ${
            placement === "top" ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <button
            onClick={() => onChange(new Set())}
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
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [contentTab, setContentTab] = useState<"email" | "research">("email");
  const contentRef = useRef<HTMLDivElement>(null);
  // Track which earlier emails are expanded in the conversation view (latest is always expanded)
  const [expandedEmailIds, setExpandedEmailIds] = useState<Set<string>>(new Set());

  const [filterSequences, setFilterSequences] = useState<Set<string>>(new Set());
  const [filterCompanies, setFilterCompanies] = useState<Set<string>>(new Set());
  const [filterDate, setFilterDate] = useState<DateFilter>("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterDirection, setFilterDirection] = useState<DirectionFilter>("all");
  const [filterResearch, setFilterResearch] = useState<ResearchFilter>("all");
  const [filterNeedsFollowUp, setFilterNeedsFollowUp] = useState(false);
  const [sortFilter, setSortFilter] = useState<SortFilter>("newest");
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // Follow-up compose state
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpSubject, setFollowUpSubject] = useState("");
  const [followUpBody, setFollowUpBody] = useState("");
  const [followUpGenerating, setFollowUpGenerating] = useState(false);
  const [followUpSending, setFollowUpSending] = useState(false);
  const [followUpSavingDraft, setFollowUpSavingDraft] = useState(false);
  const [followUpDraftId, setFollowUpDraftId] = useState<string | null>(null);
  const [followUpDraftSavedAt, setFollowUpDraftSavedAt] = useState<string | null>(null);
  const [followUpSent, setFollowUpSent] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [deleteTarget, setDeleteTarget] = useState<Thread | null>(null);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const saveDraft = useDraftStore((s) => s.saveDraft);
  const updateDraft = useDraftStore((s) => s.updateDraft);
  const deleteDraft = useDraftStore((s) => s.deleteDraft);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadInbox() {
      await fetch("/api/outlook/poll", { method: "POST" }).catch(() => null);

      const res = await fetch("/api/sent-emails");
      const data = await res.json();
      const list: SentEmail[] = Array.isArray(data.sentEmails) ? data.sentEmails : [];
      setEmails(list);
      // Auto-select the first thread
      const firstKey = list[0]?.lead_id || list[0]?.lead_email || null;
      if (firstKey) setSelectedThreadKey(firstKey);
      setLoading(false);
    }

    loadInbox().catch(() => setLoading(false));
  }, []);

  // Group all emails into threads by lead_id
  const allThreads = useMemo((): Thread[] => {
    const map = new Map<string, SentEmail[]>();
    for (const email of emails) {
      const key = email.lead_id || email.lead_email;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(email);
    }
    return Array.from(map.entries())
      .map(([key, threadEmails]) => {
        const sorted = [...threadEmails].sort(
          (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
        );
        return { key, emails: sorted, latest: sorted[sorted.length - 1], first: sorted[0] };
      })
      .sort((a, b) => new Date(b.latest.sent_at).getTime() - new Date(a.latest.sent_at).getTime());
  }, [emails]);

  const sequences = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allThreads) for (const e of t.emails) map.set(e.sequence_id, e.sequence_name);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allThreads]);

  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const t of allThreads) for (const e of t.emails) if (e.company) set.add(e.company);
    return Array.from(set).sort();
  }, [allThreads]);

  const activeFilterCount =
    (filterSequences.size > 0 ? 1 : 0) +
    (filterCompanies.size > 0 ? 1 : 0) +
    (filterDate !== "all" ? 1 : 0) +
    (filterDirection !== "all" ? 1 : 0) +
    (filterResearch !== "all" ? 1 : 0) +
    (filterNeedsFollowUp ? 1 : 0) +
    (sortFilter !== "newest" ? 1 : 0);

  const threads = useMemo((): Thread[] => {
    let result = allThreads;
    if (filterSequences.size > 0) {
      result = result.filter((t) => t.emails.some((e) => filterSequences.has(e.sequence_id)));
    }
    if (filterCompanies.size > 0) {
      result = result.filter((t) => t.emails.some((e) => e.company != null && filterCompanies.has(e.company)));
    }
    if (filterDate !== "all") {
      if (filterDate === "custom") {
        const fromTime = filterDateFrom ? new Date(`${filterDateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
        const toTime = filterDateTo ? new Date(`${filterDateTo}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
        result = result.filter((t) =>
          t.emails.some((e) => {
            const sentTime = new Date(e.sent_at).getTime();
            return sentTime >= fromTime && sentTime <= toTime;
          })
        );
      } else {
        const now = new Date();
        const start = new Date();
        if (filterDate === "today") start.setHours(0, 0, 0, 0);
        else if (filterDate === "week") start.setDate(now.getDate() - 7);
        else if (filterDate === "month") start.setMonth(now.getMonth() - 1);
        result = result.filter((t) => t.emails.some((e) => new Date(e.sent_at) >= start));
      }
    }
    if (filterDirection !== "all") {
      result = result.filter((t) =>
        filterDirection === "latestInbound"
          ? t.latest.direction === "inbound"
          : t.latest.direction !== "inbound"
      );
    }
    if (filterResearch !== "all") {
      result = result.filter((t) => {
        const hasResearch = t.emails.some((e) => !!e.lead_profile?.research);
        return filterResearch === "with" ? hasResearch : !hasResearch;
      });
    }
    if (filterNeedsFollowUp) {
      result = result.filter((t) => needsFollowUp(t, nowMs));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.emails.some(
          (e) =>
            e.lead_name.toLowerCase().includes(q) ||
            e.lead_email.toLowerCase().includes(q) ||
            (e.company ?? "").toLowerCase().includes(q) ||
            e.subject.toLowerCase().includes(q) ||
            e.sequence_name.toLowerCase().includes(q)
        )
      );
    }
    return [...result].sort((a, b) => {
      if (sortFilter === "oldest") {
        return new Date(a.latest.sent_at).getTime() - new Date(b.latest.sent_at).getTime();
      }
      if (sortFilter === "lead") {
        return a.first.lead_name.localeCompare(b.first.lead_name);
      }
      if (sortFilter === "company") {
        return (a.first.company ?? "").localeCompare(b.first.company ?? "");
      }
      if (sortFilter === "needsFollowUp") {
        const aDue = needsFollowUp(a, nowMs) ? 1 : 0;
        const bDue = needsFollowUp(b, nowMs) ? 1 : 0;
        if (aDue !== bDue) return bDue - aDue;
      }
      return new Date(b.latest.sent_at).getTime() - new Date(a.latest.sent_at).getTime();
    });
  }, [
    allThreads,
    searchQuery,
    filterSequences,
    filterCompanies,
    filterDate,
    filterDateFrom,
    filterDateTo,
    filterDirection,
    filterResearch,
    filterNeedsFollowUp,
    sortFilter,
    nowMs,
  ]);

  const clearAllFilters = () => {
    setFilterSequences(new Set());
    setFilterCompanies(new Set());
    setFilterDate("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterDirection("all");
    setFilterResearch("all");
    setFilterNeedsFollowUp(false);
    setSortFilter("newest");
  };

  const { theme } = useTheme();
  const selectedThread = selectedThreadKey ? threads.find((t) => t.key === selectedThreadKey) ?? null : null;
  const latestEmail = selectedThread?.latest ?? null;

  const selectThread = (key: string) => {
    setSelectedThreadKey(key);
    setContentTab("email");
    setFollowUpOpen(false);
    setFollowUpSubject("");
    setFollowUpBody("");
    setFollowUpDraftId(null);
    setFollowUpDraftSavedAt(null);
    setFollowUpSent(false);
    setFollowUpError(null);
    setExpandedEmailIds(new Set());
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleEmailExpand = (id: string) => {
    setExpandedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerateFollowUp = async () => {
    if (!latestEmail) return;
    setFollowUpGenerating(true);
    setFollowUpError(null);
    setFollowUpSent(false);
    try {
      const res = await fetch("/api/inbox/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequenceId: latestEmail.sequence_id,
          leadName: latestEmail.lead_name,
          leadEmail: latestEmail.lead_email,
          company: latestEmail.company,
          originalSubject: latestEmail.subject,
          originalBody: latestEmail.body,
          research: latestEmail.lead_profile?.research || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFollowUpError(d.error ?? "Generation failed");
        return;
      }
      const { subject, body } = await res.json();
      const generatedSubject = subject ?? "";
      const generatedBody = body ?? "";
      setFollowUpSubject(generatedSubject);
      setFollowUpBody(generatedBody);

      if (latestEmail.lead_id && generatedBody.trim()) {
        setFollowUpSavingDraft(true);
        const draft = await saveDraft(
          latestEmail.lead_id,
          generatedSubject,
          generatedBody,
          latestEmail.outlook_message_id ?? null,
        );
        if (draft) {
          setFollowUpDraftId(draft.id);
          setFollowUpDraftSavedAt(draft.updatedAt ?? draft.createdAt);
        }
      }
    } catch {
      setFollowUpError("Network error during generation");
    } finally {
      setFollowUpSavingDraft(false);
      setFollowUpGenerating(false);
    }
  };

  const handleSaveFollowUpDraft = async () => {
    if (!latestEmail || !followUpBody.trim()) return;
    setFollowUpSavingDraft(true);
    setFollowUpError(null);
    try {
      if (followUpDraftId) {
        await updateDraft(followUpDraftId, followUpSubject || `Re: ${latestEmail.subject}`, followUpBody);
        setFollowUpDraftSavedAt(new Date().toISOString());
      } else if (latestEmail.lead_id) {
        const draft = await saveDraft(
          latestEmail.lead_id,
          followUpSubject || `Re: ${latestEmail.subject}`,
          followUpBody,
          latestEmail.outlook_message_id ?? null,
        );
        if (draft) {
          setFollowUpDraftId(draft.id);
          setFollowUpDraftSavedAt(draft.updatedAt ?? draft.createdAt);
        }
      }
    } catch {
      setFollowUpError("Could not save draft");
    } finally {
      setFollowUpSavingDraft(false);
    }
  };

  const handleSendFollowUp = async () => {
    if (!latestEmail || !followUpBody.trim()) return;
    setFollowUpSending(true);
    setFollowUpError(null);
    try {
      const res = await fetch("/api/inbox/send-follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outlookMessageId: latestEmail.outlook_message_id ?? null,
            outlookMessageDirection: latestEmail.direction ?? "outbound",
          to: latestEmail.lead_email,
          subject: followUpSubject || `Re: ${latestEmail.subject}`,
          body: followUpBody,
          sequenceId: latestEmail.sequence_id,
          sequenceName: latestEmail.sequence_name,
          enrollmentId: latestEmail.enrollment_id,
          leadId: latestEmail.lead_id,
          leadName: latestEmail.lead_name,
          leadEmail: latestEmail.lead_email,
          company: latestEmail.company,
          stepNumber: latestEmail.step_number,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setFollowUpError(d.error ?? "Send failed");
        return;
      }
      const data = await res.json();
      if (data.recorded && data.sentEmail) {
        const newEntry: SentEmail = {
          ...data.sentEmail,
          lead_profile: latestEmail.lead_profile,
        };
        // Prepend to emails — the thread recomputes and the new email appears at the bottom of the conversation
        setEmails((prev) => [newEntry, ...prev]);
      }
      if (followUpDraftId) {
        await deleteDraft(followUpDraftId);
      }
      setFollowUpSent(true);
      setFollowUpOpen(false);
      setFollowUpSubject("");
      setFollowUpBody("");
      setFollowUpDraftId(null);
      setFollowUpDraftSavedAt(null);
    } catch {
      setFollowUpError("Network error during send");
    } finally {
      setFollowUpSending(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!deleteTarget) return;

    setDeletingConversation(true);
    setDeleteError(null);
    try {
      const sentEmailIds = deleteTarget.emails
        .filter((email) => !email.id.startsWith("message:"))
        .map((email) => email.id);
      const messageIds = deleteTarget.emails
        .filter((email) => email.id.startsWith("message:"))
        .map((email) => email.id.replace(/^message:/, ""));

      const res = await fetch("/api/sent-emails", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentEmailIds,
          messageIds,
          leadId: deleteTarget.first.lead_id,
          leadEmail: deleteTarget.first.lead_email,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "Failed to delete conversation");
        return;
      }

      setEmails((current) => {
        const remaining = current.filter((email) => (email.lead_id || email.lead_email) !== deleteTarget.key);
        if (selectedThreadKey === deleteTarget.key) {
          setSelectedThreadKey(remaining[0]?.lead_id || remaining[0]?.lead_email || null);
          setFollowUpOpen(false);
          setFollowUpSubject("");
          setFollowUpBody("");
          setFollowUpSent(false);
          setExpandedEmailIds(new Set());
        }
        return remaining;
      });
      setDeleteTarget(null);
    } catch {
      setDeleteError("Network error while deleting conversation");
    } finally {
      setDeletingConversation(false);
    }
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
      {filterModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-0 backdrop-blur-[2px] sm:px-4"
          onClick={() => setFilterModalOpen(false)}
        >
          <div
            className="flex h-full w-full flex-col overflow-hidden border-edge bg-surface shadow-xl animate-fade-up sm:max-h-[88vh] sm:max-w-[560px] sm:rounded-[18px] sm:border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-surface px-5 py-4">
              <div>
                <p className="font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">Inbox Filters</p>
                <p className="mt-0.5 text-[12px] text-ink-light">Sort and narrow conversations by status, date, sequence, and more.</p>
              </div>
              <button
                onClick={() => setFilterModalOpen(false)}
                className="cursor-pointer rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream hover:text-ink"
                aria-label="Close filters"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-light">Sequence & Company</p>
                <div className="grid gap-2 sm:grid-cols-2">
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
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-light">Sort</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["newest", "Newest first"],
                    ["oldest", "Oldest first"],
                    ["needsFollowUp", "Follow-up due first"],
                    ["lead", "Lead name A-Z"],
                    ["company", "Company A-Z"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setSortFilter(value)}
                      className={`cursor-pointer rounded-[10px] border px-3 py-2 text-left text-[12px] font-semibold transition-all ${
                        sortFilter === value
                          ? "border-copper/40 bg-copper-light text-copper"
                          : "border-edge bg-cream/40 text-ink-mid hover:border-edge-strong hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-light">Status</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => setFilterNeedsFollowUp((s) => !s)}
                    className={`cursor-pointer rounded-[10px] border px-3 py-2 text-left text-[12px] font-semibold transition-all ${
                      filterNeedsFollowUp
                        ? "border-copper/40 bg-copper-light text-copper"
                        : "border-edge bg-cream/40 text-ink-mid hover:border-edge-strong hover:text-ink"
                    }`}
                  >
                    Needs follow-up
                  </button>
                  {([
                    ["all", "Any latest message"],
                    ["latestOutbound", "Latest is outbound"],
                    ["latestInbound", "Latest is inbound"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setFilterDirection(value)}
                      className={`cursor-pointer rounded-[10px] border px-3 py-2 text-left text-[12px] font-semibold transition-all ${
                        filterDirection === value
                          ? "border-copper/40 bg-copper-light text-copper"
                          : "border-edge bg-cream/40 text-ink-mid hover:border-edge-strong hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-light">Date Range</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {([
                    ["all", "All"],
                    ["today", "Today"],
                    ["week", "Week"],
                    ["month", "Month"],
                    ["custom", "Custom"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setFilterDate(value)}
                      className={`cursor-pointer rounded-[9px] border py-2 text-center text-[11px] font-semibold transition-all ${
                        filterDate === value
                          ? "border-copper/40 bg-copper-light text-copper"
                          : "border-edge bg-cream/40 text-ink-mid hover:border-edge-strong hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filterDate === "custom" && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-ink-light">From</span>
                      <input
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="w-full rounded-[9px] border border-edge bg-cream px-3 py-2 text-[12px] text-ink outline-none transition-all focus:border-copper focus:ring-[2px] focus:ring-copper-light"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium text-ink-light">To</span>
                      <input
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="w-full rounded-[9px] border border-edge bg-cream px-3 py-2 text-[12px] text-ink outline-none transition-all focus:border-copper focus:ring-[2px] focus:ring-copper-light"
                      />
                    </label>
                  </div>
                )}
              </section>

              <section>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-light">Lead Context</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ["all", "Any research"],
                    ["with", "Has research"],
                    ["without", "No research"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setFilterResearch(value)}
                      className={`cursor-pointer rounded-[10px] border px-3 py-2 text-left text-[12px] font-semibold transition-all ${
                        filterResearch === value
                          ? "border-copper/40 bg-copper-light text-copper"
                          : "border-edge bg-cream/40 text-ink-mid hover:border-edge-strong hover:text-ink"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-edge bg-surface px-4 py-4 sm:px-5">
              <button
                onClick={clearAllFilters}
                className="cursor-pointer text-[12px] font-semibold text-copper transition-colors hover:text-copper-hover"
              >
                Clear all
              </button>
              <button
                onClick={() => setFilterModalOpen(false)}
                className="cursor-pointer rounded-[10px] bg-copper px-4 py-2 text-[12px] font-semibold text-white transition-all hover:bg-copper-hover"
              >
                Show {threads.length} conversation{threads.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        open={!!deleteTarget}
        title="Delete conversation?"
        description={
          deleteError
            ? deleteError
            : `Delete the stored conversation with ${deleteTarget?.first.lead_name ?? "this lead"} from the inbox? This will not delete messages from Outlook or Gmail.`
        }
        confirmLabel="Delete conversation"
        loading={deletingConversation}
        onConfirm={handleDeleteConversation}
        onClose={() => {
          if (deletingConversation) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />

      {/* ── Left sidebar: thread list ── */}
      <div className={`${selectedThreadKey ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-edge bg-surface md:w-[280px]`}>
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-edge bg-surface px-4 py-4 md:static">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-sage/10">
              <Inbox className="h-3.5 w-3.5 text-sage" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-ink">Sent Emails</p>
              <p className="text-[10px] text-ink-light">
                {activeFilterCount > 0 ? `${threads.length} of ${allThreads.length}` : allThreads.length}{" "}
                conversation{allThreads.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Search + Filter toggle */}
        <div className="sticky top-[65px] z-20 border-b border-edge bg-surface px-3 py-2.5 md:static">
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
              onClick={() => setFilterModalOpen(true)}
              className={`relative cursor-pointer shrink-0 rounded-[8px] border p-[7px] transition-all ${
                filterModalOpen || activeFilterCount > 0
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

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-edge px-3 py-2">
            {filterNeedsFollowUp && (
              <span className="inline-flex items-center gap-1 rounded-full bg-copper-light px-2 py-[3px] text-[10px] font-semibold text-copper">
                <RotateCcw className="h-2.5 w-2.5" />
                Needs follow-up
                <button onClick={() => setFilterNeedsFollowUp(false)} className="cursor-pointer ml-0.5 hover:text-copper-hover"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {filterDate !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-copper-light px-2 py-[3px] text-[10px] font-semibold text-copper">
                <Calendar className="h-2.5 w-2.5" />
                {filterDate === "today"
                  ? "Today"
                  : filterDate === "week"
                    ? "This week"
                    : filterDate === "month"
                      ? "This month"
                      : "Custom date"}
                <button onClick={() => setFilterDate("all")} className="cursor-pointer ml-0.5 hover:text-copper-hover"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {filterDirection !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-copper-light px-2 py-[3px] text-[10px] font-semibold text-copper">
                <Mail className="h-2.5 w-2.5" />
                {filterDirection === "latestInbound" ? "Latest inbound" : "Latest outbound"}
                <button onClick={() => setFilterDirection("all")} className="cursor-pointer ml-0.5 hover:text-copper-hover"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {filterResearch !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-copper-light px-2 py-[3px] text-[10px] font-semibold text-copper">
                <Globe className="h-2.5 w-2.5" />
                {filterResearch === "with" ? "Has research" : "No research"}
                <button onClick={() => setFilterResearch("all")} className="cursor-pointer ml-0.5 hover:text-copper-hover"><X className="h-2.5 w-2.5" /></button>
              </span>
            )}
            {sortFilter !== "newest" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-copper-light px-2 py-[3px] text-[10px] font-semibold text-copper">
                <Filter className="h-2.5 w-2.5" />
                Sort: {sortFilter === "oldest" ? "Oldest" : sortFilter === "lead" ? "Lead" : sortFilter === "company" ? "Company" : "Follow-up"}
                <button onClick={() => setSortFilter("newest")} className="cursor-pointer ml-0.5 hover:text-copper-hover"><X className="h-2.5 w-2.5" /></button>
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

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Search className="mx-auto h-5 w-5 text-ink-light" />
              <p className="mt-2 text-[12px] text-ink-mid">No matches</p>
            </div>
          )}
          {threads.map((thread) => {
            const active = thread.key === selectedThreadKey;
            const emailCount = thread.emails.length;
            const followUpDue = needsFollowUp(thread, nowMs);
            return (
              <div
                key={thread.key}
                role="button"
                tabIndex={0}
                onClick={() => selectThread(thread.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") selectThread(thread.key);
                }}
                className={`group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-all border-b border-edge/50 ${
                  active
                    ? "bg-sage-light/60 border-l-[3px] border-l-sage"
                    : "border-l-[3px] border-l-transparent hover:bg-cream/70"
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  active ? "bg-sage text-white" : "bg-cream-deep text-ink-mid"
                }`}>
                  {initials(thread.first.lead_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[12px] font-semibold ${active ? "text-ink" : "text-ink-mid"}`}>
                      {thread.first.lead_name}
                    </p>
                    <span className="shrink-0 text-[10px] text-ink-light">{formatDate(thread.latest.sent_at)}</span>
                  </div>
                  {followUpDue && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-copper-light px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.04em] text-copper">
                      <RotateCcw className="h-2.5 w-2.5" />
                      Needs follow-up
                    </div>
                  )}
                  <p className="truncate text-[11px] text-ink-light mt-0.5">
                    {thread.latest.subject || "(No subject)"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {thread.first.company && (
                      <span className="truncate text-[10px] text-ink-light">{thread.first.company}</span>
                    )}
                    {emailCount > 1 && (
                      <span className="shrink-0 inline-flex items-center gap-[3px] rounded-full bg-sage-light px-1.5 py-[1px] text-[9px] font-semibold text-sage">
                        <MessageSquare className="h-2.5 w-2.5" />
                        {emailCount}
                      </span>
                    )}
                    {thread.first.lead_profile?.research && (
                      <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-copper" title="Has research" />
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(thread);
                  }}
                  className="shrink-0 rounded-[7px] p-1.5 text-ink-light opacity-0 transition-all hover:bg-rose-light hover:text-rose group-hover:opacity-100"
                  title="Delete conversation"
                  aria-label={`Delete conversation with ${thread.first.lead_name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className={`${selectedThreadKey ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
        {selectedThread && latestEmail ? (
          <div ref={contentRef} className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-8 animate-fade-up" key={selectedThread.key}>
              <button
                onClick={() => setSelectedThreadKey(null)}
                className="mb-4 inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-edge bg-surface px-3 py-2 text-[12px] font-semibold text-ink-mid md:hidden"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                Conversations
              </button>
              {needsFollowUp(selectedThread, nowMs) && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-[12px] border border-copper/25 bg-copper-light/40 px-4 py-3">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-copper">
                    <RotateCcw className="h-4 w-4" />
                    This thread is older than 2 days with no reply. It needs a follow-up.
                  </div>
                  <button
                    onClick={() => {
                      setFollowUpOpen(true);
                      if (!followUpBody) handleGenerateFollowUp();
                    }}
                    className="cursor-pointer rounded-[8px] bg-copper px-3 py-[6px] text-[12px] font-semibold text-white transition-all hover:bg-copper-hover"
                  >
                    Draft follow-up
                  </button>
                </div>
              )}

              {/* Recipient header */}
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage-light font-[family-name:var(--font-display)] text-[14px] font-bold text-sage">
                    {initials(latestEmail.lead_name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">{latestEmail.lead_name}</p>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-ink-mid">
                      <span className="truncate">{latestEmail.lead_email}</span>
                      {latestEmail.company && (
                        <>
                          <span className="text-ink-faint">·</span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Building2 className="h-3 w-3" />{latestEmail.company}
                          </span>
                        </>
                      )}
                      {latestEmail.lead_profile?.jobTitle && (
                        <>
                          <span className="text-ink-faint">·</span>
                          <span className="flex items-center gap-1 shrink-0">
                            <Briefcase className="h-3 w-3" />{latestEmail.lead_profile.jobTitle}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:ml-3 sm:shrink-0 sm:justify-end">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-copper-light px-2.5 py-1 text-[10px] font-semibold text-copper">
                    <Send className="h-3 w-3" />{latestEmail.sequence_name}
                  </span>
                  {selectedThread.emails.length > 1 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage-light px-2.5 py-1 text-[10px] font-semibold text-sage">
                      <MessageSquare className="h-3 w-3" />
                      {selectedThread.emails.length} emails
                    </span>
                  )}
                  {latestEmail.lead_profile?.linkedIn && (
                    <a
                      href={latestEmail.lead_profile.linkedIn}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[7px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-copper"
                      title="LinkedIn"
                    >
                      <Linkedin className="h-4 w-4" />
                    </a>
                  )}
                  <button
                    onClick={() => setDeleteTarget(selectedThread)}
                    className="rounded-[7px] p-1.5 text-ink-light transition-colors hover:bg-rose-light hover:text-rose"
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {followUpSent ? (
                    <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-sage-light px-3 py-[6px] text-[12px] font-semibold text-sage">
                      <Check className="h-3.5 w-3.5" />
                      Follow-up sent
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        if (!followUpOpen) {
                          setFollowUpOpen(true);
                          if (!followUpBody) handleGenerateFollowUp();
                        } else {
                          setFollowUpOpen(false);
                        }
                      }}
                      className={`cursor-pointer inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-[6px] text-[12px] font-semibold transition-all ${
                        followUpOpen
                          ? "border-copper/40 bg-copper-light text-copper"
                          : "border-edge bg-surface text-ink-mid hover:border-copper/40 hover:bg-copper-light hover:text-copper"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Follow Up
                    </button>
                  )}
                </div>
              </div>

              {/* Content tabs */}
              <div className="mb-5 flex items-center gap-1 rounded-[10px] bg-cream-deep/60 p-1">
                <button
                  onClick={() => setContentTab("email")}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-all sm:flex-none ${
                    contentTab === "email" ? "bg-surface text-ink shadow-xs" : "text-ink-mid hover:text-ink"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Conversation
                </button>
                <button
                  onClick={() => setContentTab("research")}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-all sm:flex-none ${
                    contentTab === "research" ? "bg-surface text-ink shadow-xs" : "text-ink-mid hover:text-ink"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Research
                  {latestEmail.lead_profile?.research && (
                    <span className="h-1.5 w-1.5 rounded-full bg-sage" />
                  )}
                </button>
              </div>

              {contentTab === "email" ? (
                <>
                  {/* ── Conversation thread ── */}
                  <div className="relative space-y-4">
                    {selectedThread.emails.map((email, idx) => {
                      const isLatest = idx === selectedThread.emails.length - 1;
                      const isExpanded = isLatest || expandedEmailIds.has(email.id);
                      const isFirst = idx === 0;
                      const isInbound = email.direction === "inbound";

                      return (
                        <div key={email.id} className="relative">
                          {/* Email card */}
                          <div className="min-w-0">
                            {isExpanded ? (
                              <div className={`overflow-hidden rounded-[16px] border shadow-xs ${
                                isInbound
                                  ? "border-amber/20 bg-amber-light/10"
                                  : "border-edge bg-surface"
                              }`}>
                                {/* Card header — click to collapse non-latest */}
                                <div
                                  className={`border-b border-edge/70 px-4 py-3 sm:px-5 ${!isLatest ? "cursor-pointer hover:bg-cream/50" : ""}`}
                                  onClick={() => !isLatest && toggleEmailExpand(email.id)}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${
                                      isInbound ? "bg-amber-light text-amber" : "bg-sage-light text-sage"
                                    }`}>
                                      {isInbound ? <MessageSquare className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                                          {email.subject || "(No subject)"}
                                        </p>
                                        {!isLatest && <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-light" />}
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className={`rounded-full px-2 py-[2px] text-[10px] font-semibold ${
                                          isInbound ? "bg-amber-light text-amber" : "bg-sage-light text-sage"
                                        }`}>
                                          {isInbound ? "Received reply" : "Sent email"}
                                        </span>
                                        <span className="text-[11px] text-ink-light">{formatFullDate(email.sent_at)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-edge/50 bg-cream/35 px-4 py-2 sm:px-5">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-light">{isInbound ? "From" : "To"}</span>
                                  <span className="min-w-0 truncate rounded-full bg-surface px-2.5 py-[2px] text-[11px] font-medium text-ink-mid">
                                    {isInbound ? (email.from_name || email.from_email || email.lead_email) : email.lead_email}
                                  </span>
                                  <span className="ml-auto hidden items-center gap-1.5 sm:flex">
                                    <Check className={`h-3 w-3 ${isInbound ? "text-amber" : "text-sage"}`} />
                                    <span className={`text-[11px] font-medium ${isInbound ? "text-amber" : "text-sage"}`}>
                                      {isInbound ? "Received" : "Sent"}
                                    </span>
                                  </span>
                                </div>
                                <div className="bg-surface px-4 py-4 sm:px-5">
                                  {email.is_html ? (
                                    <iframe
                                      srcDoc={buildPreviewSrcDoc(
                                        `<style>*{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif!important}body{margin:0;padding:0;font-size:13px;line-height:1.7;color:${theme === "dark" ? "#EDE9E4" : "#2C2925"};background:${theme === "dark" ? "#1F272E" : "#ffffff"}}</style>`,
                                        email.body
                                      )}
                                      sandbox="allow-same-origin"
                                      className="w-full rounded-[10px] bg-surface"
                                      style={{ border: "none", minHeight: 120 }}
                                      onLoad={(e) => {
                                        const iframe = e.currentTarget;
                                        const doc = iframe.contentDocument;
                                        if (doc) iframe.style.height = Math.min(doc.documentElement.scrollHeight + 8, 520) + "px";
                                      }}
                                    />
                                  ) : (
                                    <p className="whitespace-pre-wrap rounded-[10px] bg-cream/35 px-3 py-3 text-[13px] leading-[1.7] text-ink-mid">
                                      {email.body || "(No body)"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Collapsed card */
                              <button
                                onClick={() => toggleEmailExpand(email.id)}
                                className="flex w-full items-center gap-3 rounded-[12px] border border-edge bg-surface px-4 py-3 text-left transition-all hover:border-edge-strong hover:bg-cream/60"
                              >
                                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${isInbound ? "bg-amber-light text-amber" : "bg-cream-deep text-ink-mid"}`}>
                                  {isInbound ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                                </div>
                                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-mid">{email.subject || "(No subject)"}</span>
                                <span className="shrink-0 text-[10px] text-ink-light">{formatFullDate(email.sent_at)}</span>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-light" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {!followUpOpen && !followUpSent && (
                    <button
                      onClick={() => {
                        setFollowUpOpen(true);
                        if (!followUpBody) handleGenerateFollowUp();
                      }}
                      className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] border border-copper/30 bg-copper-light/30 px-4 py-3.5 text-[13px] font-semibold text-copper transition-all hover:border-copper/50 hover:bg-copper-light active:scale-[0.99]"
                    >
                      <Sparkles className="h-4 w-4" />
                      {followUpBody ? "Open AI follow-up draft" : "Generate AI follow-up message"}
                    </button>
                  )}

                  {/* Follow-up compose panel */}
                  {followUpOpen && (
                    <div className="mt-2 overflow-hidden rounded-[14px] border border-copper/30 bg-surface shadow-xs animate-fade-up">
                      <div className="flex items-center justify-between border-b border-edge px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-copper" />
                          <p className="text-[13px] font-semibold text-ink">AI Follow-up</p>
                          {followUpGenerating && (
                            <span className="flex items-center gap-1.5 text-[11px] text-ink-light">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Generating…
                            </span>
                          )}
                          {!followUpGenerating && followUpDraftId && (
                            <span className="rounded-full bg-amber-light px-2 py-[2px] text-[10px] font-semibold text-amber">
                              Draft saved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {!followUpGenerating && followUpBody && (
                            <button
                              onClick={handleGenerateFollowUp}
                              title="Regenerate"
                              className="cursor-pointer rounded-[7px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-ink"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setFollowUpOpen(false)}
                            className="cursor-pointer rounded-[7px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-ink"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {followUpGenerating ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-6 w-6 animate-spin text-copper" />
                            <p className="text-[12px] text-ink-mid">Crafting your follow-up…</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 p-4 sm:p-5">
                          {followUpError && (
                            <p className="rounded-[8px] bg-rose-light/40 px-3 py-2 text-[12px] font-medium text-rose">
                              {followUpError}
                            </p>
                          )}
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                              Subject
                            </label>
                            <input
                              type="text"
                              value={followUpSubject}
                              onChange={(e) => setFollowUpSubject(e.target.value)}
                              className="w-full rounded-[8px] border border-edge bg-cream px-3.5 py-[8px] text-[13px] text-ink outline-none transition-all focus:border-copper focus:ring-[3px] focus:ring-copper-light"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">
                              Body
                            </label>
                            <RichTextEditor
                              content={followUpBody}
                              onChange={setFollowUpBody}
                              placeholder="Write your follow-up..."
                              className="rounded-[8px] border border-edge bg-cream"
                              compact
                            />
                          </div>
                          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-[11px] text-ink-light">
                              {followUpDraftSavedAt
                                ? `Draft saved ${new Date(followUpDraftSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                : `To: ${latestEmail.lead_email}`}
                            </span>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                              <button
                                onClick={() => setFollowUpOpen(false)}
                                className="cursor-pointer rounded-[8px] px-3 py-2 text-[12px] font-medium text-ink-mid hover:bg-cream sm:py-[6px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleSaveFollowUpDraft}
                                disabled={followUpSavingDraft || !followUpBody.trim()}
                                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-edge bg-surface px-4 py-2 text-[12px] font-semibold text-ink-mid transition-all hover:bg-cream hover:text-ink disabled:opacity-50 sm:py-[7px]"
                              >
                                {followUpSavingDraft ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <FileText className="h-3.5 w-3.5" />
                                )}
                                {followUpSavingDraft ? "Saving…" : "Save Draft"}
                              </button>
                              <button
                                onClick={handleSendFollowUp}
                                disabled={followUpSending || !followUpBody.trim()}
                                className="col-span-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-copper px-4 py-2.5 text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] disabled:opacity-50 sm:col-span-1 sm:py-[7px]"
                              >
                                {followUpSending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5" />
                                )}
                                {followUpSending ? "Sending…" : "Send Follow-up"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {latestEmail.lead_profile?.notes && (
                    <div className="mt-5 rounded-[12px] border border-edge bg-surface p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <StickyNote className="h-3.5 w-3.5 text-ink-light" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Notes</span>
                      </div>
                      <p className="text-[13px] leading-[1.65] text-ink-mid">{latestEmail.lead_profile.notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Research tab */}
                  {latestEmail.lead_profile?.research ? (
                    <div className="rounded-[14px] border border-edge bg-surface shadow-xs overflow-hidden">
                      <div className="flex items-center gap-3 border-b border-edge px-5 py-3">
                        <Globe className="h-4 w-4 text-copper" />
                        <p className="text-[14px] font-semibold text-ink flex-1">Research — {latestEmail.lead_name}</p>
                      </div>
                      <div className="px-5 py-5">
                        <SimpleMarkdown text={latestEmail.lead_profile.research} />
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
                          {initials(latestEmail.lead_name)}
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-ink">{latestEmail.lead_name}</p>
                          <p className="text-[12px] text-ink-mid">{latestEmail.lead_email}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[8px] bg-cream px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Company</p>
                          <p className="mt-0.5 text-[13px] font-medium text-ink">{latestEmail.company || "—"}</p>
                        </div>
                        <div className="rounded-[8px] bg-cream px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Job Title</p>
                          <p className="mt-0.5 text-[13px] font-medium text-ink">{latestEmail.lead_profile?.jobTitle || "—"}</p>
                        </div>
                        <div className="rounded-[8px] bg-cream px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Status</p>
                          <p className="mt-0.5 text-[13px] font-medium text-ink capitalize">{latestEmail.lead_profile?.status || "—"}</p>
                        </div>
                        <div className="rounded-[8px] bg-cream px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Sequence</p>
                          <p className="mt-0.5 text-[13px] font-medium text-ink truncate">{latestEmail.sequence_name}</p>
                        </div>
                      </div>
                      {latestEmail.lead_profile?.linkedIn && (
                        <a
                          href={latestEmail.lead_profile.linkedIn}
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
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[14px] bg-cream-deep">
              <Mail className="h-6 w-6 text-ink-light" />
            </div>
            <p className="mt-4 text-[14px] font-semibold text-ink">Select a conversation</p>
            <p className="mt-1 text-[13px] text-ink-mid">Choose a lead from the list to view the full email thread.</p>
          </div>
        )}
      </div>
    </div>
  );
}
