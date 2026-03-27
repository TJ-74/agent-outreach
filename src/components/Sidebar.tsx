"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, Zap, GitBranch, FolderOpen, CheckCircle, Brain, Inbox } from "lucide-react";
import clsx from "clsx";
import ThemeToggle from "@/components/ThemeToggle";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/sequences", label: "Sequences", icon: GitBranch },
  { href: "/approval", label: "Approval", icon: CheckCircle },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/groups", label: "Groups", icon: FolderOpen },
  { href: "/training", label: "AI Training", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[272px] flex-col border-r border-edge bg-surface">
      {/* Brand */}
      <div className="flex items-center gap-3 px-7 pt-8 pb-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-copper shadow-copper">
          <Zap className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[-0.01em] text-ink">
            Agent Outreach
          </p>
          <p className="text-[11px] text-ink-light">Outreach Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-4">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-light">
          Navigation
        </p>
        {nav.map((item) => {
          const active =
            item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-[10px] text-[13px] font-medium transition-all duration-200",
                active
                  ? "bg-copper-light text-copper"
                  : "text-ink-mid hover:bg-cream hover:text-ink"
              )}
            >
              <item.icon
                className="h-[18px] w-[18px]"
                strokeWidth={active ? 2.2 : 1.6}
              />
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-copper" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 pb-6">
        <div className="flex items-center justify-between rounded-[10px] bg-cream px-4 py-3">
          <p className="text-[11px] font-medium text-ink-light">v0.1.0</p>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
