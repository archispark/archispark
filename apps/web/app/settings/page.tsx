"use client";
import { useT } from "@/lib/i18n";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useWorkspaces, useUpdateWorkspace, useDeleteWorkspace } from "@/lib/queries";
import { useIsOrgAdmin, useIsOrgOwner } from "@/hooks/use-organization";
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
} from "@workspace/ui/components/dialog";

export default function SettingsPage() {
  const { t } = useT();

  return (
    <div className="p-7 space-y-5">
      <div>
        <h1 className="text-lg font-semibold">{t("settings.title")}</h1>
        <p className="text-muted-foreground text-[13px] mt-0.5">
          {t("settings.desc")}
        </p>
      </div>

      <WorkspaceTab />
    </div>
  );
}

function WorkspaceTab() {
  const { t } = useT();
  const router = useRouter();
  const isOrgAdmin = useIsOrgAdmin();
  const isOrgOwner = useIsOrgOwner();
  const { data: workspaces = [], isLoading } = useWorkspaces();
  const updateWs = useUpdateWorkspace();
  const deleteWs = useDeleteWorkspace();
  const active = workspaces.find((w) => w.active);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteModal, deleteActions] = useFormModal<null>();

  useEffect(() => {
    if (active) {
      setName(active.name);
      setDescription(active.description ?? "");
    }
  }, [active?.id, active?.name, active?.description]);

  async function handleSave() {
    if (!active || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateWs.mutateAsync({
        id: active.id,
        body: { name: name.trim(), description: description.trim() || null, team_ids: active.team_ids },
      });
      toast.success(t("settings.general.saved"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!active) return;
    await deleteActions.run(async () => {
      await deleteWs.mutateAsync(active.id);
      router.push("/workspaces");
    });
  }

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">{t("common.loading")}</div>;
  }

  if (!active) return null;

  const dirty = name !== active.name || description !== (active.description ?? "");

  return (
    <div className="space-y-6 max-w-xl">
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-name">{t("nav.workspace_name")} *</Label>
          <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOrgAdmin} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-desc">{t("common.optional_desc")}</Label>
          <textarea
            id="ws-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isOrgAdmin}
            rows={3}
            className="text-sm px-3 py-2 border border-border rounded-md bg-background text-foreground resize-y disabled:opacity-60"
          />
        </div>
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{error}</div>
        )}
        {isOrgAdmin && (
          <Button onClick={handleSave} disabled={saving || !name.trim() || !dirty}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        )}
      </div>

      {isOrgOwner && (
        <div className="border-t border-border pt-4 space-y-2">
          <h2 className="text-sm font-semibold text-destructive">{t("settings.general.delete_ws")}</h2>
          <p className="text-[12px] text-muted-foreground">{t("settings.workspaces.delete_desc", { name: active.name })}</p>
          <Button variant="destructive" size="sm" onClick={() => deleteActions.openNew()}>
            {t("settings.general.delete_ws")}
          </Button>
        </div>
      )}

      <Dialog open={deleteModal.open} onOpenChange={(o) => !o && deleteActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.general.delete_ws")}</DialogTitle>
            <DialogDescription>{t("settings.workspaces.delete_desc", { name: active.name })}</DialogDescription>
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
