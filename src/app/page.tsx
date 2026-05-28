"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  GitBranch,
  Send,
  CheckCircle,
  Clock,
  MessageSquare,
  UserCheck,
  ArrowRight,
  UserPlus,
  Loader2,
  Mail,
  Building2,
  Zap,
  TrendingUp,
  BarChart3,
} from "lucide-react";

interface DashboardData {
  totals: {
    leads: number;
    sequences: number;
    sentEmails: number;
    activeEnrollments: number;
    pendingApprovals: number;
  };
  statusCounts: Record<string, number>;
  actionCounts: Record<string, number>;
  seqStatusCounts: Record<string, number>;
  dailySent: { date: string; count: number }[];
  recentSent: {
    id: string;
    lead_name: string;
    lead_email: string;
    company: string;
    subject: string;
    sequence_name: string;
    sent_at: string;
  }[];
  recentLeads: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    company: string | null;
    status: string;
    created_at: string;
  }[];
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: "text-copper", bg: "bg-copper-light" },
  contacted: { label: "Contacted", color: "text-amber", bg: "bg-amber-light" },
  replied: { label: "Replied", color: "text-sage", bg: "bg-sage-light" },
  engaged: { label: "Engaged", color: "text-sage", bg: "bg-sage-light" },
  qualified: { label: "Qualified", color: "text-copper", bg: "bg-copper-light" },
  won: { label: "Won", color: "text-sage", bg: "bg-sage-light" },
  lost: { label: "Lost", color: "text-rose", bg: "bg-rose-light" },
  nurture: { label: "Nurture", color: "text-amber", bg: "bg-amber-light" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function shortDay(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString([], { weekday: "short" });
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d && d.totals ? d : null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center gap-3 md:min-h-screen">
        <div className="flex flex-col items-center gap-3 animate-fade-up">
          <Loader2 className="h-6 w-6 animate-spin text-copper" />
          <p className="text-[13px] text-ink-mid">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col items-center justify-center px-4 md:min-h-screen">
        <div className="flex flex-col items-center gap-4 text-center animate-fade-up">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-deep">
            <Zap className="h-6 w-6 text-ink-light" />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-ink">Nothing here yet</p>
            <p className="mt-1 text-[13px] text-ink-mid">Add your first lead or sequence to get started.</p>
          </div>
          <Link
            href="/leads"
            className="inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-2.5 text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover"
          >
            <UserPlus className="h-4 w-4" />
            Add Your First Lead
          </Link>
        </div>
      </div>
    );
  }

  const { totals, statusCounts, actionCounts, dailySent, recentSent, recentLeads, seqStatusCounts } = data;
  const maxDailySent = Math.max(...dailySent.map((d) => d.count), 1);
  const totalActions = Object.values(actionCounts).reduce((a, b) => a + b, 0);

  const pipelineStatuses = ["new", "contacted", "replied", "engaged", "qualified", "won"];
  const pipelineTotal = pipelineStatuses.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0) || 1;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-12">

        {/* Header — greeting card; page title shown in mobile top bar */}
        <div className="mb-5 animate-fade-up sm:mb-8">
          <div className="rounded-[16px] border border-edge bg-surface px-4 py-4 shadow-xs sm:rounded-[18px] sm:px-7 sm:py-6">
            <div className="flex flex-col gap-4">
              {/* Greeting + date */}
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-copper/10 sm:h-12 sm:w-12 sm:rounded-[14px]">
                  <Zap className="h-[18px] w-[18px] text-copper sm:h-[22px] sm:w-[22px]" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-[family-name:var(--font-display)] text-[18px] font-extrabold tracking-[-0.03em] text-ink sm:text-[24px]">
                    {greeting}
                  </h1>
                  <p className="mt-0.5 truncate text-[11px] text-ink-light sm:text-[13px]">{todayLabel}</p>
                </div>
              </div>

              {/* Badges + CTA */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {totals.pendingApprovals > 0 && (
                  <Link
                    href="/approval"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-amber/30 bg-amber-light px-3 py-2 text-[12px] font-semibold text-amber transition-all hover:border-amber/50 hover:bg-amber/10 sm:w-auto sm:py-[7px]"
                  >
                    <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                    {totals.pendingApprovals} pending approval{totals.pendingApprovals !== 1 ? "s" : ""}
                  </Link>
                )}
                {totalActions > 0 && (
                  <Link
                    href="/leads"
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-rose/25 bg-rose-light px-3 py-2 text-[12px] font-semibold text-rose transition-all hover:border-rose/40 hover:bg-rose/10 sm:w-auto sm:py-[7px]"
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    {totalActions} need{totalActions === 1 ? "s" : ""} action
                  </Link>
                )}
                <Link
                  href="/leads"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-[9px] bg-copper px-4 py-2 text-[12px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover active:scale-[0.98] sm:w-auto sm:py-[7px]"
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0" />
                  Add Lead
                </Link>
              </div>
            </div>

            {/* Stats row — 2 cols on mobile, 3 on tablet, 5 on desktop */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-edge pt-4 sm:mt-5 sm:grid-cols-3 sm:gap-3 sm:pt-5 lg:grid-cols-5 lg:gap-4">
              {[
                { label: "Leads", value: totals.leads, href: "/leads" },
                { label: "Sequences", value: totals.sequences, href: "/sequences" },
                { label: "Emails Sent", value: totals.sentEmails, href: "/inbox" },
                { label: "Enrollments", value: totals.activeEnrollments, href: "/sequences" },
                { label: "Pending", value: totals.pendingApprovals, href: "/approval" },
              ].map((s) => (
                <Link key={s.label} href={s.href} className="group rounded-[10px] px-1 py-1 text-center transition-colors hover:bg-cream/60 sm:rounded-none sm:px-0 sm:py-0 sm:hover:bg-transparent">
                  <p className="font-[family-name:var(--font-display)] text-[20px] font-extrabold tracking-[-0.04em] text-ink transition-colors group-hover:text-copper sm:text-[22px] lg:text-[26px]">
                    {s.value}
                  </p>
                  <p className="mt-0.5 text-[9px] font-medium text-ink-light sm:text-[11px]">{s.label}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Pipeline + Sending activity ── */}
        <div className="grid grid-cols-1 gap-4 animate-fade-up lg:grid-cols-2 lg:gap-5" style={{ animationDelay: "100ms" }}>

          {/* Pipeline */}
          <div className="rounded-[14px] border border-edge bg-surface p-4 shadow-xs sm:rounded-[16px] sm:p-6">
            <div className="mb-4 flex items-center justify-between sm:mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-copper" />
                <h2 className="text-[14px] font-bold text-ink">Lead Pipeline</h2>
              </div>
              <Link href="/leads" className="text-[11px] font-semibold text-copper hover:underline">
                View all
              </Link>
            </div>

            {/* Pipeline bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-cream-deep">
              {pipelineStatuses.map((s) => {
                const count = statusCounts[s] ?? 0;
                if (!count) return null;
                const meta = STATUS_META[s];
                const pct = (count / pipelineTotal) * 100;
                const colorMap: Record<string, string> = {
                  new: "bg-copper/70",
                  contacted: "bg-amber/60",
                  replied: "bg-sage/60",
                  engaged: "bg-sage",
                  qualified: "bg-copper",
                  won: "bg-sage",
                };
                return (
                  <div
                    key={s}
                    className={`h-full transition-all ${colorMap[s] ?? "bg-ink-faint"}`}
                    style={{ width: `${pct}%` }}
                    title={`${meta.label}: ${count}`}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3 sm:gap-x-4">
              {pipelineStatuses.map((s) => {
                const count = statusCounts[s] ?? 0;
                const meta = STATUS_META[s];
                return (
                  <div key={s} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${meta.bg} border ${meta.color.replace("text-", "border-")}/30`} />
                      <span className="text-[12px] text-ink-mid">{meta.label}</span>
                    </div>
                    <span className="text-[12px] font-bold text-ink">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Action needed */}
            {totalActions > 0 && (
              <div className="mt-4 border-t border-edge pt-4 sm:mt-5">
                <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-light">Action Needed</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {actionCounts.needs_reply ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-light px-3 py-1">
                      <MessageSquare className="h-3 w-3 text-amber" />
                      <span className="text-[11px] font-semibold text-amber">{actionCounts.needs_reply} needs reply</span>
                    </div>
                  ) : null}
                  {actionCounts.waiting_for_reply ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-cream-deep px-3 py-1">
                      <Clock className="h-3 w-3 text-ink-mid" />
                      <span className="text-[11px] font-semibold text-ink-mid">{actionCounts.waiting_for_reply} waiting</span>
                    </div>
                  ) : null}
                  {actionCounts.needs_human ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-rose-light px-3 py-1">
                      <UserCheck className="h-3 w-3 text-rose" />
                      <span className="text-[11px] font-semibold text-rose">{actionCounts.needs_human} needs human</span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* Sending activity chart */}
          <div className="rounded-[14px] border border-edge bg-surface p-4 shadow-xs sm:rounded-[16px] sm:p-6">
            <div className="mb-4 flex items-center justify-between sm:mb-5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-sage" />
                <h2 className="text-[14px] font-bold text-ink">Emails Sent</h2>
              </div>
              <span className="text-[11px] text-ink-light">Last 7 days</span>
            </div>

            {/* Bar chart */}
            <div className="flex items-end gap-1.5 sm:gap-3" style={{ height: 120 }}>
              {dailySent.map((d) => {
                const barHeight = d.count > 0 ? Math.max((d.count / maxDailySent) * 90, 6) : 3;
                const isToday = d.date === new Date().toISOString().slice(0, 10);
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
                    {d.count > 0 && (
                      <span className="mb-1.5 text-[11px] font-bold text-ink">{d.count}</span>
                    )}
                    <div
                      className={`w-full max-w-[32px] rounded-t-[6px] sm:max-w-[40px] sm:rounded-t-[8px] ${
                        isToday ? "bg-copper" : d.count > 0 ? "bg-sage/40" : "bg-edge"
                      }`}
                      style={{ height: barHeight }}
                    />
                    <span className={`mt-1.5 text-[10px] sm:mt-2 sm:text-[11px] ${isToday ? "font-bold text-copper" : "font-medium text-ink-light"}`}>
                      {shortDay(d.date)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Weekly total */}
            <div className="mt-4 flex items-center justify-between border-t border-edge pt-4">
              <span className="text-[12px] text-ink-mid">Weekly total</span>
              <span className="text-[16px] font-bold text-ink">
                {dailySent.reduce((a, d) => a + d.count, 0)}
              </span>
            </div>

            {/* Sequence breakdown */}
            {(seqStatusCounts.active || seqStatusCounts.completed) && (
              <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                {seqStatusCounts.active ? (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-sage" />
                    <span className="text-[11px] text-ink-mid">{seqStatusCounts.active} active sequences</span>
                  </div>
                ) : null}
                {seqStatusCounts.completed ? (
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-copper" />
                    <span className="text-[11px] text-ink-mid">{seqStatusCounts.completed} completed</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent sent + Recent leads ── */}
        <div className="mt-5 grid grid-cols-1 gap-4 animate-fade-up lg:mt-8 lg:grid-cols-[1.2fr_1fr] lg:gap-5" style={{ animationDelay: "140ms" }}>

          {/* Recent sent emails */}
          <div className="overflow-hidden rounded-[14px] border border-edge bg-surface shadow-xs sm:rounded-[16px]">
            <div className="flex items-center justify-between border-b border-edge px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-sage" />
                <h2 className="text-[14px] font-bold text-ink">Recent Emails</h2>
              </div>
              <Link href="/inbox" className="text-[11px] font-semibold text-copper hover:underline">
                View inbox
              </Link>
            </div>
            {recentSent.length > 0 ? (
              <div className="divide-y divide-edge">
                {recentSent.map((e) => (
                  <div key={e.id} className="px-4 py-3 transition-colors hover:bg-cream/40 sm:px-6 sm:py-3.5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sage-light">
                        <Mail className="h-4 w-4 text-sage" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-ink">{e.lead_name}</p>
                          <p className="shrink-0 text-[10px] text-ink-light sm:hidden">{timeAgo(e.sent_at)}</p>
                        </div>
                        <p className="truncate text-[12px] text-ink-mid">{e.subject || "(No subject)"}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {e.company && (
                            <span className="inline-flex max-w-full items-center gap-1 text-[10px] text-ink-light">
                              <Building2 className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{e.company}</span>
                            </span>
                          )}
                          <span className="truncate text-[10px] text-ink-faint sm:hidden">{e.sequence_name}</span>
                        </div>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block">
                        <p className="text-[10px] text-ink-light">{timeAgo(e.sent_at)}</p>
                        <p className="mt-0.5 max-w-[100px] truncate text-[9px] text-ink-faint">{e.sequence_name}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-deep">
                  <Send className="h-5 w-5 text-ink-light" />
                </div>
                <p className="mt-3 text-[13px] font-semibold text-ink">No emails sent yet</p>
                <p className="mt-1 text-[12px] text-ink-mid">Approved emails will appear here.</p>
              </div>
            )}
          </div>

          {/* Recent leads */}
          <div className="overflow-hidden rounded-[14px] border border-edge bg-surface shadow-xs sm:rounded-[16px]">
            <div className="flex items-center justify-between border-b border-edge px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-copper" />
                <h2 className="text-[14px] font-bold text-ink">Recent Leads</h2>
              </div>
              <Link href="/leads" className="text-[11px] font-semibold text-copper hover:underline">
                View all
              </Link>
            </div>
            {recentLeads.length > 0 ? (
              <div className="divide-y divide-edge">
                {recentLeads.map((l) => {
                  const name = `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || l.email;
                  const meta = STATUS_META[l.status] ?? STATUS_META.new;
                  return (
                    <div key={l.id} className="px-4 py-3 transition-colors hover:bg-cream/40 sm:px-6 sm:py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-copper-light font-[family-name:var(--font-display)] text-[11px] font-bold text-copper">
                          {name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
                            <span className={`shrink-0 rounded-full px-2 py-[2px] text-[9px] font-bold uppercase sm:hidden ${meta.bg} ${meta.color}`}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="truncate text-[12px] text-ink-mid">
                            {l.company ?? l.email}
                          </p>
                          <p className="mt-1 text-[10px] text-ink-light sm:hidden">{timeAgo(l.created_at)}</p>
                        </div>
                        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                          <span className={`inline-block rounded-full px-2 py-[2px] text-[9px] font-bold uppercase ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-ink-light">{timeAgo(l.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-deep">
                  <Users className="h-5 w-5 text-ink-light" />
                </div>
                <p className="mt-3 text-[13px] font-semibold text-ink">No leads yet</p>
                <p className="mt-1 text-[12px] text-ink-mid">Add your first contact to get started.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Quick actions ── */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 animate-fade-up sm:grid-cols-3 sm:gap-3 lg:mt-8 lg:gap-4" style={{ animationDelay: "180ms" }}>
          <Link
            href="/leads"
            className="group flex min-h-[56px] items-center justify-between rounded-[12px] border border-edge bg-surface px-4 py-3 shadow-xs transition-all hover:border-copper-muted hover:shadow-sm sm:min-h-[64px] sm:rounded-[14px] sm:px-5 sm:py-4"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-[8px] bg-copper-light p-2.5">
                <UserPlus className="h-4 w-4 text-copper" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">Add Lead</p>
                <p className="text-[11px] text-ink-mid">New pipeline contact</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-faint transition-colors group-hover:text-copper" />
          </Link>

          <Link
            href="/sequences"
            className="group flex min-h-[56px] items-center justify-between rounded-[12px] border border-edge bg-surface px-4 py-3 shadow-xs transition-all hover:border-sage-muted hover:shadow-sm sm:min-h-[64px] sm:rounded-[14px] sm:px-5 sm:py-4"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-[8px] bg-sage-light p-2.5">
                <GitBranch className="h-4 w-4 text-sage" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">New Sequence</p>
                <p className="text-[11px] text-ink-mid">Create email cadence</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-faint transition-colors group-hover:text-sage" />
          </Link>

          <Link
            href="/approval"
            className="group flex min-h-[56px] items-center justify-between rounded-[12px] border border-edge bg-surface px-4 py-3 shadow-xs transition-all hover:border-amber/20 hover:shadow-sm sm:min-h-[64px] sm:rounded-[14px] sm:px-5 sm:py-4"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-[8px] bg-amber-light p-2.5">
                <CheckCircle className="h-4 w-4 text-amber" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-ink">Review Approvals</p>
                <p className="text-[11px] text-ink-mid">
                  {totals.pendingApprovals > 0 ? `${totals.pendingApprovals} pending` : "All clear"}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-faint transition-colors group-hover:text-amber" />
          </Link>
        </div>

    </div>
  );
}
