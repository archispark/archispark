"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import {
  fetchUsers,
  createUser,
  deleteUserApi,
  fetchProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  fetchRedisStatus,
  fetchPostgresStatus,
  fetchSiteMessages,
  updateSiteMessages,
  type SiteMessages,
  type RedisStatus,
  type PostgresStatus,
  type UserOut,
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
import { DataTable } from "@/components/data-table";
import { Plus, Trash2, Pencil, Eye, EyeOff, RefreshCw, Building2 } from "lucide-react";
import { useFormModal } from "@/hooks/use-form-modal";
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  type OrganizationListItem,
} from "@/hooks/use-organization";

type Tab = "members" | "authentication" | "redis" | "postgres" | "messages" | "organizations";

export default function AdminPage() {
  return (
    <Suspense>
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab) || "members";

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{t("admin.title")}</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">
          {t("admin.desc")}
        </p>
      </div>

      {tab === "organizations" && <OrganizationsTab />}
      {tab === "members" && <MembersTab />}
      {tab === "authentication" && <AuthenticationTab />}
      {tab === "redis" && <RedisTab />}
      {tab === "postgres" && <PostgresTab />}
      {tab === "messages" && <MessagesTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Organizations tab — platform organization list + creation
// ---------------------------------------------------------------------------

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function OrganizationsTab() {
  const { t } = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const organizations = useOrganizations();
  const createOrganization = useCreateOrganization();
  const updateOrganization = useUpdateOrganization();

  const [createModal, createActions] = useFormModal<null>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const [editModal, editActions] = useFormModal<OrganizationListItem>();
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");

  function openCreate() {
    setName(""); setSlug(""); setDescription(""); setSlugEdited(false);
    createActions.openNew();
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(slugify(value));
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName || !trimmedSlug) return;
    await createActions.run(async () => {
      await createOrganization.mutateAsync({ name: trimmedName, slug: trimmedSlug, description: description.trim() || undefined });
      toast.success(t("settings.org.org_created", { name: trimmedName }));
      qc.invalidateQueries();
      router.push("/workspaces");
    });
  }

  function openEdit(org: OrganizationListItem) {
    setEditName(org.name);
    setEditSlug(org.slug);
    setEditDescription(org.metadata?.description ?? "");
    editActions.openWith(org);
  }

  async function handleEditSave() {
    if (!editModal.target) return;
    const trimmedName = editName.trim();
    const trimmedSlug = editSlug.trim();
    if (!trimmedName || !trimmedSlug) return;
    await editActions.run(async () => {
      await updateOrganization.mutateAsync({
        organizationId: editModal.target!.id,
        name: trimmedName,
        slug: trimmedSlug,
        metadata: { ...editModal.target!.metadata, description: editDescription.trim() },
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-muted-foreground text-[13px]">{t("settings.org.orgs_desc")}</p>

        <Dialog open={createModal.open} onOpenChange={(o) => !o && createActions.close()}>
          <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
            <Plus className="size-4" /> {t("settings.org.org_new_btn")}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.org.org_new_title")}</DialogTitle>
              <DialogDescription>{t("settings.org.org_new_desc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org-name">{t("settings.org.org_name")} *</Label>
                <Input id="org-name" value={name} onChange={(e) => handleNameChange(e.target.value)} autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org-slug">{t("settings.org.org_slug")} *</Label>
                <Input id="org-slug" value={slug} onChange={(e) => handleSlugChange(e.target.value)} autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org-description">{t("settings.org.org_description")} <span className="text-muted-foreground font-normal">{t("common.optional")}</span></Label>
                <textarea
                  id="org-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("common.optional_desc")}
                  rows={2}
                  className="text-sm px-3 py-2 border border-input rounded-md bg-background text-foreground outline-none focus:border-ring resize-vertical min-h-[60px]"
                />
              </div>
            </div>
            {createModal.error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createModal.error}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleCreate} disabled={createModal.isPending || !name.trim() || !slug.trim()}>
                {createModal.isPending ? t("common.creating") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2">
        {organizations.map((org) => (
          <div key={org.id} className="flex items-start gap-3 px-4 py-3 bg-card border border-border rounded-lg">
            <Building2 className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="truncate text-[14px] text-foreground">{org.name}</div>
              <div className="truncate text-[11px] text-muted-foreground font-mono">{org.slug}</div>
              {org.metadata?.description && (
                <p className="text-[12px] text-muted-foreground mt-1">{org.metadata.description}</p>
              )}
            </div>
            <Button variant="ghost" size="icon-xs" className="shrink-0" onClick={() => openEdit(org)} aria-label={t("common.edit")}>
              <Pencil className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={editModal.open} onOpenChange={(o) => !o && editActions.close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.org.org_edit_title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-edit-name">{t("settings.org.org_name")} *</Label>
              <Input id="org-edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-edit-slug">{t("settings.org.org_slug")} *</Label>
              <Input id="org-edit-slug" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-edit-description">{t("settings.org.org_description")} <span className="text-muted-foreground font-normal">{t("common.optional")}</span></Label>
              <textarea
                id="org-edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t("common.optional_desc")}
                rows={2}
                className="text-sm px-3 py-2 border border-input rounded-md bg-background text-foreground outline-none focus:border-ring resize-vertical min-h-[60px]"
              />
            </div>
          </div>
          {editModal.error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editModal.error}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button onClick={handleEditSave} disabled={editModal.isPending || !editName.trim() || !editSlug.trim()}>
              {editModal.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembersTab() {
  const { t } = useT();
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function openDelete(u: UserOut) {
    setDeleteTarget(u);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleCreate() {
    if (!newUsername.trim() || !newPassword) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createUser({ username: newUsername.trim(), password: newPassword, role: newRole });
      setCreateOpen(false);
      setNewUsername(""); setNewPassword(""); setNewRole("user");
      reload();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUserApi(deleteTarget.id);
      setDeleteOpen(false);
      reload();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const columns: ColumnDef<UserOut>[] = useMemo(() => [
    {
      accessorKey: "username",
      header: "Nom d'utilisateur",
      cell: ({ row }) => <span className="font-medium">{row.getValue("username")}</span>,
    },
    {
      accessorKey: "created_at",
      header: "Créé le",
      cell: ({ row }) => (
        <span className="text-[12px] text-muted-foreground">
          {new Date(row.getValue("created_at")).toLocaleDateString("fr-FR")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon-xs" onClick={() => openDelete(row.original)} aria-label={t("common.delete")}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
  ], [t]);

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
        Erreur : {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-[13px]">
          {users.length} utilisateur{users.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Nouvel utilisateur
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvel utilisateur</DialogTitle>
              <DialogDescription>Créer un compte d&apos;accès à ArchiSpark.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-username">Nom d&apos;utilisateur *</Label>
                <Input
                  id="new-username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">Mot de passe *</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Rôle</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v ?? "user")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {createError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createError}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleCreate} disabled={creating || !newUsername.trim() || !newPassword}>
                {creating ? "Création…" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={users} loading={loading} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;utilisateur</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{deleteTarget?.username}</strong> ? Irréversible.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteError}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Authentication tab — OAuth / OIDC provider management
// ---------------------------------------------------------------------------

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
          <p className="text-[11px] text-muted-foreground">L'URL de base du serveur OIDC (sans <code>/.well-known/openid-configuration</code>).</p>
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

function AuthenticationTab() {
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

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Chargement…</div>;
  if (error) return <div className="py-8 text-center text-destructive text-sm">{error}</div>;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Fournisseurs OAuth / OIDC</h2>
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
        <p className="font-medium text-foreground">Variables d'environnement</p>
        <p>Les fournisseurs configurés via <code>GENERIC_OIDC_*</code>, <code>GOOGLE_*</code>, <code>GITHUB_*</code> ou <code>ENTRA_*</code> restent actifs et ne peuvent pas être gérés ici.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Redis tab — read-only status (config via REDIS_URL env var)
// ---------------------------------------------------------------------------

function RedisTab() {
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
    <div className="space-y-5 max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Redis</h2>
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

// ---------------------------------------------------------------------------
// PostgreSQL tab — read-only status (config via DATABASE_URL env var)
// ---------------------------------------------------------------------------

function PostgresTab() {
  const [status, setStatus] = useState<PostgresStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchPostgresStatus()
      .then(setStatus)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">PostgreSQL</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Base de données principale. Configurée via <code>DATABASE_URL</code>.
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
                {status.connected ? "La connexion PostgreSQL est active." : "PostgreSQL est injoignable."}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Hôte</Label>
              <div className="text-[13px] font-mono bg-muted rounded px-2 py-1 truncate">{status.host ?? "—"}</div>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">Port</Label>
              <div className="text-[13px] font-mono bg-muted rounded px-2 py-1">{status.port ?? "—"}</div>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-[11px]">Base de données</Label>
              <div className="text-[13px] font-mono bg-muted rounded px-2 py-1 truncate">{status.database ?? "—"}</div>
            </div>
            <div className="flex flex-col gap-1 col-span-2">
              <Label className="text-[11px]">Version</Label>
              <div className="text-[13px] font-mono bg-muted rounded px-2 py-1 truncate">{status.version ?? "—"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messages tab — login page hint + site-wide banner
// ---------------------------------------------------------------------------

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

function MessagesTab() {
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

  if (loading) return <div className="text-muted-foreground text-sm">Chargement…</div>;

  return (
    <div className="space-y-6 max-w-xl">
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
          <h2 className="text-sm font-semibold">Bandeau d'information</h2>
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
