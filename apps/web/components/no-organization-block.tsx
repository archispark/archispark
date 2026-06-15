"use client";

import { Building2, LogOut } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * Shown instead of the workspace UI when an authenticated, non-admin session
 * has no organization membership (e.g. a Keycloak user created without being
 * invited to an organization) — every org-scoped API call would otherwise
 * 403, leaving the user staring at a raw error.
 */
export function NoOrganizationBlock() {
  const { t } = useT();

  function logout() {
    window.location.href = "/api/auth/logout";
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <Building2 className="mx-auto size-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{t("no_organization_block.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("no_organization_block.desc")}</p>
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
