"use client";

import { useEffect } from "react";
import { useLeadStore } from "@/store/leads";
import { Users, UserPlus, MessageSquare, Clock, UserCheck, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Dashboard() {
  const leads = useLeadStore((s) => s.leads);
  const fetchLeads = useLeadStore((s) => s.fetchLeads);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const stats = [
    {
      label: "Total Leads",
      count: leads.length,
      icon: Users,
      color: "text-copper",
      bg: "bg-copper-light",
    },
    {
      label: "Needs Reply",
      count: leads.filter((l) => l.actionNeeded === "needs_reply").length,
      icon: MessageSquare,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "Waiting",
      count: leads.filter((l) => l.actionNeeded === "waiting_for_reply").length,
      icon: Clock,
      color: "text-slate-500",
      bg: "bg-slate-50",
    },
    {
      label: "Needs Human",
      count: leads.filter((l) => l.actionNeeded === "needs_human").length,
      icon: UserCheck,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <div className="mx-auto max-w-[960px] px-10 py-12">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-[family-name:var(--font-display)] text-[28px] font-extrabold tracking-[-0.03em] text-ink">
          Dashboard
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-mid">
          Your outreach pipeline at a glance.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className="animate-fade-up rounded-[16px] border border-edge bg-surface p-6 shadow-xs transition-all duration-200 hover:shadow-sm"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-mid">
                {s.label}
              </span>
              <div className={`rounded-[8px] p-[7px] ${s.bg}`}>
                <s.icon className={`h-[15px] w-[15px] ${s.color}`} strokeWidth={2} />
              </div>
            </div>
            <p className="mt-4 font-[family-name:var(--font-display)] text-[32px] font-extrabold tracking-[-0.04em] text-ink">
              {s.count}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-12">
        <h2 className="mb-5 font-[family-name:var(--font-display)] text-[16px] font-bold tracking-[-0.01em] text-ink">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/leads"
            className="group flex cursor-pointer items-center justify-between rounded-[16px] border border-edge bg-surface px-6 py-5 shadow-xs transition-all duration-200 hover:border-copper-muted hover:shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-[10px] bg-copper-light p-3">
                <UserPlus className="h-5 w-5 text-copper" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-ink">Add New Lead</p>
                <p className="mt-[2px] text-[13px] text-ink-mid">
                  Create a pipeline contact
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-faint transition-colors group-hover:text-copper" />
          </Link>

          <Link
            href="/leads"
            className="group flex cursor-pointer items-center justify-between rounded-[16px] border border-edge bg-surface px-6 py-5 shadow-xs transition-all duration-200 hover:border-sage-muted hover:shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-[10px] bg-sage-light p-3">
                <Users className="h-5 w-5 text-sage" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[14px] font-semibold text-ink">View All Leads</p>
                <p className="mt-[2px] text-[13px] text-ink-mid">
                  Browse &amp; manage contacts
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-faint transition-colors group-hover:text-sage" />
          </Link>
        </div>
      </div>

      {/* Empty */}
      {leads.length === 0 && (
        <div className="mt-14 flex flex-col items-center rounded-[20px] border border-dashed border-edge-strong bg-surface py-20">
          <div className="rounded-[14px] bg-copper-light p-5">
            <Users className="h-7 w-7 text-copper" strokeWidth={1.6} />
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">
            No leads yet
          </h3>
          <p className="mt-1.5 text-[13px] text-ink-mid">
            Head to the Leads page to add your first contact.
          </p>
          <Link
            href="/leads"
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-6 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover hover:shadow-copper active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" />
            Add Your First Lead
          </Link>
        </div>
      )}
    </div>
  );
}
