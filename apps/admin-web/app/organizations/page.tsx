"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { Badge } from "@workspace/ui/components/badge";
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
import { Plus, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useFormModal } from "@/hooks/use-form-modal";
import { DataTable } from "@/components/data-table";
import {
  useAdminOrganizations,
  useSetOrganizationEnabled,
  useNeonStatus,
  useCreateAdminOrganization,
  useVerifyOrganizationDb,
  useReprovisionOrganization,
} from "@/lib/queries";
import type { AdminOrganizationOut, TenantStatus } from "@/lib/api";

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const TENANT_STATUS_VARIANT: Record<Exclude<TenantStatus, null>, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  provisioning: "secondary",
  pending: "outline",
  error: "destructive",
};

export default function OrganizationsPage() {
  const { t } = useT();
  const qc = useQueryClient();
  const { data: orgs = [], isLoading } = useAdminOrganizations();
  const { data: neonStatus } = useNeonStatus();
  const setEnabled = useSetOrganizationEnabled();
  const createOrg = useCreateAdminOrganization();
  const verifyDb = useVerifyOrganizationDb();
  const reprovision = useReprovisionOrganization();

  const [suspendModal, suspendActions] = useFormModal<AdminOrganizationOut>();
  const [createModal, createActions] = useFormModal<null>();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  const neonReady = !neonStatus || (neonStatus.configured && neonStatus.reachable);

  function openCreate() {
    setName(""); setSlug(""); setSlugEdited(false);
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
      await createOrg.mutateAsync({ name: trimmedName, slug: trimmedSlug });
      toast.success(t("settings.org.org_created", { name: trimmedName }));
      qc.invalidateQueries();
    });
  }

  async function handleSuspend() {
    if (!suspendModal.target) return;
    const target = suspendModal.target;
    await suspendActions.run(async () => {
      await setEnabled.mutateAsync({ id: target.id, enabled: false });
      toast.success(t("settings.org.org_suspended", { name: target.name }));
    });
  }

  async function handleActivate(org: AdminOrganizationOut) {
    try {
      await setEnabled.mutateAsync({ id: org.id, enabled: true });
      toast.success(t("settings.org.org_activated", { name: org.name }));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleVerifyDb(org: AdminOrganizationOut) {
    try {
      const result = await verifyDb.mutateAsync(org.id);
      if (result.connected) {
        toast.success(t("settings.org.db_verify_success", { latency_ms: String(result.latency_ms) }));
      } else {
        toast.error(t("settings.org.db_verify_error"));
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function handleReprovision(org: AdminOrganizationOut) {
    try {
      await reprovision.mutateAsync(org.id);
      toast.success(t("settings.org.org_reprovision_success", { name: org.name }));
    } catch (e) {
      toast.error(t("settings.org.org_reprovision_error", { error: (e as Error).message }));
    }
  }

  const columns: ColumnDef<AdminOrganizationOut>[] = useMemo(() => [
    {
      accessorKey: "name",
      header: t("settings.org.org_name"),
      cell: ({ row }) => (
        <div>
          <div className="text-[14px]">{row.original.name}</div>
          <div className="text-[11px] text-muted-foreground font-mono">{row.original.slug}</div>
        </div>
      ),
    },
    {
      accessorKey: "enabled",
      header: t("settings.org.org_status"),
      cell: ({ row }) => (
        <Badge variant={row.original.enabled ? "outline" : "destructive"}>
          {t(row.original.enabled ? "settings.org.org_status_enabled" : "settings.org.org_status_suspended")}
        </Badge>
      ),
    },
    {
      accessorKey: "tenant_status",
      header: t("settings.org.tenant_status"),
      cell: ({ row }) => {
        const status = row.original.tenant_status;
        return (
          <Badge variant={status ? TENANT_STATUS_VARIANT[status] : "outline"}>
            {t(`settings.org.tenant_status_${status ?? "shared"}`)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: t("users.created_at"),
      cell: ({ row }) => (
        <span className="text-[12px] text-muted-foreground">
          {new Date(row.original.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => {
        const org = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVerifyDb(org)}
              disabled={org.tenant_status !== "active" || verifyDb.isPending}
            >
              <ShieldCheck className="size-3.5 mr-1" />
              {t("settings.org.db_verify")}
            </Button>
            {(org.tenant_status === "error" || org.tenant_status === "pending") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReprovision(org)}
                disabled={reprovision.isPending}
              >
                <RefreshCw className="size-3.5 mr-1" />
                {t("settings.org.org_reprovision")}
              </Button>
            )}
            {org.enabled ? (
              <Button variant="outline" size="sm" onClick={() => suspendActions.openWith(org)}>
                {t("settings.org.org_suspend")}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => handleActivate(org)} disabled={setEnabled.isPending}>
                {t("settings.org.org_activate")}
              </Button>
            )}
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [suspendActions, setEnabled.isPending, verifyDb.isPending, reprovision.isPending]);

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{t("settings.org.orgs_title")}</h1>
          <p className="text-muted-foreground text-[13px] mt-0.5">{t("settings.org.orgs_desc")}</p>
        </div>

        <Dialog open={createModal.open} onOpenChange={(o) => !o && createActions.close()}>
          <DialogTrigger render={<Button size="sm" onClick={openCreate} disabled={!neonReady} title={!neonReady ? (neonStatus && !neonStatus.configured ? t("settings.org.neon_not_configured") : t("settings.org.neon_not_reachable")) : undefined} />}>
            <Plus className="size-4" /> {t("settings.org.org_new_btn")}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("settings.org.org_new_title")}</DialogTitle>
              <DialogDescription>{t("settings.org.org_new_provisioning_info")}</DialogDescription>
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
            </div>
            {createModal.error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{createModal.error}</div>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
              <Button onClick={handleCreate} disabled={createModal.isPending || !name.trim() || !slug.trim()}>
                {createModal.isPending ? t("settings.org.org_creating_with_db") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {neonStatus && (!neonStatus.configured || !neonStatus.reachable) && (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{!neonStatus.configured ? t("settings.org.neon_not_configured") : t("settings.org.neon_not_reachable")}</span>
        </div>
      )}

      <DataTable columns={columns} data={orgs} loading={isLoading} />

      <Dialog open={suspendModal.open} onOpenChange={(o) => !o && suspendActions.close()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("settings.org.org_suspend_confirm_title")}</DialogTitle>
            <DialogDescription>
              {t("settings.org.org_suspend_confirm_desc", { name: suspendModal.target?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          {suspendModal.error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">{suspendModal.error}</div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("common.cancel")}</DialogClose>
            <Button variant="destructive" onClick={handleSuspend} disabled={suspendModal.isPending}>
              {suspendModal.isPending ? t("common.saving") : t("settings.org.org_suspend")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
