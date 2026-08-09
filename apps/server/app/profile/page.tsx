"use client"

import { useState } from "react"
import { InfoTab } from "@/components/profile-info-tab"
import { LocalizationTab } from "@/components/profile-localization-tab"
import { TokensTab } from "@/components/profile-tokens-tab"
import { useT } from "@/lib/i18n"

type Tab = "info" | "localization" | "tokens"

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>("info")
  const { t } = useT()
  const tabs: { id: Tab; label: string }[] = [
    { id: "info", label: "Informations personnelles" },
    { id: "localization", label: t("profile.localization") },
    { id: "tokens", label: "Tokens API" },
  ]

  return (
    <div className="max-w-2xl p-7">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Mon profil</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Gérez vos informations personnelles et vos accès.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-0 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-[13px] transition-colors ${
              tab === t.id
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab />}
      {tab === "localization" && <LocalizationTab />}
      {tab === "tokens" && <TokensTab />}
    </div>
  )
}
