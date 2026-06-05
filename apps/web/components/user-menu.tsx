"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Key, RefreshCw, Eye, EyeOff, Copy, Check } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { useCurrentUser, useIsAdmin } from "@/hooks/use-current-user";
import { useSession } from "@/lib/auth-client";
import { fetchMcpToken, regenerateMcpToken, type McpTokenOut } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type AccountTab = "name" | "password";

function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser();
  const { data: session } = useSession();
  const [tab, setTab] = useState<AccountTab>("name");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(user?.username ?? "");
      setTab("name");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
      setSuccess(null);
    }
  }, [open, user?.username, session?.user]);

  async function saveName() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error: err } = await authClient.updateUser({ name });
      if (err) throw new Error(err.message ?? "Erreur inconnue");
      setSuccess("Nom mis à jour avec succès.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    try {
      const { error: err } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (err) throw new Error(err.message ?? "Erreur inconnue");
      setSuccess("Mot de passe mis à jour.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const TABS: { id: AccountTab; label: string }[] = [
    { id: "name", label: "Nom" },
    { id: "password", label: "Mot de passe" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mon compte</DialogTitle>
        </DialogHeader>

        <div className="flex gap-0 border-b border-border -mx-4 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setError(null); setSuccess(null); }}
              className={`px-3 py-2 text-[13px] border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-1">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md px-3 py-2">
              {success}
            </div>
          )}

          {tab === "name" && (
            <>
              <div>
                <Label htmlFor="account-name">Nom d&apos;affichage</Label>
                <Input
                  id="account-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  className="mt-1"
                />
              </div>
              <Button onClick={saveName} disabled={saving || !name.trim()} size="sm">
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </>
          )}

          {tab === "password" && (
            <>
              <div>
                <Label htmlFor="current-pw">Mot de passe actuel</Label>
                <Input
                  id="current-pw"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="new-pw">Nouveau mot de passe</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirm-pw">Confirmer</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                onClick={savePassword}
                disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                size="sm"
              >
                {saving ? "Enregistrement…" : "Changer le mot de passe"}
              </Button>
            </>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}

function McpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tokenData, setTokenData] = useState<McpTokenOut | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchMcpToken()
      .then(setTokenData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) {
      setVisible(false);
      load();
    }
  }, [open, load]);

  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const data = await regenerateMcpToken();
      setTokenData(data);
      setVisible(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy() {
    if (!tokenData?.token) return;
    await navigator.clipboard.writeText(tokenData.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const maskedToken = tokenData?.token
    ? tokenData.token.slice(0, 8) + "•".repeat(24) + tokenData.token.slice(-8)
    : null;

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Token</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-[12px] text-muted-foreground">
            Bearer token utilisé par les clients MCP (Claude Code, agents IA) pour s&apos;authentifier sur le serveur MCP.
          </p>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-muted-foreground text-sm">Chargement…</div>
          ) : tokenData ? (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  readOnly
                  value={visible ? tokenData.token : (maskedToken ?? "")}
                  className="font-mono text-xs pr-16"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => setVisible((v) => !v)}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                    title={visible ? "Masquer" : "Afficher"}
                  >
                    {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded"
                    title="Copier"
                  >
                    {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  </button>
                </div>
              </div>
              {tokenData.created_at && (
                <p className="text-[11px] text-muted-foreground">
                  Généré le {new Date(tokenData.created_at * 1000).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">Aucun token généré.</p>
          )}

          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating}>
            <RefreshCw className="size-3.5" />
            {regenerating ? "Génération…" : tokenData ? "Régénérer" : "Générer un token"}
          </Button>

          {tokenData && (
            <div className="bg-muted/50 border border-border rounded-md px-3 py-2 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">Configuration Claude Code</p>
              <code className="text-[10px] break-all text-foreground">
                {`claude mcp add archimate-vercel ${process.env.NEXT_PUBLIC_MCP_SERVER_URL ?? "https://archispark-mcp-server.vercel.app/mcp/"} --transport http --header "Authorization: Bearer <token>"`}
              </code>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UserMenu() {
  const router = useRouter();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function logout() {
    const { signOut } = await import("@/lib/auth-client");
    await signOut();
    router.push("/login");
    router.refresh();
  }

  const initial = user?.username?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center size-8 rounded-full overflow-hidden bg-primary/10 text-primary hover:ring-2 hover:ring-primary/30 transition-all text-[13px] font-semibold"
          aria-label="Mon compte"
        >
          {initial}
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-popover border border-border rounded-lg shadow-lg py-1">
            <div className="px-3 py-2.5 border-b border-border mb-1">
              <p className="text-[13px] font-medium truncate">{user?.username}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{user?.role}</p>
            </div>

            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted text-left transition-colors"
              onClick={() => { setOpen(false); setAccountOpen(true); }}
            >
              <User className="size-3.5 text-muted-foreground shrink-0" />
              Mon compte
            </button>

            {isAdmin && (
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-muted text-left transition-colors"
                onClick={() => { setOpen(false); setMcpOpen(true); }}
              >
                <Key className="size-3.5 text-muted-foreground shrink-0" />
                Token
              </button>
            )}

            <div className="border-t border-border mt-1 pt-1">
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-destructive/10 text-destructive text-left transition-colors"
                onClick={() => { setOpen(false); void logout(); }}
              >
                <LogOut className="size-3.5 shrink-0" />
                Se déconnecter
              </button>
            </div>
          </div>
        )}
      </div>

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} />
      {isAdmin && <McpDialog open={mcpOpen} onClose={() => setMcpOpen(false)} />}
    </>
  );
}
