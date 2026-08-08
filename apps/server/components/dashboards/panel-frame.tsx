import type { ReactNode } from "react"
import { useT } from "@/lib/i18n"

export function PanelFrame({
  title,
  description,
  loading = false,
  error,
  children,
}: {
  title: string
  description?: string
  loading?: boolean
  error?: string
  children?: ReactNode
}) {
  const { t } = useT()
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card p-4">
      <div className="mb-3 shrink-0 overflow-hidden lg:h-20">
        <h2 className="font-semibold text-card-foreground">{title}</h2>
        {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {error && <p className="text-sm text-destructive">{t("panels.load_error", { error })}</p>}
      {!error && loading && <p className="text-sm text-muted-foreground">{t("panels.loading")}</p>}
      {!error && !loading && children}
    </section>
  )
}
