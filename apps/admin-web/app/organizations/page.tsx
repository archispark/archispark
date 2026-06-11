"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Plus, Pencil, Building2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useFormModal } from "@/hooks/use-form-modal";
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  type OrganizationListItem,
} from "@/hooks/use-organization";

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function OrganizationsPage() {
  const { t } = useT();
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
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.org.orgs_title")}</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">{t("settings.org.orgs_desc")}</p>
        </div>

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
