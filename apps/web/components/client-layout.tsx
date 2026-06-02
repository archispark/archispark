"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";
import { Sidebar } from "@/components/sidebar";
import { QueryProvider } from "@/components/query-provider";
import { useState } from "react";
import { usePathname } from "next/navigation";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  // The workspaces overview is a full-width chrome-light page (no model context),
  // so it hides the sidebar — only the top nav stays.
  const hideSidebar = isLogin || pathname === "/workspaces";

  return (
    <QueryProvider>
      <ThemeProvider>
        {!isLogin && <Nav onToggleSidebar={() => setSidebarOpen((v) => !v)} />}
        {!hideSidebar && <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        <main className={isLogin ? "" : `mt-[var(--nav-h)] min-h-[calc(100vh-var(--nav-h))] ${hideSidebar ? "" : "md:ml-[var(--sidebar-w)]"}`}>
          {children}
        </main>
      </ThemeProvider>
    </QueryProvider>
  );
}
