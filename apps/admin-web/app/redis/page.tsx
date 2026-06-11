"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchRedisStatus, type RedisStatus } from "@/lib/api";
import { Label } from "@workspace/ui/components/label";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function RedisPage() {
  const { t } = useT();
  const [status, setStatus] = useState<RedisStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchRedisStatus()
      .then(setStatus)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-7 space-y-5 max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.tab_redis")}</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Utilisé pour le rate limiting et le cache de sessions. Configuré via <code>REDIS_URL</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {!loading && status && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className={`size-3 rounded-full shrink-0 ${status.connected ? "bg-green-500" : "bg-destructive"}`} />
            <div>
              <div className="text-sm font-medium">{status.connected ? "Connecté" : "Déconnecté"}</div>
              <div className="text-[11px] text-muted-foreground">
                {status.connected ? "La connexion Redis est active." : "Redis est injoignable."}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Hôte</Label>
              <div className="text-[13px] font-mono bg-muted rounded px-2 py-1">{status.host ?? "—"}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Port</Label>
              <div className="text-[13px] font-mono bg-muted rounded px-2 py-1">{status.port ?? "—"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
