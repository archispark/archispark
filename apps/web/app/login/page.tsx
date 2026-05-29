"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
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
      const result = await signIn.username({ username, password });
      if (result.error) {
        setError(result.error.message ?? "Identifiants incorrects.");
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="login-spark" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ff1e56" />
                <stop offset="50%" stopColor="#ff3d74" />
                <stop offset="100%" stopColor="#0096ff" />
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
