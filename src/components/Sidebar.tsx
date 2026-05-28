"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Settings, Zap, GitBranch, FolderOpen, CheckCircle, Brain, Inbox, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
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

export function MobileNav() {
  const path = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryNav = nav.filter((item) =>
    ["/", "/leads", "/sequences", "/approval", "/inbox"].includes(item.href)
  );
  const secondaryNav = nav.filter((item) =>
    ["/groups", "/training", "/settings"].includes(item.href)
  );
  const moreActive = secondaryNav.some((item) => path.startsWith(item.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-lg backdrop-blur md:hidden">
      {moreOpen && (
        <div className="absolute inset-x-3 bottom-[calc(100%+8px)] rounded-[18px] border border-edge bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-light">
              More
            </p>
            <ThemeToggle />
          </div>
          <div className="grid gap-1">
            {secondaryNav.map((item) => {
              const active = path.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={clsx(
                    "flex items-center gap-3 rounded-[12px] px-3 py-3 text-[13px] font-semibold transition-colors",
                    active ? "bg-copper-light text-copper" : "text-ink-mid hover:bg-cream hover:text-ink"
                  )}
                >
                  <item.icon className="h-4 w-4" strokeWidth={active ? 2.3 : 1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-6 gap-1">
        {primaryNav.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-1.5 text-[10px] font-semibold transition-colors",
                active ? "bg-copper-light text-copper" : "text-ink-light hover:bg-cream hover:text-ink-mid"
              )}
            >
              <item.icon className="h-4 w-4" strokeWidth={active ? 2.3 : 1.8} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className={clsx(
            "flex flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-1.5 text-[10px] font-semibold transition-colors",
            moreActive || moreOpen ? "bg-copper-light text-copper" : "text-ink-light hover:bg-cream hover:text-ink-mid"
          )}
          aria-expanded={moreOpen}
          aria-label="Open more navigation"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={moreActive || moreOpen ? 2.3 : 1.8} />
          <span className="max-w-full truncate">More</span>
        </button>
      </div>
    </nav>
  );
}

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const path = usePathname();

  return (
    <aside
      className={clsx(
        "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-edge bg-surface transition-[width] duration-300 ease-in-out md:flex",
        collapsed ? "w-[84px]" : "w-[272px]"
      )}
    >
      {/* Brand */}
      <div
        className={clsx(
          "flex gap-3 pt-8 transition-all duration-300 ease-in-out",
          collapsed ? "flex-col items-center px-3 pb-6" : "items-center px-5 pb-10"
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-copper shadow-copper">
            <Zap className="h-[18px] w-[18px] text-white" strokeWidth={2.5} />
          </div>
          <div
            className={clsx(
              "min-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out",
              collapsed ? "w-0 opacity-0" : "w-[150px] opacity-100 delay-100"
            )}
          >
            <p className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[-0.01em] text-ink">
              Agent Outreach
            </p>
            <p className="text-[11px] text-ink-light">Outreach Platform</p>
          </div>
        </div>

        <button
          onClick={onToggle}
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-edge bg-cream text-ink-light transition-all duration-200 hover:border-edge-strong hover:bg-cream-deep hover:text-ink"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav
        className={clsx(
          "flex flex-1 flex-col gap-1 transition-[padding] duration-300 ease-in-out",
          collapsed ? "px-3" : "px-4"
        )}
      >
        <p
          className={clsx(
            "mb-3 overflow-hidden whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-light transition-all duration-200 ease-in-out",
            collapsed ? "h-0 opacity-0" : "h-4 opacity-100 delay-100"
          )}
        >
          Navigation
        </p>
        {nav.map((item) => {
          const active =
            item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                "flex cursor-pointer items-center rounded-[10px] px-3 py-[10px] text-[13px] font-medium transition-all duration-200",
                collapsed ? "justify-center gap-0" : "gap-3",
                active
                  ? "bg-copper-light text-copper"
                  : "text-ink-mid hover:bg-cream hover:text-ink"
              )}
            >
              <item.icon
                className="h-[18px] w-[18px]"
                strokeWidth={active ? 2.2 : 1.6}
              />
              <span
                className={clsx(
                  "overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out",
                  collapsed ? "w-0 opacity-0" : "w-[150px] opacity-100 delay-100"
                )}
              >
                {item.label}
              </span>
              {active && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-copper" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={clsx(
          "pb-6 transition-[padding] duration-300 ease-in-out",
          collapsed ? "px-3" : "px-5"
        )}
      >
        <div
          className={clsx(
            "flex items-center rounded-[10px] bg-cream py-3 transition-all duration-300 ease-in-out",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          <p
            className={clsx(
              "overflow-hidden whitespace-nowrap text-[11px] font-medium text-ink-light transition-all duration-200 ease-in-out",
              collapsed ? "w-0 opacity-0" : "w-12 opacity-100 delay-100"
            )}
          >
            v0.1.0
          </p>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
