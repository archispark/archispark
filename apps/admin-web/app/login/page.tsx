"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Button } from "@workspace/ui/components/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/messages")
      .then((r) => r.json())
      .then((d: { login_message: string | null; login_message_enabled: boolean }) => {
        if (d.login_message_enabled && d.login_message) setLoginMessage(d.login_message);
      })
      .catch(() => {});
  }, []);

  const from = searchParams.get("from");
  const loginUrl = from ? `/api/auth/login?from=${encodeURIComponent(from)}` : "/api/auth/login";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="login-spark" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF1D5D" />
                <stop offset="50%" stopColor="#892FE8" />
                <stop offset="100%" stopColor="#1A87FF" />
              </linearGradient>
            </defs>
            <path
              d="M12 0 C12 7 13 11 24 12 C13 13 12 17 12 24 C12 17 11 13 0 12 C11 11 12 7 12 0 Z"
              fill="url(#login-spark)"
            />
          </svg>
          <span className="text-[22px] leading-none tracking-tight" style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}>
            <span className="font-light text-foreground">Archi</span>
            <span className="font-bold text-primary">Spark</span>
          </span>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h1 className="text-base font-semibold mb-1">{t("login.title")}</h1>
          <p className="text-[13px] text-muted-foreground mb-5">{t("login.subtitle")}</p>

          <Button render={<a href={loginUrl} />} className="w-full">
            {t("login.submit")}
          </Button>
        </div>

        {loginMessage && (
          <div className="mt-4 rounded-lg border border-border bg-card/60 px-4 py-3 text-[12px] text-muted-foreground whitespace-pre-wrap">
            {loginMessage}
          </div>
        )}
      </div>
    </div>
  );
}
