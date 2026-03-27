"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
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
  X,
  User,
  Building2,
  Calendar,
} from "lucide-react";
import clsx from "clsx";

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ApprovalPage() {
  const { theme } = useTheme();
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-copper" />
        <p className="text-[13px] text-ink-mid">Loading your approval queue…</p>
      </div>
    );
  }

  const hasPending = pending.length > 0;
  const hasSent = sentEmails.length > 0 || approved.length > 0;

  return (
    <div className="mx-auto max-w-[1080px] px-10 py-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
            Approvals
          </h1>
          <p className="mt-2 text-[14px] text-ink-mid">
            Review pending emails and track your sent history.
          </p>
        </div>
        {totalPending > 0 && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-light px-3 py-1 text-[12px] font-semibold text-amber">
              <Clock className="h-3.5 w-3.5" />
              {totalPending} pending review{totalPending !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      {(hasPending || hasSent) && (
        <div className="mb-6 grid grid-cols-3 gap-4 animate-fade-up">
          <div className="rounded-[14px] border border-edge bg-surface px-5 py-4 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <GitBranch className="h-3.5 w-3.5 text-copper" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Sequences</span>
            </div>
            <p className="text-[24px] font-bold text-ink leading-none">{pending.length + approved.length}</p>
          </div>
          <div className="rounded-[14px] border border-amber/20 bg-amber-light/30 px-5 py-4 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="h-3.5 w-3.5 text-amber" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber/70">Pending</span>
            </div>
            <p className="text-[24px] font-bold text-amber leading-none">{totalPending}</p>
          </div>
          <div className="rounded-[14px] border border-sage/20 bg-sage-light/40 px-5 py-4 shadow-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <Send className="h-3.5 w-3.5 text-sage" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sage/70">Sent</span>
            </div>
            <p className="text-[24px] font-bold text-sage leading-none">{sentEmails.length || totalApproved}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-[3px] rounded-[10px] border border-edge bg-surface p-[4px] shadow-xs sm:w-fit">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={clsx(
            "cursor-pointer flex items-center gap-2 rounded-[7px] px-4 py-[7px] text-[12px] font-semibold transition-all duration-150",
            tab === "pending"
              ? "bg-copper text-white shadow-xs"
              : "text-ink-mid hover:bg-cream hover:text-ink"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          Pending
          {totalPending > 0 && (
            <span className={clsx(
              "rounded-full px-1.5 py-[1px] text-[10px] font-bold",
              tab === "pending" ? "bg-white/20" : "bg-cream-deep"
            )}>
              {totalPending}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("sent")}
          className={clsx(
            "cursor-pointer flex items-center gap-2 rounded-[7px] px-4 py-[7px] text-[12px] font-semibold transition-all duration-150",
            tab === "sent"
              ? "bg-copper text-white shadow-xs"
              : "text-ink-mid hover:bg-cream hover:text-ink"
          )}
        >
          <Send className="h-3.5 w-3.5" />
          Sent
        </button>
      </div>

      {/* Empty: no data at all */}
      {!hasPending && !hasSent && (
        <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface py-20 animate-fade-up">
          <div className="relative">
            <div className="rounded-[14px] bg-copper-light p-5">
              <Inbox className="h-7 w-7 text-copper" strokeWidth={1.6} />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-sage-light ring-[3px] ring-surface">
              <Sparkles className="h-3 w-3 text-sage" />
            </div>
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
            All clear — nothing to approve
          </h3>
          <p className="mt-1.5 max-w-[360px] text-center text-[13px] text-ink-mid">
            Start a sequence or assign a group to it, and pending emails will appear here for your review.
          </p>
          <Link
            href="/sequences"
            className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
          >
            Go to Sequences
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* ── Pending tab ── */}
      {tab === "pending" && (
        <>
          {pending.length === 0 && hasSent && (
            <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface py-16">
              <CheckCircle className="h-8 w-8 text-sage" strokeWidth={1.6} />
              <p className="mt-4 font-[family-name:var(--font-display)] text-[15px] font-bold text-ink">
                No pending reviews
              </p>
              <p className="mt-1 text-[13px] text-ink-mid">
                Switch to the Sent tab to view your sent emails.
              </p>
            </div>
          )}
          {pending.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((seq, i) => (
                <Link
                  key={seq.sequenceId}
                  href={`/sequences/${seq.sequenceId}/approve`}
                  className="group animate-fade-up cursor-pointer rounded-[16px] border border-edge bg-surface p-5 shadow-xs transition-all duration-200 hover:border-amber/30 hover:shadow-md"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-amber-light transition-colors group-hover:bg-amber/15">
                      <Mail className="h-5 w-5 text-amber" />
                    </div>
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-light px-2 text-[12px] font-bold text-amber">
                      {seq.pendingCount}
                    </span>
                  </div>
                  <p className="mt-3 text-[14px] font-semibold text-ink truncate group-hover:text-amber transition-colors">
                    {seq.name}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-mid">
                    {seq.pendingCount} email{seq.pendingCount !== 1 ? "s" : ""} awaiting review
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-copper opacity-0 transition-all group-hover:opacity-100">
                    Review now
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Sent tab ── */}
      {tab === "sent" && (
        <>
          {sentLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-copper" />
              <p className="text-[13px] text-ink-mid">Loading sent emails…</p>
            </div>
          ) : sentEmails.length === 0 ? (
            <div className="flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface py-16">
              <div className="rounded-[14px] bg-sage-light p-5">
                <Send className="h-7 w-7 text-sage" strokeWidth={1.6} />
              </div>
              <h3 className="mt-5 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
                No sent emails yet
              </h3>
              <p className="mt-1.5 max-w-[320px] text-center text-[13px] text-ink-mid">
                Emails you approve and send from the approval panel will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[16px] border border-edge bg-surface shadow-xs">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-edge bg-cream">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Recipient</th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Subject</th>
                    <th className="hidden px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light md:table-cell">Sequence</th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {sentEmails.map((email, i) => (
                    <tr
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className="animate-fade-up cursor-pointer transition-colors duration-150 hover:bg-cream/60"
                      style={{ animationDelay: `${i * 25}ms` }}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-light text-[11px] font-bold text-sage">
                            {email.lead_name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-ink">{email.lead_name}</p>
                            {email.company && (
                              <p className="truncate text-[11px] text-ink-light">{email.company}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="truncate text-[13px] text-ink-mid">{email.subject || "(No subject)"}</p>
                      </td>
                      <td className="hidden px-5 py-3.5 md:table-cell">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-cream px-2.5 py-[2px] text-[11px] font-medium text-ink-mid">
                          <GitBranch className="h-3 w-3" />
                          {email.sequence_name}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[12px] text-ink-light">{timeAgo(email.sent_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal: view sent email */}
      {selectedEmail && (
        <>
          <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px]" onClick={() => setSelectedEmail(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] border border-edge bg-surface shadow-xl overflow-hidden max-h-[85vh] flex flex-col animate-fade-up">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-edge px-6 py-5">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-light text-[12px] font-bold text-sage">
                  {selectedEmail.lead_name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-ink truncate">{selectedEmail.lead_name}</p>
                  <p className="text-[12px] text-ink-mid truncate">{selectedEmail.lead_email}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {selectedEmail.company && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-light">
                        <Building2 className="h-3 w-3" />
                        {selectedEmail.company}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-light">
                      <Calendar className="h-3 w-3" />
                      {new Date(selectedEmail.sent_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="cursor-pointer shrink-0 rounded-[8px] p-2 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </div>
            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Subject</p>
                <p className="mt-1 text-[14px] font-semibold text-ink">{selectedEmail.subject || "(No subject)"}</p>
              </div>
              {selectedEmail.sequence_name && (
                <div className="mb-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-cream px-2.5 py-[3px] text-[11px] font-medium text-ink-mid">
                    <GitBranch className="h-3 w-3" />
                    {selectedEmail.sequence_name}
                  </span>
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light mb-2">Body</p>
                {selectedEmail.is_html ? (
                  <iframe
                    srcDoc={`<style>*{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif!important}body{margin:0;padding:12px;font-size:13px;line-height:1.7;color:${theme === "dark" ? "#EDE9E4" : "#2C2925"};background:${theme === "dark" ? "#1F272E" : "#ffffff"}}</style>` + selectedEmail.body}
                    sandbox="allow-same-origin"
                    className="w-full rounded-[10px] border border-edge bg-surface"
                    style={{ border: "1px solid var(--color-edge)", minHeight: 200 }}
                    onLoad={(e) => {
                      const iframe = e.currentTarget;
                      const doc = iframe.contentDocument;
                      if (doc) iframe.style.height = Math.min(doc.documentElement.scrollHeight + 8, 400) + "px";
                    }}
                  />
                ) : (
                  <div className="rounded-[10px] border border-edge bg-cream/30 px-4 py-3">
                    <p className="whitespace-pre-wrap text-[13px] leading-[1.7] text-ink-mid">
                      {selectedEmail.body || "(No body)"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
