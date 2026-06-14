"use client";

import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useActiveOrganization, useOrganizations, useSetActiveOrganization } from "@/hooks/use-organization";
import { useT } from "@/lib/i18n";

export function OrgSwitcher() {
  const { t } = useT();
  const router = useRouter();
  const organizations = useOrganizations();
  const activeOrg = useActiveOrganization();
  const setActiveOrg = useSetActiveOrganization();

  if (organizations.length <= 1) return null;

  function handleSwitch(id: string) {
    if (id === activeOrg?.id) return;
    setActiveOrg(id);
    router.push("/workspaces");
  }

  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center gap-1.5 px-2 h-8 rounded-md text-[13px] font-medium text-foreground hover:bg-muted transition-colors max-w-[160px]"
        title={t("nav.organization")}
      >
        <Building2 className="size-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{activeOrg?.name ?? "—"}</span>
        <ChevronDown className="size-3 text-muted-foreground shrink-0" />
      </button>
      <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
        {organizations.map((org) => (
          <button
            key={org.id}
            type="button"
            onClick={() => handleSwitch(org.id)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted transition-colors text-left ${
              org.id === activeOrg?.id ? "text-primary font-semibold" : "text-foreground"
            }`}
          >
            {org.id === activeOrg?.id ? <Check className="size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
            <span className="truncate">{org.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
