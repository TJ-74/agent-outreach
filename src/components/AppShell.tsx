"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const showSidebar = path !== "/home";

  return (
    <>
      {showSidebar && <Sidebar />}
      <main className={showSidebar ? "ml-[272px] min-h-screen bg-cream" : "min-h-screen bg-cream"}>
        {children}
      </main>
    </>
  );
}
