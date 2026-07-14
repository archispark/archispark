"use client"

import { Eye, EyeOff, Copy, Check } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { type ApiTokenCreatedOut } from "@/lib/api"

export function TokenRevealCard({
  created,
  visible,
  onToggleVisible,
  copiedId,
  onCopy,
}: {
  created: ApiTokenCreatedOut
  visible: boolean
  onToggleVisible: () => void
  copiedId: number | string | null
  onCopy: (value: string, id: number | string) => void
}) {
  const maskedToken =
    created.token.slice(0, 8) + "•".repeat(24) + created.token.slice(-8)

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
      <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
        Copiez ce token maintenant — il ne sera plus affiché.
      </p>
      <div className="relative">
        <Input
          readOnly
          value={visible ? created.token : maskedToken}
          className="bg-white pr-16 font-mono text-xs dark:bg-black/20"
        />
        <div className="absolute top-1/2 right-1 flex -translate-y-1/2 gap-0.5">
          <button
            type="button"
            onClick={onToggleVisible}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground"
            title={visible ? "Masquer" : "Afficher"}
          >
            {visible ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onCopy(created.token, "new")}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground"
            title="Copier"
          >
            {copiedId === "new" ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        </div>
      </div>
      <div className="rounded border border-border bg-muted/60 px-3 py-2">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          Configuration Claude Code
        </p>
        <code className="text-[11px] break-all text-foreground">
          {`claude mcp add archimate-vercel ${process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? "https://archispark-mcp-server.vercel.app/mcp/"} --transport http --header "Authorization: Bearer ${created.token}"`}
        </code>
      </div>
    </div>
  )
}
