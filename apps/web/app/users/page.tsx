"use client";

import { useState, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { type UserOut } from "@/lib/api";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/lib/queries";
import { useFormModal } from "@/hooks/use-form-modal";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@workspace/ui/components/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose, DialogTrigger,
} from "@workspace/ui/components/dialog";
import { DataTable } from "@/components/data-table";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function UsersPage() {
  const { data: users = [], isLoading: loading, error } = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [createModal, createActions] = useFormModal<null>();
  const [editModal, editActions] = useFormModal<UserOut>();
  const [deleteModal, deleteActions] = useFormModal<UserOut>();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  function openCreate() {
    setUsername(""); setPassword(""); setRole("user");
    createActions.openNew();
  }

  function openEdit(u: UserOut) {
    setPassword(""); setRole(u.role);
    editActions.openWith(u);
  }

  async function handleCreate() {
    if (!username.trim() || !password) return;
    await createActions.run(async () => {
      await createMutation.mutateAsync({ username: username.trim(), password, role });
    });
  }

  async function handleEdit() {
    if (!editModal.target) return;
    await editActions.run(async () => {
      await updateMutation.mutateAsync({ id: editModal.target!.id, body: { password: password || undefined, role } });
    });
  }

  async function handleDelete() {
    if (!deleteModal.target) return;
    await deleteActions.run(async () => {
      await deleteMutation.mutateAsync(deleteModal.target!.id);
    });
  }

  const columns: ColumnDef<UserOut>[] = useMemo(() => [
    {
      accessorKey: "username",
      header: "Nom d'utilisateur",
      cell: ({ row }) => <span className="font-medium">{row.getValue("username")}</span>,
    },
    {
      accessorKey: "role",
      header: "Rôle",
      cell: ({ row }) => {
        const r = row.getValue<string>("role");
        return <Badge variant="secondary" className={r === "admin" ? "bg-primary/10 text-primary" : ""}>{r}</Badge>;
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
          <Button variant="ghost" size="icon-xs" onClick={() => openEdit(row.original)} aria-label="Modifier">
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => deleteActions.openWith(row.original)} aria-label="Supprimer">
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [openEdit, deleteActions]);

  if (error) {
    return (
      <div className="p-7">
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
          Erreur : {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Utilisateurs</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">
            {users.length} utilisateur{users.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Dialog open={createModal.open} onOpenChange={(o) => !o && createActions.close()}>
          <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
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
                <Input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: jean.dupont" autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">Mot de passe * <span className="text-muted-foreground font-normal">(min. 6 caractères)</span></Label>
                <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Rôle</Label>
                <Select value={role} onValueChange={(v) => setRole(v ?? "user")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {createModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createModal.error}</div>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
              <Button onClick={handleCreate} disabled={createModal.isPending || !username.trim() || !password}>
                {createModal.isPending ? "Création…" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable columns={columns} data={users} loading={loading} />

      {/* Edit dialog */}
      <Dialog open={editModal.open} onOpenChange={(o) => !o && editActions.close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier — {editModal.target?.username}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-password">Nouveau mot de passe <span className="text-muted-foreground font-normal">(laisser vide pour ne pas changer)</span></Label>
              <Input id="edit-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="••••••••" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v ?? "user")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {editModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button onClick={handleEdit} disabled={editModal.isPending}>
              {editModal.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer l&apos;utilisateur</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{deleteModal.target?.username}</strong> ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          {deleteModal.error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteModal.error}</div>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Annuler</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteModal.isPending}>
              {deleteModal.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
