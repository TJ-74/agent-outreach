"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";
import Sidebar, { MobileNav } from "@/components/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/sequences": "Sequences",
  "/approval": "Approval",
  "/inbox": "Inbox",
  "/groups": "Groups",
  "/training": "AI Training",
  "/settings": "Settings",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const showSidebar = path !== "/home";
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("main-sidebar-collapsed");
    setSidebarCollapsed(stored === "true");
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("main-sidebar-collapsed", String(next));
      return next;
    });
  };

  const pageTitle =
    Object.entries(PAGE_TITLES)
      .filter(([href]) => href !== "/")
      .find(([href]) => path.startsWith(href))?.[1] ??
    (path === "/" ? "Dashboard" : "");

  return (
    <>
      {showSidebar && (
        <>
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

          {/* Mobile top bar */}
          <header className="fixed inset-x-0 top-0 z-40 flex h-[52px] items-center justify-between border-b border-edge bg-surface/95 px-4 backdrop-blur-sm md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-copper shadow-copper">
                <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-[family-name:var(--font-display)] text-[15px] font-bold tracking-[-0.01em] text-ink">
                {pageTitle}
              </span>
            </div>
            <ThemeToggle />
          </header>

          <MobileNav />
        </>
      )}
      <main
        className={
          showSidebar
            ? `${sidebarCollapsed ? "md:ml-[84px]" : "md:ml-[272px]"} min-h-screen bg-cream pb-20 pt-[52px] transition-[margin-left] duration-300 ease-in-out md:pb-0 md:pt-0`
            : "min-h-screen bg-cream"
        }
      >
        {children}
      </main>
    </>
  );
}
