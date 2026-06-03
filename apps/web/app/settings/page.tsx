"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  fetchUsers,
  createUser,
  updateUserApi,
  deleteUserApi,
  fetchWorkspaces,
  updateWorkspaceApi,
  deleteWorkspaceApi,
  fetchUserRoles,
  fetchRoles,
  assignUserToRole,
  unassignUserFromRole,
  createRole,
  updateRole,
  deleteRole,
  fetchProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  fetchRedisStatus,
  fetchMcpToken,
  regenerateMcpToken,
  type RedisStatus,
  type McpTokenOut,
  ARCHIMATE_LAYERS,
  PERMISSION_FLAGS,
  type UserOut,
  type WorkspaceInfo,
  type RoleOut,
  type ArchiLayer,
  type LayerPermissions,
  type PermissionFlag,
  type OAuthProviderOut,
  type OAuthProviderType,
} from "@/lib/api";
import { useRouter } from "next/navigation";
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
import { Plus, Trash2, Pencil, Users as UsersIcon, Settings as SettingsIcon, Shield, Upload, Download, KeyRound, Eye, EyeOff, Database, RefreshCw, Copy, Check } from "lucide-react";
import { exportModelUrl, importModel } from "@/lib/api";
import { useDropzone } from "react-dropzone";

type Tab = "members" | "roles" | "general" | "import-export" | "authentication" | "redis" | "mcp";

export default function SettingsPage() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">
          Gestion des membres et du workspace.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "general"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <SettingsIcon className="size-3.5" />
          {t("settings.tab_general")}
        </button>
        <button
          type="button"
          onClick={() => setTab("members")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "members"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UsersIcon className="size-3.5" />
          {t("settings.tab_members")}
        </button>
        <button
          type="button"
          onClick={() => setTab("roles")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "roles"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Shield className="size-3.5" />
          {t("settings.tab_roles")}
        </button>
        <button
          type="button"
          onClick={() => setTab("authentication")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "authentication"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="size-3.5" />
          {t("settings.tab_authentication")}
        </button>
        <button
          type="button"
          onClick={() => setTab("mcp")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "mcp"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="size-3.5" />
          MCP
        </button>
        <button
          type="button"
          onClick={() => setTab("redis")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "redis"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Database className="size-3.5" />
          Redis
        </button>
        <button
          type="button"
          onClick={() => setTab("import-export")}
          className={`flex items-center gap-2 px-3 py-2 text-[13px] border-b-2 transition-colors ${
            tab === "import-export"
              ? "border-primary text-foreground font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="size-3.5" />
          {t("settings.tab_import_export")}
        </button>
      </div>

      {tab === "members" && <MembersTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "general" && <GeneralTab />}
      {tab === "import-export" && <ImportExportTab />}
      {tab === "authentication" && <AuthenticationTab />}
      {tab === "redis" && <RedisTab />}
      {tab === "mcp" && <McpTokenSection />}
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

  const [rolesOpen, setRolesOpen] = useState(false);
  const [rolesTarget, setRolesTarget] = useState<UserOut | null>(null);
  const [allRoles, setAllRoles] = useState<RoleOut[]>([]);
  const [assignedRoleIds, setAssignedRoleIds] = useState<Set<string>>(new Set());
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  async function openRoles(u: UserOut) {
    setRolesTarget(u);
    setRolesError(null);
    setRolesOpen(true);
    setRolesLoading(true);
    try {
      const [all, mine] = await Promise.all([fetchRoles(), fetchUserRoles(u.id)]);
      setAllRoles(all);
      setAssignedRoleIds(new Set(mine.map((r) => r.id)));
    } catch (err) {
      setRolesError((err as Error).message);
    } finally {
      setRolesLoading(false);
    }
  }

  async function toggleRole(roleId: string, checked: boolean) {
    if (!rolesTarget) return;
    try {
      if (checked) {
        await assignUserToRole(roleId, rolesTarget.id);
        setAssignedRoleIds((s) => new Set(s).add(roleId));
      } else {
        await unassignUserFromRole(roleId, rolesTarget.id);
        setAssignedRoleIds((s) => {
          const n = new Set(s);
          n.delete(roleId);
          return n;
        });
      }
    } catch (err) {
      setRolesError((err as Error).message);
    }
  }

  const [allRolesMap, setAllRolesMap] = useState<Map<string, string>>(new Map()); // roleId → name
  const [userRolesMap, setUserRolesMap] = useState<Map<string, string[]>>(new Map()); // userId → roleNames

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchRoles()])
      .then(([us, rs]) => {
        setUsers(us);
        const rmap = new Map(rs.map((r) => [r.id, r.name]));
        setAllRolesMap(rmap);
        const urmap = new Map<string, string[]>();
        for (const r of rs) {
          for (const uid of r.user_ids) {
            const cur = urmap.get(uid) ?? [];
            cur.push(r.name);
            urmap.set(uid, cur);
          }
        }
        setUserRolesMap(urmap);
      })
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
      id: "roles",
      header: t("settings.tab_roles"),
      accessorFn: (row) => userRolesMap.get(row.id)?.join(", ") ?? "—",
      cell: ({ row }) => {
        const names = userRolesMap.get(row.original.id) ?? [];
        if (names.length === 0) return <span className="text-muted-foreground text-[12px]">Aucun</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {names.map((n) => (
              <span key={n} className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">{n}</span>
            ))}
          </div>
        );
      },
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
          <Button variant="ghost" size="sm" onClick={() => openRoles(row.original)}>
            {t("settings.tab_roles")}
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => openDelete(row.original)} aria-label={t("common.delete")}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [userRolesMap]);

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

      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.tab_roles")} — {rolesTarget?.username}</DialogTitle>
            <DialogDescription>Coche les rôles à assigner.</DialogDescription>
          </DialogHeader>
          {rolesLoading ? (
            <div className="text-muted-foreground text-sm py-4">Chargement…</div>
          ) : allRoles.length === 0 ? (
            <div className="text-muted-foreground text-sm py-4">
              Aucun rôle défini. Créez-en via <code>POST /roles</code>.
            </div>
          ) : (
            <div className="flex flex-col gap-2 py-2">
              {allRoles.map((r) => (
                <label key={r.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md border border-border hover:bg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assignedRoleIds.has(r.id)}
                    onChange={(e) => toggleRole(r.id, e.target.checked)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{r.name}</div>
                    {r.description && <div className="text-[11px] text-muted-foreground">{r.description}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
          {rolesError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{rolesError}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Fermer</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const FLAG_COLORS: Record<string, string> = {
  read: "text-blue-600",
  create: "text-emerald-600",
  update: "text-amber-600",
  delete: "text-destructive",
};

function emptyLayerPerms(): Record<ArchiLayer, LayerPermissions> {
  return Object.fromEntries(ARCHIMATE_LAYERS.map((l) => [l, [] as LayerPermissions])) as Record<ArchiLayer, LayerPermissions>;
}

function RolesTab() {
  const { t } = useT();
  const [roles, setRoles] = useState<RoleOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPerms, setNewPerms] = useState<Record<ArchiLayer, LayerPermissions>>(emptyLayerPerms());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RoleOut | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPerms, setEditPerms] = useState<Record<ArchiLayer, LayerPermissions>>(emptyLayerPerms());
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleOut | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchRoles()
      .then(setRoles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function openEdit(r: RoleOut) {
    setEditTarget(r);
    setEditName(r.name);
    setEditDesc(r.description ?? "");
    setEditPerms({ ...emptyLayerPerms(), ...r.permissions });
    setEditError(null);
    setEditOpen(true);
  }

  function openDelete(r: RoleOut) {
    setDeleteTarget(r);
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createRole({ name: newName.trim(), description: newDesc.trim() || null, permissions: newPerms });
      setCreateOpen(false);
      setNewName(""); setNewDesc("");
      setNewPerms(emptyLayerPerms());
      reload();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit() {
    if (!editTarget || !editName.trim()) return;
    setSaving(true);
    setEditError(null);
    try {
      await updateRole(editTarget.id, { name: editName.trim(), description: editDesc.trim() || null, permissions: editPerms });
      setEditOpen(false);
      reload();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRole(deleteTarget.id);
      setDeleteOpen(false);
      reload();
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const columns: ColumnDef<RoleOut>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: "Nom",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground text-[12px]">{row.original.description ?? "—"}</span>,
    },
    {
      id: "permissions",
      header: "Permissions couches",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {ARCHIMATE_LAYERS.map((l) => {
            const flags = row.original.permissions[l] ?? [];
            if (flags.length === 0) return null;
            return (
              <span key={l} className="text-[10px] font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                {l}: {flags.join(",")}
              </span>
            );
          })}
        </div>
      ),
    },
    {
      id: "users",
      header: t("settings.tab_members"),
      accessorFn: (r) => r.user_ids.length,
      cell: ({ row }) => (
        <span className="text-[12px] text-muted-foreground">{row.original.user_ids.length}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {row.original.is_system ? (
            <span className="text-[10px] text-muted-foreground px-2">système</span>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>Modifier</Button>
              <Button variant="ghost" size="icon-xs" onClick={() => openDelete(row.original)} aria-label={t("common.delete")}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ], []);

  const LAYER_ONLY = ARCHIMATE_LAYERS.filter((l) => l !== "Relations" && l !== "Views");

  const PermGrid = ({
    title, layers, value, onChange,
  }: {
    title: string;
    layers: readonly string[];
    value: Record<ArchiLayer, LayerPermissions>;
    onChange: (v: Record<ArchiLayer, LayerPermissions>) => void;
  }) => (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">{title}</p>
      <div className="border border-border rounded-md overflow-hidden">
        <div className="grid text-[11px] font-medium text-muted-foreground bg-muted px-3 py-1.5" style={{ gridTemplateColumns: "1fr repeat(4, auto)" }}>
          <span>Ressource</span>
          {PERMISSION_FLAGS.map((f) => <span key={f} className={`text-center w-14 ${FLAG_COLORS[f]}`}>{f}</span>)}
        </div>
        {layers.map((layer) => {
          const flags = (value as Record<string, LayerPermissions>)[layer] ?? [];
          return (
            <div key={layer} className="grid items-center border-t border-border px-3 py-1.5" style={{ gridTemplateColumns: "1fr repeat(4, auto)" }}>
              <span className="text-[12px]">{layer}</span>
              {PERMISSION_FLAGS.map((flag) => (
                <div key={flag} className="flex items-center justify-center w-14">
                  <input
                    type="checkbox"
                    checked={flags.includes(flag)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...new Set([...flags, flag])] as LayerPermissions
                        : flags.filter((f) => f !== flag) as LayerPermissions;
                      onChange({ ...value, [layer]: next });
                    }}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  const PermissionsGrid = ({ value, onChange }: { value: Record<ArchiLayer, LayerPermissions>; onChange: (v: Record<ArchiLayer, LayerPermissions>) => void }) => (
    <div className="space-y-3">
      <PermGrid title="Couches ArchiMate" layers={LAYER_ONLY} value={value} onChange={onChange} />
      <PermGrid title="Relations" layers={["Relations"]} value={value} onChange={onChange} />
      <PermGrid title="Vues" layers={["Views"]} value={value} onChange={onChange} />
    </div>
  );

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
          {roles.length} rôle{roles.length !== 1 ? "s" : ""}
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Nouveau rôle
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouveau rôle</DialogTitle>
              <DialogDescription>Définir un rôle avec ses permissions par couche.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role-name">Nom *</Label>
                <Input id="role-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="ex: Architecte Métier" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="role-desc">Description</Label>
                <Input id="role-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optionnelle" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Permissions par couche</Label>
                <PermissionsGrid value={newPerms} onChange={setNewPerms} />
              </div>
            </div>
            {createError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createError}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? "Création…" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={roles} loading={loading} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier — {editTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-role-name">Nom *</Label>
              <Input id="edit-role-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-role-desc">Description</Label>
              <Input id="edit-role-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Permissions par couche</Label>
              <PermissionsGrid value={editPerms} onChange={setEditPerms} />
            </div>
          </div>
          {editError && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editError}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer le rôle</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{deleteTarget?.name}</strong> ? Les membres perdent ce rôle.
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

function ImportExportTab() {
  const { t } = useT();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(exportModelUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="?([^";\n]+)"?/)?.[1] ?? "model.xml";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setImportError(null);
    setImportSuccess(null);
    try {
      const info = await importModel(file);
      setImportSuccess(`Modèle « ${info.name} » importé — ${info.element_count} éléments, ${info.view_count} vues.`);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "text/xml": [".xml"], "application/xml": [".xml"] },
    maxFiles: 1,
    disabled: importing,
    onDropAccepted: ([file]) => { if (file) handleImportFile(file); },
  });

  return (
    <div className="space-y-6 max-w-xl">
      {importError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{importError}</div>
      )}
      {importSuccess && (
        <div className="text-sm text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">{importSuccess}</div>
      )}

      <div className="space-y-2">
        <Label>Importer un modèle</Label>
        <p className="text-[12px] text-muted-foreground">Fichier Open Exchange Format (.xml). Remplace le workspace actif.</p>
        <div
          {...getRootProps()}
          className={`flex items-center justify-center gap-3 border-2 border-dashed rounded-lg p-6 cursor-pointer transition-colors ${
            importing ? "border-primary/50 opacity-60 pointer-events-none"
            : isDragActive ? "border-primary bg-primary/5 text-primary"
            : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="size-5 shrink-0" />
          <div className="text-center">
            <p className="text-sm font-medium">
              {importing ? "Importation en cours…" : isDragActive ? "Déposez le fichier ici…" : "Cliquez ou déposez un fichier"}
            </p>
            <p className="text-[11px] opacity-70 mt-0.5">.xml (AOEF)</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Exporter le modèle</Label>
        <p className="text-[12px] text-muted-foreground">Télécharge le modèle actif au format Open Exchange XML.</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors disabled:opacity-60 disabled:pointer-events-none"
        >
          <Download className="size-4" />
          {exporting ? "Exportation…" : "Exporter le modèle (.xml)"}
        </button>
      </div>
    </div>
  );
}

function GeneralTab() {
  const { t } = useT();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const active = useMemo(() => workspaces.find((w) => w.active), [workspaces]);

  const load = useCallback(() => {
    setLoading(true);
    fetchWorkspaces()
      .then((ws) => {
        setWorkspaces(ws);
        const a = ws.find((w) => w.active);
        if (a) {
          setName(a.name);
          setDescription("");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    if (!active) return;
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await updateWorkspaceApi(active.id, { name });
      setSavedMsg("Enregistré.");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!active) return;
    setDeleting(true);
    try {
      await deleteWorkspaceApi(active.id);
      setDeleteOpen(false);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Chargement…</div>;
  }

  if (!active) {
    return <div className="text-muted-foreground text-sm">Aucun workspace actif.</div>;
  }

  return (
    <div className="space-y-4 max-w-xl">
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-name">Nom du workspace</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ws-desc">Description</Label>
        <textarea
          id="ws-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="text-sm px-3 py-2 border border-border rounded-md bg-background text-foreground resize-y"
          placeholder="Description (non persistée pour l'instant)"
        />
        <p className="text-[11px] text-muted-foreground">
          La description sera persistée dans une prochaine version (API non disponible).
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Chemin</Label>
        <div className="text-[12px] text-muted-foreground font-mono">{active.path}</div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger render={<Button variant="destructive" />}>
            <Trash2 className="size-4" /> Supprimer le workspace
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Supprimer le workspace</DialogTitle>
              <DialogDescription>
                Supprimer <strong>{active.name}</strong> ? Irréversible.
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
  );
}

function McpTokenSection() {
  const [tokenData, setTokenData] = useState<McpTokenOut | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchMcpToken()
      .then(setTokenData)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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
    <div className="space-y-4 max-w-xl">
      <div>
        <h2 className="text-sm font-semibold">Token MCP</h2>
        <p className="text-[12px] text-muted-foreground mt-0.5">
          Bearer token utilisé par les clients MCP (Claude Code, agents IA) pour s&apos;authentifier sur le serveur MCP.
        </p>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground text-sm">Chargement…</div>
      ) : tokenData ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
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
            claude mcp add archimate-vercel https://archispark-mcp-server.vercel.app/mcp/ --transport http --header &quot;Authorization: Bearer &lt;token&gt;&quot;
          </code>
        </div>
      )}
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
                      <SelectItem key={pt} value={pt}>{PROVIDER_TYPE_LABELS[t]}</SelectItem>
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
