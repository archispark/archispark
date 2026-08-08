"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { type WorkspaceInfo } from "@/lib/api";
import {
  useWorkspaces,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useActivateWorkspace,
} from "@/lib/queries";
import { useFormModal } from "@/hooks/use-form-modal";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
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

export function WorkspaceSettings() {
  const { t } = useT();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const createWs = useCreateWorkspace();
  const updateWs = useUpdateWorkspace();
  const deleteWs = useDeleteWorkspace();
  const activateWs = useActivateWorkspace();

  const [createModal, createActions] = useFormModal<null>();
  const [editModal, editActions] = useFormModal<WorkspaceInfo>();
  const [deleteModal, deleteActions] = useFormModal<WorkspaceInfo>();

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [editName, setEditName] = useState("");

  function openCreate() {
    setNewName("");
    setNewDesc("");
    createActions.openNew();
  }

  function openEdit(ws: WorkspaceInfo) {
    setEditName(ws.name);
    editActions.openWith(ws);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const trimmed = newName.trim();
    await createActions.run(async () => {
      await createWs.mutateAsync({ name: trimmed, description: newDesc.trim() || undefined });
    });
  }

  async function handleEditSave() {
    if (!editModal.target || !editName.trim()) return;
    const id = editModal.target.id;
    await editActions.run(async () => {
      await updateWs.mutateAsync({ id, body: { name: editName.trim() } });
    });
  }

  async function handleDelete() {
    if (!deleteModal.target) return;
    await deleteActions.run(async () => {
      await deleteWs.mutateAsync(deleteModal.target!.id);
    });
  }

  async function handleActivate(id: string) {
    try {
      await activateWs.mutateAsync(id);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <p className="text-muted-foreground text-[12px] mt-1.5">
          {t("settings.workspaces.count", { n: workspaces.length, s: workspaces.length !== 1 ? "s" : "" })}
        </p>

        <Dialog open={createModal.open} onOpenChange={(o) => !o && createActions.close()}>
          <DialogTrigger render={<Button size="sm" onClick={openCreate} />}>
            <Plus className="size-4" /> {t("nav.workspace_new")}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("nav.workspace_new")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-ws-name">{t("nav.workspace_name")} *</Label>
                <Input id="new-ws-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-ws-desc">{t("common.optional_desc")}</Label>
                <textarea
                  id="new-ws-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={2}
                  className="text-sm px-3 py-2 border border-border rounded-md bg-background text-foreground resize-y"
                />
              </div>
            </div>
            {createModal.error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createModal.error}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleCreate} disabled={createModal.isPending || !newName.trim()}>
                {createModal.isPending ? t("common.creating") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
        {workspaces.map((ws) => (
          <div key={ws.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium truncate">{ws.name}</p>
              {ws.path && <p className="text-[11px] text-muted-foreground font-mono truncate">{ws.path}</p>}
            </div>
            {ws.active ? (
              <span className="flex items-center gap-1 text-[11px] text-primary font-medium shrink-0">
                <Check className="size-3.5" />
                {t("nav.workspace_active")}
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleActivate(ws.id)} disabled={activateWs.isPending} className="shrink-0">
                {t("workspaces.activate")}
              </Button>
            )}
            <Button variant="ghost" size="icon-xs" onClick={() => openEdit(ws)} aria-label={t("common.edit")}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => deleteActions.openWith(ws)} aria-label={t("common.delete")}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={editModal.open} onOpenChange={(o) => !o && editActions.close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.workspaces.edit_title", { name: editModal.target?.name ?? "" })}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-ws-name">{t("nav.workspace_name")} *</Label>
              <Input id="edit-ws-name" value={editName} onChange={(e) => setEditName(e.target.value)} autoComplete="off" />
            </div>
          </div>
          {editModal.error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{editModal.error}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button onClick={handleEditSave} disabled={editModal.isPending || !editName.trim()}>
              {editModal.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.general.delete_ws")}</DialogTitle>
            <DialogDescription>
              {t("settings.workspaces.delete_desc", { name: deleteModal.target?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          {deleteModal.error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{deleteModal.error}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteModal.isPending}>
              {deleteModal.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
