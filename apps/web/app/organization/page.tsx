"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { useIsOrgOwner } from "@/hooks/use-organization";
import { OrganizationSettings } from "@/components/organization-settings";
import { WorkspaceSettings } from "@/components/workspace-settings";

type Tab = "workspace" | "members";

export default function OrganizationPage() {
  return (
    <Suspense>
      <OrganizationPageInner />
    </Suspense>
  );
}

function OrganizationPageInner() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "members";
  const isOrgOwner = useIsOrgOwner();

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{t("nav.organization")}</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">
          {t("organization.desc")}
        </p>
      </div>

      {isOrgOwner ? (
        <>
          {tab === "workspace" && <WorkspaceSettings />}
          {tab === "members" && <OrganizationSettings />}
        </>
      ) : (
        <div className="text-muted-foreground text-sm">{t("organization.no_access")}</div>
      )}
    </div>
  );
}
