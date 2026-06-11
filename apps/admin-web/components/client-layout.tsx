"use client";

import { ThemeProvider } from "@/components/theme-provider";
import { Nav } from "@/components/nav";
import { AdminSidebar } from "@/components/admin-sidebar";
import { QueryProvider } from "@/components/query-provider";
import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { X } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useCurrentUser } from "@/hooks/use-current-user";

function SiteBanner() {
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/settings/messages")
      .then((r) => r.json())
      .then((d: { banner_message: string | null; banner_message_enabled: boolean }) => {
        if (d.banner_message_enabled && d.banner_message) {
          const key = `banner-dismissed:${d.banner_message}`;
          if (!sessionStorage.getItem(key)) setMessage(d.banner_message);
        }
      })
      .catch(() => {});
  }, []);

  if (!message || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem(`banner-dismissed:${message}`, "1");
    setDismissed(true);
  }

  return (
    <div className="sticky top-[var(--nav-h)] z-30 flex items-start gap-3 bg-primary/10 border-b border-primary/20 px-4 py-2.5 text-[13px] text-foreground">
      <span className="flex-1 whitespace-pre-wrap">{message}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fermer"
        className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

/** Redirects to /login unless the current user has the platform_admin role. */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isPending } = useSession();
  const user = useCurrentUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || isPending) return;
    if (!data?.user || user?.role !== "platform_admin") {
      router.replace("/login");
    }
  }, [mounted, isPending, data, user, router]);

  if (!mounted || isPending || !data?.user || user?.role !== "platform_admin") return null;

  return <>{children}</>;
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((collapsed) => {
      const next = !collapsed;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const content = (
    <QueryProvider>
      <ThemeProvider>
        {!isLogin && <Nav onToggleSidebar={() => setSidebarOpen((v) => !v)} />}
        {!isLogin && (
          <AdminSidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapsed}
          />
        )}
        <main
          className={
            isLogin
              ? ""
              : `mt-[var(--nav-h)] min-h-[calc(100vh-var(--nav-h))] transition-[margin-left] duration-200 ${
                  sidebarCollapsed ? "md:ml-[var(--sidebar-w-collapsed,56px)]" : "md:ml-[var(--sidebar-w)]"
                }`
          }
        >
          {!isLogin && <SiteBanner />}
          {children}
        </main>
        <Toaster richColors position="bottom-right" />
      </ThemeProvider>
    </QueryProvider>
  );

  if (isLogin) return content;

  return <RequireAdmin>{content}</RequireAdmin>;
}
