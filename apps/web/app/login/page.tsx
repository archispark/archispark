"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { Label } from "@workspace/ui/components/label";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);
    try {
      const token = await login(username, password);
      // Store in cookie (readable by middleware) — 24h expiry
      document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <polygon points="16,2 27,8 27,22 16,28 5,22 5,8" fill="#2563eb" />
            <polygon points="16,9 22,13 22,21 16,25 10,21 10,13" fill="none" stroke="white" strokeWidth="0.8" strokeLinejoin="round" opacity="0.4" />
            <polygon points="16,14 19,16 19,19 16,21 13,19 13,16" fill="white" opacity="0.15" />
          </svg>
          <span className="text-[20px] leading-none tracking-tight" style={{ fontFamily: "'Trebuchet MS', Arial, sans-serif" }}>
            <span className="font-light text-foreground">Archi</span>
            <span className="font-bold text-primary">Spark</span>
          </span>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h1 className="text-base font-semibold mb-1">Connexion</h1>
          <p className="text-[13px] text-muted-foreground mb-5">Entrez vos identifiants pour accéder au modèle.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="username">Nom d&apos;utilisateur</Label>
              <Input
                id="username"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading || !username || !password} className="w-full">
              {loading ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
