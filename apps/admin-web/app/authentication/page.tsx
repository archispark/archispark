"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  type OAuthProviderOut,
  type OAuthProviderType,
} from "@/lib/api";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Plus, Trash2, Pencil, Eye, EyeOff } from "lucide-react";
import { useT } from "@/lib/i18n";

const PROVIDER_TYPE_LABELS: Record<OAuthProviderType, string> = {
  oidc:                 "OIDC générique",
  google:               "Google",
  github:               "GitHub",
  "microsoft-entra-id": "Microsoft Entra ID",
};

function ProviderFormFields({
  type, name, clientId, clientSecret, issuerUrl, tenantId,
  setName, setClientId, setClientSecret, setIssuerUrl, setTenantId,
  showSecret, setShowSecret,
}: {
  type: OAuthProviderType;
  name: string; clientId: string; clientSecret: string;
  issuerUrl: string; tenantId: string;
  setName: (v: string) => void; setClientId: (v: string) => void;
  setClientSecret: (v: string) => void; setIssuerUrl: (v: string) => void;
  setTenantId: (v: string) => void;
  showSecret: boolean; setShowSecret: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prov-name">Nom affiché *</Label>
        <Input id="prov-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={PROVIDER_TYPE_LABELS[type]} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prov-client-id">Client ID *</Label>
        <Input id="prov-client-id" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="client_id" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prov-secret">Client Secret *</Label>
        <div className="relative">
          <Input
            id="prov-secret"
            type={showSecret ? "text" : "password"}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="client_secret"
            className="pr-9"
          />
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      {type === "oidc" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prov-issuer">Issuer URL *</Label>
          <Input id="prov-issuer" value={issuerUrl} onChange={(e) => setIssuerUrl(e.target.value)} placeholder="https://sso.example.com/realms/myrealm" />
          <p className="text-[11px] text-muted-foreground">L&apos;URL de base du serveur OIDC (sans <code>/.well-known/openid-configuration</code>).</p>
        </div>
      )}
      {type === "microsoft-entra-id" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prov-tenant">Tenant ID</Label>
          <Input id="prov-tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="common" />
        </div>
      )}
    </div>
  );
}

export default function AuthenticationPage() {
  const { t } = useT();
  const [providers, setProviders] = useState<OAuthProviderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<OAuthProviderType>("oidc");
  const [createName, setCreateName] = useState("");
  const [createClientId, setCreateClientId] = useState("");
  const [createSecret, setCreateSecret] = useState("");
  const [createIssuer, setCreateIssuer] = useState("");
  const [createTenant, setCreateTenant] = useState("");
  const [createShowSecret, setCreateShowSecret] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editTarget, setEditTarget] = useState<OAuthProviderOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editSecret, setEditSecret] = useState("");
  const [editIssuer, setEditIssuer] = useState("");
  const [editTenant, setEditTenant] = useState("");
  const [editShowSecret, setEditShowSecret] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<OAuthProviderOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchProviders()
      .then(setProviders)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(p: OAuthProviderOut) {
    setEditTarget(p);
    setEditName(p.name);
    setEditClientId(p.client_id);
    setEditSecret("");
    setEditIssuer(p.issuer_url ?? "");
    setEditTenant(p.tenant_id ?? "");
    setEditShowSecret(false);
    setEditError(null);
  }

  async function handleCreate() {
    if (!createName.trim() || !createClientId.trim() || !createSecret.trim()) return;
    if (createType === "oidc" && !createIssuer.trim()) { setCreateError("Issuer URL requis pour OIDC."); return; }
    setCreating(true); setCreateError(null);
    try {
      await createProvider({
        type: createType, name: createName.trim(),
        client_id: createClientId.trim(), client_secret: createSecret,
        ...(createType === "oidc" ? { issuer_url: createIssuer.trim() } : {}),
        ...(createType === "microsoft-entra-id" && createTenant ? { tenant_id: createTenant.trim() } : {}),
      });
      setCreateOpen(false);
      setCreateName(""); setCreateClientId(""); setCreateSecret(""); setCreateIssuer(""); setCreateTenant("");
      load();
    } catch (e) { setCreateError((e as Error).message); }
    finally { setCreating(false); }
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim() || !editClientId.trim()) return;
    setEditing(true); setEditError(null);
    try {
      await updateProvider(editTarget.id, {
        name: editName.trim(),
        client_id: editClientId.trim(),
        ...(editSecret ? { client_secret: editSecret } : {}),
        ...(editTarget.type === "oidc" ? { issuer_url: editIssuer.trim() || null } : {}),
        ...(editTarget.type === "microsoft-entra-id" ? { tenant_id: editTenant.trim() || null } : {}),
      });
      setEditTarget(null);
      load();
    } catch (e) { setEditError((e as Error).message); }
    finally { setEditing(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProvider(deleteTarget.id);
      setDeleteTarget(null);
      load();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  }

  async function toggleEnabled(p: OAuthProviderOut) {
    await updateProvider(p.id, { enabled: !p.enabled }).catch(() => null);
    load();
  }

  if (loading) return <div className="p-7 text-center text-muted-foreground text-sm">Chargement…</div>;
  if (error) return <div className="p-7 text-center text-destructive text-sm">{error}</div>;

  return (
    <div className="p-7 space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.tab_authentication")}</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Configurez les connexions SSO. Les changements prennent effet immédiatement.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Ajouter un fournisseur
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouveau fournisseur</DialogTitle>
              <DialogDescription>Configurez un fournisseur OAuth / OIDC pour le SSO.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>Type *</Label>
                <Select value={createType} onValueChange={(v) => setCreateType(v as OAuthProviderType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROVIDER_TYPE_LABELS) as OAuthProviderType[]).map((pt) => (
                      <SelectItem key={pt} value={pt}>{PROVIDER_TYPE_LABELS[pt]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <ProviderFormFields
                type={createType}
                name={createName} clientId={createClientId} clientSecret={createSecret}
                issuerUrl={createIssuer} tenantId={createTenant}
                setName={setCreateName} setClientId={setCreateClientId}
                setClientSecret={setCreateSecret} setIssuerUrl={setCreateIssuer}
                setTenantId={setCreateTenant}
                showSecret={createShowSecret} setShowSecret={setCreateShowSecret}
              />
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button
                onClick={handleCreate}
                disabled={creating || !createName.trim() || !createClientId.trim() || !createSecret.trim()}
              >
                {creating ? "Création…" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          Aucun fournisseur configuré. Cliquez sur « Ajouter un fournisseur » pour commencer.
        </div>
      ) : (
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`size-2 rounded-full shrink-0 ${p.enabled ? "bg-green-500" : "bg-muted-foreground"}`} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {PROVIDER_TYPE_LABELS[p.type]} · ID&nbsp;=&nbsp;{p.provider_id}
                    {p.issuer_url && <span> · {p.issuer_url}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon-xs"
                  onClick={() => toggleEnabled(p)}
                  title={p.enabled ? "Désactiver" : "Activer"}
                >
                  {p.enabled ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
                <Dialog open={editTarget?.id === p.id} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
                  <DialogTrigger render={<Button variant="ghost" size="icon-xs" />} onClick={() => openEdit(p)}>
                    <Pencil className="size-3.5" />
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Modifier le fournisseur</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                      <ProviderFormFields
                        type={p.type}
                        name={editName} clientId={editClientId} clientSecret={editSecret}
                        issuerUrl={editIssuer} tenantId={editTenant}
                        setName={setEditName} setClientId={setEditClientId}
                        setClientSecret={setEditSecret} setIssuerUrl={setEditIssuer}
                        setTenantId={setEditTenant}
                        showSecret={editShowSecret} setShowSecret={setEditShowSecret}
                      />
                      <p className="text-[11px] text-muted-foreground">Laissez le secret vide pour le conserver.</p>
                    </div>
                    {editError && <p className="text-sm text-destructive">{editError}</p>}
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
                      <Button
                        onClick={handleEdit}
                        disabled={editing || !editName.trim() || !editClientId.trim()}
                      >
                        {editing ? t("common.saving") : t("common.save")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Dialog open={deleteTarget?.id === p.id} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                  <DialogTrigger render={<Button variant="ghost" size="icon-xs" />} onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Supprimer le fournisseur</DialogTitle>
                      <DialogDescription>
                        Supprimer <strong>{p.name}</strong> ? Les utilisateurs ne pourront plus se connecter via ce fournisseur.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
                      <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                        {deleting ? "Suppression…" : "Supprimer"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-muted/40 p-4 text-[12px] text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Variables d&apos;environnement</p>
        <p>Les fournisseurs configurés via <code>GENERIC_OIDC_*</code>, <code>GOOGLE_*</code>, <code>GITHUB_*</code> ou <code>ENTRA_*</code> restent actifs et ne peuvent pas être gérés ici.</p>
      </div>
    </div>
  );
}
