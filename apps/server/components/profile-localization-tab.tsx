"use client"

import { LocaleSwitcher } from "@/components/locale-switcher"
import { useT } from "@/lib/i18n"

export function LocalizationTab() {
  const { t } = useT()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t("profile.localization")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("profile.localization_description")}
        </p>
      </div>
      <LocaleSwitcher />
    </div>
  )
}
