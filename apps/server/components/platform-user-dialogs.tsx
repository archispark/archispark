"use client"

import { Plus } from "lucide-react"
import { useT } from "@/lib/i18n"
import type { FormModalState, FormModalActions } from "@/hooks/use-form-modal"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@workspace/ui/components/dialog"

export interface NewPlatformUserFields {
  username: string
  email: string
  password: string
  firstName: string
  lastName: string
  isAdmin: boolean
}

/** platform_admin-only — creates a local account from the admin console. */
export function CreatePlatformUserDialog({
  modal,
  actions,
  onOpenCreate,
  fields,
  onFieldsChange,
  onCreate,
}: {
  modal: FormModalState<null>
  actions: FormModalActions<null>
  onOpenCreate: () => void
  fields: NewPlatformUserFields
  onFieldsChange: (fields: NewPlatformUserFields) => void
  onCreate: () => void
}) {
  const { t } = useT()

  function set<K extends keyof NewPlatformUserFields>(
    key: K,
    value: NewPlatformUserFields[K]
  ) {
    onFieldsChange({ ...fields, [key]: value })
  }

  const canCreate =
    fields.username.trim() && fields.email.trim() && fields.password

  return (
    <Dialog open={modal.open} onOpenChange={(o) => !o && actions.close()}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            onClick={onOpenCreate}
            className="bg-emerald-600 text-primary-foreground hover:bg-emerald-700"
          />
        }
      >
        <Plus className="size-4" /> {t("common.add")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("platform.users.new_title")}</DialogTitle>
          <DialogDescription>{t("platform.users.new_desc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-user-first-name">
                {t("platform.users.first_name")}
              </Label>
              <Input
                id="new-user-first-name"
                value={fields.firstName}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-user-last-name">
                {t("platform.users.last_name")}
              </Label>
              <Input
                id="new-user-last-name"
                value={fields.lastName}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-username">
              {t("platform.users.username")} *
            </Label>
            <Input
              id="new-user-username"
              value={fields.username}
              onChange={(e) => set("username", e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-email">{t("common.email")} *</Label>
            <Input
              id="new-user-email"
              type="email"
              value={fields.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-user-password">
              {t("platform.users.password")} *
            </Label>
            <Input
              id="new-user-password"
              type="password"
              value={fields.password}
              onChange={(e) => set("password", e.target.value)}
              autoComplete="new-password"
              onKeyDown={(e) => e.key === "Enter" && canCreate && onCreate()}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={fields.isAdmin}
              onChange={(e) => set("isAdmin", e.target.checked)}
              className="shrink-0 rounded"
            />
            {t("platform.users.role_admin")}
          </label>
        </div>
        {modal.error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {modal.error}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("common.cancel")}
          </DialogClose>
          <Button onClick={onCreate} disabled={modal.isPending || !canCreate}>
            {modal.isPending ? t("common.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
