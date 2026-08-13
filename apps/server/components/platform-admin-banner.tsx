"use client"

import { useRouter } from "next/navigation"
import { ShieldAlert, LogOut } from "lucide-react"
import { useT } from "@/lib/i18n"
import { useExitPlatformOrganization } from "@/lib/queries"

/**
 * Shown above the regular app chrome while a platform_admin has "entered"
 * an organization (see platform-context-store.ts) — a persistent reminder
 * that content actions here happen with full owner-equivalent access, not
 * as a real member. "Exit" clears the pointer and returns to the platform
 * organization list.
 */
export function PlatformAdminBanner({
  organizationName,
}: {
  organizationName: string
}) {
  const { t } = useT()
  const router = useRouter()
  const exitOrg = useExitPlatformOrganization()

  async function handleExit() {
    await exitOrg.mutateAsync()
    router.push("/platform/organizations")
  }

  return (
    <div className="sticky top-[var(--nav-h)] z-30 flex items-center gap-3 border-b border-primary/30 bg-primary/15 px-4 py-2 text-[13px] text-foreground">
      <ShieldAlert className="size-4 shrink-0 text-primary" />
      <span className="flex-1">
        {t("platform_admin_banner.label", { name: organizationName })}
      </span>
      <button
        type="button"
        onClick={handleExit}
        disabled={exitOrg.isPending}
        className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="size-3.5" />
        {t("platform_admin_banner.exit")}
      </button>
    </div>
  )
}
