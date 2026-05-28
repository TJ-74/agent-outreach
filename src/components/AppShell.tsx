"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar, { MobileNav } from "@/components/Sidebar";

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

  return (
    <>
      {showSidebar && (
        <>
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          <MobileNav />
        </>
      )}
      <main
        className={
          showSidebar
            ? `${sidebarCollapsed ? "md:ml-[84px]" : "md:ml-[272px]"} min-h-screen bg-cream pb-20 transition-[margin-left] duration-300 ease-in-out md:pb-0`
            : "min-h-screen bg-cream"
        }
      >
        {children}
      </main>
    </>
  );
}
