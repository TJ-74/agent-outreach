"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Mail,
  ArrowRight,
  CheckCircle,
  Inbox,
  GitBranch,
  Clock,
  Sparkles,
  Send,
  Check,
  X,
  User,
  Building2,
  Calendar,
} from "lucide-react";

interface PendingSequence {
  sequenceId: string;
  name: string;
  pendingCount: number;
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
}

type Tab = "pending" | "sent";

function formatSentAt(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export default function ApprovalPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [pending, setPending] = useState<PendingSequence[]>([]);
  const [approved, setApproved] = useState<{ sequenceId: string; name: string; approvedCount: number; isCompleted: boolean }[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentLoading, setSentLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/sequences/pending-approval");
        const data = await res.json();
        if (res.ok) {
          setPending(Array.isArray(data.pending) ? data.pending : []);
          setApproved(Array.isArray(data.approved) ? data.approved : []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (tab !== "sent") return;
    setSentLoading(true);
    fetch("/api/sent-emails")
      .then((res) => res.json())
      .then((data) => {
        setSentEmails(Array.isArray(data.sentEmails) ? data.sentEmails : []);
      })
      .finally(() => setSentLoading(false));
  }, [tab]);

  const totalPending = pending.reduce((acc, s) => acc + s.pendingCount, 0);
  const totalApproved = approved.reduce((acc, s) => acc + s.approvedCount, 0);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-copper/10 animate-ping" />
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-copper-light">
            <Loader2 className="h-5 w-5 animate-spin text-copper" />
          </div>
        </div>
        <p className="mt-2 text-[13px] font-medium text-ink-mid">Loading your approval queue…</p>
      </div>
    );
  }

  const hasPending = pending.length > 0;
  const hasSent = sentEmails.length > 0 || approved.length > 0;

  return (
    <div className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-[640px]">

        {/* Page header */}
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-copper/10">
              <CheckCircle className="h-4 w-4 text-copper" />
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-ink">
              Approval queue
            </h1>
          </div>
          <p className="ml-[42px] text-[13px] text-ink-mid">
            Review emails before they&apos;re sent · View sent history
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex rounded-[12px] border border-edge bg-surface p-1">
          <button
            type="button"
            onClick={() => setTab("pending")}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold transition-all ${
              tab === "pending"
                ? "bg-amber-light text-amber shadow-xs"
                : "text-ink-mid hover:text-ink"
            }`}
          >
            <Clock className="h-4 w-4" />
            Pending
            {totalPending > 0 && (
              <span className={`rounded-full px-2 py-[2px] text-[11px] ${tab === "pending" ? "bg-amber/20" : "bg-cream"}`}>
                {totalPending}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("sent")}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] py-2.5 text-[13px] font-semibold transition-all ${
              tab === "sent"
                ? "bg-sage-light text-sage shadow-xs"
                : "text-ink-mid hover:text-ink"
            }`}
          >
            <Send className="h-4 w-4" />
            Sent
          </button>
        </div>

        {/* Stats strip */}
        {(hasPending || hasSent) && (
          <div className="mb-6 grid grid-cols-3 gap-3 animate-fade-up">
            <div className="rounded-[12px] border border-edge bg-surface px-4 py-3.5">
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="h-3.5 w-3.5 text-copper" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-light">Sequences</span>
              </div>
              <p className="text-[20px] font-bold text-ink leading-none">{pending.length + approved.length}</p>
            </div>
            <div className="rounded-[12px] border border-amber/25 bg-amber-light/40 px-4 py-3.5">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3.5 w-3.5 text-amber" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber/70">Pending</span>
              </div>
              <p className="text-[20px] font-bold text-amber leading-none">{totalPending}</p>
            </div>
            <div className="rounded-[12px] border border-sage/25 bg-sage-light/50 px-4 py-3.5">
              <div className="flex items-center gap-2 mb-1">
                <Send className="h-3.5 w-3.5 text-sage" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sage/70">Sent</span>
              </div>
              <p className="text-[20px] font-bold text-sage leading-none">{sentEmails.length || totalApproved}</p>
            </div>
          </div>
        )}

        {/* Empty state when no content at all */}
        {!hasPending && !hasSent && (
          <div className="rounded-[16px] border border-edge bg-surface shadow-xs overflow-hidden animate-fade-up">
            <div className="relative flex flex-col items-center px-8 py-16 text-center">
              <div className="absolute top-8 left-1/2 -translate-x-1/2 h-40 w-40 rounded-full bg-gradient-to-b from-copper/5 to-transparent blur-2xl" />
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-[20px] bg-cream-deep shadow-inner">
                  <Inbox className="h-9 w-9 text-ink-faint" strokeWidth={1.3} />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-sage-light ring-[3px] ring-surface">
                  <Sparkles className="h-3.5 w-3.5 text-sage" />
                </div>
              </div>
              <p className="relative mt-6 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
                All clear — nothing to approve
              </p>
              <p className="relative mt-1.5 max-w-[320px] text-[13px] leading-[1.6] text-ink-mid">
                Start a sequence or assign a group to it, and pending emails will appear here for your review.
              </p>
              <Link
                href="/sequences"
                className="relative mt-7 inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-2.5 text-[13px] font-semibold text-white shadow-copper transition-all hover:bg-copper-hover active:scale-[0.98]"
              >
                Go to Sequences
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Pending tab content ── */}
        {tab === "pending" && (
          <>
            {pending.length === 0 && hasSent && (
              <div className="rounded-[14px] border border-edge bg-surface px-6 py-10 text-center">
                <p className="text-[14px] font-semibold text-ink">No pending reviews</p>
                <p className="mt-1 text-[13px] text-ink-mid">Switch to the Sent tab to view your sent emails.</p>
              </div>
            )}
            {pending.length > 0 && (
              <ul className="space-y-2">
                {pending.map((seq, i) => (
                  <li key={seq.sequenceId} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                    <Link
                      href={`/sequences/${seq.sequenceId}/approve`}
                      className="group flex cursor-pointer items-center gap-4 rounded-[14px] border border-edge bg-surface px-5 py-4 shadow-xs transition-all hover:border-amber/30 hover:shadow-md"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-amber-light transition-colors group-hover:bg-amber/15">
                        <Mail className="h-5 w-5 text-amber" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-ink truncate group-hover:text-amber transition-colors">
                          {seq.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-mid">
                          {seq.pendingCount} email{seq.pendingCount !== 1 ? "s" : ""} awaiting review
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-light px-2 text-[11px] font-bold text-amber">
                          {seq.pendingCount}
                        </span>
                        <ArrowRight className="h-4 w-4 text-ink-faint transition-all group-hover:text-amber group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/* ── Sent tab content: list of sent emails ── */}
        {tab === "sent" && (
          <>
            {sentLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-sage" />
                <p className="text-[13px] text-ink-mid">Loading sent emails…</p>
              </div>
            ) : sentEmails.length === 0 ? (
              <div className="rounded-[14px] border border-edge bg-surface px-6 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage-light">
                  <Send className="h-6 w-6 text-sage" />
                </div>
                <p className="mt-4 text-[14px] font-semibold text-ink">No sent emails yet</p>
                <p className="mt-1 text-[13px] text-ink-mid">
                  Emails you approve and send from the approval panel will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {sentEmails.map((email) => (
                  <li key={email.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedEmail(email)}
                      className="flex w-full cursor-pointer items-center gap-4 rounded-[14px] border border-edge bg-surface px-5 py-4 text-left shadow-xs transition-all hover:border-sage/30 hover:shadow-md"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sage-light">
                        <User className="h-5 w-5 text-sage" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-ink truncate">{email.lead_name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[12px] text-ink-mid">
                          {email.company && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {email.company}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatSentAt(email.sent_at)}
                          </span>
                          <span className="truncate">· {email.sequence_name}</span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-ink-light">{email.subject || "(No subject)"}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

      </div>

      {/* Modal: view sent email */}
      {selectedEmail && (
        <>
          <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm" onClick={() => setSelectedEmail(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-edge bg-surface shadow-xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-edge px-5 py-4">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-ink truncate">{selectedEmail.lead_name}</p>
                <p className="text-[12px] text-ink-mid truncate">{selectedEmail.lead_email}</p>
                {(selectedEmail.company || selectedEmail.sequence_name) && (
                  <p className="mt-0.5 text-[11px] text-ink-light">
                    {[selectedEmail.company, selectedEmail.sequence_name].filter(Boolean).join(" · ")}
                  </p>
                )}
                <p className="mt-1 flex items-center gap-1 text-[11px] text-ink-light">
                  <Calendar className="h-3 w-3" />
                  Sent {new Date(selectedEmail.sent_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="shrink-0 rounded-[8px] p-2 text-ink-light hover:bg-cream hover:text-ink-mid"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Subject</p>
                <p className="mt-0.5 text-[14px] font-semibold text-ink">{selectedEmail.subject || "(No subject)"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Body</p>
                {selectedEmail.is_html ? (
                  <iframe
                    srcDoc={selectedEmail.body}
                    sandbox="allow-same-origin"
                    className="mt-1 w-full rounded-[8px] border border-edge bg-white min-h-[200px]"
                    style={{ border: "none", minHeight: 200 }}
                    onLoad={(e) => {
                      const iframe = e.currentTarget;
                      const doc = iframe.contentDocument;
                      if (doc) iframe.style.height = Math.min(doc.documentElement.scrollHeight + 8, 400) + "px";
                    }}
                  />
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.7] text-ink-mid">
                    {selectedEmail.body || "(No body)"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
