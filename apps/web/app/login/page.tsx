"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Input } from "@workspace/ui/components/input";
import { useT } from "@/lib/i18n";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

interface OAuthProvider {
  id: string;
  name: string;
}

export default function LoginPage() {
  const { t } = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/auth/providers")
      .then((r) => r.json())
      .then((data: OAuthProvider[]) => setProviders(data))
      .catch(() => {});
    fetch("/api/settings/messages")
      .then((r) => r.json())
      .then((d: { login_message: string | null; login_message_enabled: boolean }) => {
        if (d.login_message_enabled && d.login_message) setLoginMessage(d.login_message);
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const u = (fd.get("username") as string | null)?.trim() ?? "";
    const p = (fd.get("password") as string | null) ?? "";
    if (!u || !p) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.username({ username: u, password: p });
      if (result.error) {
        setError(result.error.message ?? t("login.wrong_credentials"));
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSso(providerId: string) {
    setSsoLoading(providerId);
    try {
      await signIn.oauth2({ providerId, callbackURL: "/" });
    } catch (err) {
      setError((err as Error).message);
      setSsoLoading(null);
    }
  }

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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">{t("login.username")}</Label>
              <Input
                id="username"
                name="username"
                required
                autoFocus
                autoComplete="username"
                placeholder="admin"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? t("login.submitting") : t("login.submit")}
            </Button>
          </form>

          {providers.length > 0 && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">ou</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="flex flex-col gap-2">
                {providers.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={ssoLoading !== null}
                    onClick={() => handleSso(p.id)}
                  >
                    {ssoLoading === p.id ? t("login.redirecting") : t("login.continue_with", { name: p.name })}
                  </Button>
                ))}
              </div>
            </>
          )}
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
