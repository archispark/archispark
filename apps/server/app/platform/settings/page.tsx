"use client"

import { useEffect, useState } from "react"
import { Settings2 } from "lucide-react"
import { toast } from "sonner"
import { useT } from "@/lib/i18n"
import { useSiteMessages, useUpdateSiteMessages } from "@/lib/queries"
import { Button } from "@workspace/ui/components/button"

/**
 * platform_admin-only — general instance-wide properties. Reachable
 * regardless of active-organization state, same as
 * apps/server/app/platform/organizations/page.tsx (see client-layout.tsx).
 */
export default function PlatformSettingsPage() {
  const { t } = useT()
  const { data, isLoading } = useSiteMessages()
  const update = useUpdateSiteMessages()

  const [loginEnabled, setLoginEnabled] = useState(false)
  const [loginMessage, setLoginMessage] = useState("")
  const [bannerEnabled, setBannerEnabled] = useState(false)
  const [bannerMessage, setBannerMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setLoginEnabled(data.login_message_enabled)
    setLoginMessage(data.login_message ?? "")
    setBannerEnabled(data.banner_message_enabled)
    setBannerMessage(data.banner_message ?? "")
  }, [data])

  const dirty =
    !!data &&
    (loginEnabled !== data.login_message_enabled ||
      loginMessage !== (data.login_message ?? "") ||
      bannerEnabled !== data.banner_message_enabled ||
      bannerMessage !== (data.banner_message ?? ""))

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await update.mutateAsync({
        login_message: loginMessage.trim() || null,
        login_message_enabled: loginEnabled,
        banner_message: bannerMessage.trim() || null,
        banner_message_enabled: bannerEnabled,
      })
      toast.success(t("platform.settings.saved"))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl p-7">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Settings2 className="size-5 text-primary" />
          {t("platform.settings.title")}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {t("platform.settings.desc")}
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2 rounded-lg border border-border p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={loginEnabled}
                onChange={(e) => setLoginEnabled(e.target.checked)}
                className="shrink-0 rounded"
              />
              {t("platform.settings.login_message_enabled")}
            </label>
            <p className="text-[12px] text-muted-foreground">
              {t("platform.settings.login_message_desc")}
            </p>
            <textarea
              value={loginMessage}
              onChange={(e) => setLoginMessage(e.target.value)}
              rows={3}
              placeholder={t("platform.settings.login_message_placeholder")}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={bannerEnabled}
                onChange={(e) => setBannerEnabled(e.target.checked)}
                className="shrink-0 rounded"
              />
              {t("platform.settings.banner_message_enabled")}
            </label>
            <p className="text-[12px] text-muted-foreground">
              {t("platform.settings.banner_message_desc")}
            </p>
            <textarea
              value={bannerMessage}
              onChange={(e) => setBannerMessage(e.target.value)}
              rows={3}
              placeholder={t("platform.settings.banner_message_placeholder")}
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      )}
    </div>
  )
}
