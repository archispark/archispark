"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";
import { Sidebar } from "@/components/sidebar";
import { useState } from "react";
import { usePathname } from "next/navigation";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <ThemeProvider>
      {!isLogin && <Nav onToggleSidebar={() => setSidebarOpen((v) => !v)} />}
      {!isLogin && <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
      <main className={isLogin ? "" : "mt-[var(--nav-h)] md:ml-[var(--sidebar-w)] min-h-[calc(100vh-var(--nav-h))]"}>
        {children}
      </main>
    </ThemeProvider>
  );
}
