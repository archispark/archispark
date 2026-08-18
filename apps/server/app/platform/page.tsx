"use client"

import Link from "next/link"
import { ShieldAlert, Building2, Users, Puzzle, ArrowRight } from "lucide-react"
import { useT } from "@/lib/i18n"
import { Card, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"

/**
 * platform_admin-only landing page for the administration interface — see
 * apps/server/components/platform-sidebar.tsx for the nav these cards
 * mirror.
 */
export default function PlatformWelcomePage() {
  const { t } = useT()

  const sections = [
    {
      href: "/platform/organizations",
      icon: Building2,
      title: t("platform.title"),
      desc: t("platform.desc"),
    },
    {
      href: "/platform/users",
      icon: Users,
      title: t("platform.users.title"),
      desc: t("platform.users.desc"),
    },
    {
      href: "/platform/plugins",
      icon: Puzzle,
      title: t("platform.plugins.title"),
      desc: t("platform.plugins.desc"),
    },
  ]

  return (
    <div className="max-w-3xl p-7">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldAlert className="size-5 text-primary" />
          {t("platform.welcome.title")}
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {t("platform.welcome.desc")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="no-underline">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <s.icon className="mb-1 size-5 text-primary" />
                <CardTitle className="flex items-center justify-between gap-2">
                  {s.title}
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
