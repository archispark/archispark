"use client";

import { ShieldAlert, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Platform admins manage organizations from admin-web and have no access to
 * tenant data — shown instead of the workspace UI when a platform_admin
 * session reaches apps/web.
 */
export function PlatformAdminBlock() {
  const { t } = useT();

  function logout() {
    window.location.href = "/api/auth/logout";
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <ShieldAlert className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t("platform_admin_block.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("platform_admin_block.desc")}</p>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          <LogOut className="size-4" />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );
}
