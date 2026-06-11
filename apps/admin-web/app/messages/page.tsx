"use client";

import { useEffect, useState } from "react";
import { fetchSiteMessages, updateSiteMessages, type SiteMessages } from "@/lib/api";
import { Button } from "@workspace/ui/components/button";
import { useT } from "@/lib/i18n";

function Toggle({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span className={`pointer-events-none inline-block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

export default function MessagesPage() {
  const { t } = useT();
  const [data, setData] = useState<SiteMessages>({
    login_message: "",
    login_message_enabled: false,
    banner_message: "",
    banner_message_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchSiteMessages()
      .then((m) => setData({ ...m, login_message: m.login_message ?? "", banner_message: m.banner_message ?? "" }))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await updateSiteMessages({
        login_message:          data.login_message || null,
        login_message_enabled:  data.login_message_enabled,
        banner_message:         data.banner_message || null,
        banner_message_enabled: data.banner_message_enabled,
      });
      setSavedMsg("Enregistré.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-7 text-center text-muted-foreground text-sm">Chargement…</div>;

  return (
    <div className="p-7 space-y-5 max-w-xl">
      <h1 className="text-lg font-semibold">{t("settings.tab_messages")}</h1>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="text-sm text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
          {savedMsg}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Message de connexion</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Affiché sous le formulaire de login. Utile pour indiquer les identifiants de démo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            id="login-msg-enabled"
            checked={data.login_message_enabled}
            onChange={(v) => setData((d) => ({ ...d, login_message_enabled: v }))}
          />
          <label htmlFor="login-msg-enabled" className="text-[13px] cursor-pointer select-none">
            {data.login_message_enabled ? "Activé" : "Désactivé"}
          </label>
        </div>
        <textarea
          value={data.login_message ?? ""}
          onChange={(e) => setData((d) => ({ ...d, login_message: e.target.value }))}
          rows={4}
          placeholder={"Compte de démo :\nLogin : demo  /  Mot de passe : demo123"}
          className="w-full text-sm px-3 py-2 border border-border rounded-md bg-background text-foreground resize-y font-mono"
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Bandeau d&apos;information</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Bandeau visible en haut de toutes les pages (les utilisateurs peuvent le fermer).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Toggle
            id="banner-enabled"
            checked={data.banner_message_enabled}
            onChange={(v) => setData((d) => ({ ...d, banner_message_enabled: v }))}
          />
          <label htmlFor="banner-enabled" className="text-[13px] cursor-pointer select-none">
            {data.banner_message_enabled ? "Activé" : "Désactivé"}
          </label>
        </div>
        <textarea
          value={data.banner_message ?? ""}
          onChange={(e) => setData((d) => ({ ...d, banner_message: e.target.value }))}
          rows={3}
          placeholder="Maintenance prévue le 15 juin de 22h à 00h."
          className="w-full text-sm px-3 py-2 border border-border rounded-md bg-background text-foreground resize-y"
        />
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}
