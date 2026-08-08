"use client"

import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useCurrentUser } from "@/hooks/use-current-user"

export function InfoTab() {
  const user = useCurrentUser()

  return (
    <div className="space-y-4">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
        Informations
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="profile-username">Nom d&apos;utilisateur</Label>
          <Input
            id="profile-username"
            value={user?.username ?? ""}
            readOnly
            className="mt-1 cursor-default bg-muted/40"
          />
        </div>
        <div>
          <Label htmlFor="profile-name">Nom d&apos;affichage</Label>
          <Input
            id="profile-name"
            value={user?.name ?? ""}
            readOnly
            className="mt-1 cursor-default bg-muted/40"
          />
        </div>
        {user?.email && (
          <div className="sm:col-span-2">
            <Label htmlFor="profile-email">Adresse e-mail</Label>
            <Input
              id="profile-email"
              value={user.email}
              readOnly
              className="mt-1 cursor-default bg-muted/40"
            />
          </div>
        )}
      </div>
    </div>
  )
}
