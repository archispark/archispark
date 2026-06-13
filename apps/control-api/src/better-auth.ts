import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin, organization, genericOAuth, microsoftEntraId } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { controlDb, users, sessions, accounts, verifications, organizations, members, invitations, teams, teamMembers, oauthProviders } from "@workspace/db";
import { getRedis } from "./redis.js";

export interface OAuthProvider {
  id: string;
  name: string;
}

/** Build OAuth config from env vars (always available at startup). */
/* v8 ignore start */
function buildEnvOAuthConfig() {
  const config = [];

  if (process.env.GENERIC_OIDC_CLIENT_ID) {
    config.push({
      providerId: "generic-oidc",
      clientId: process.env.GENERIC_OIDC_CLIENT_ID,
      clientSecret: process.env.GENERIC_OIDC_CLIENT_SECRET!,
      discoveryUrl: `${process.env.GENERIC_OIDC_ISSUER}/.well-known/openid-configuration`,
      scopes: ["openid", "profile", "email"],
    });
  }

  if (process.env.GOOGLE_CLIENT_ID) {
    config.push({
      providerId: "google",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
      scopes: ["openid", "profile", "email"],
    });
  }

  if (process.env.GITHUB_CLIENT_ID) {
    config.push({
      providerId: "github",
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorizationUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      scopes: ["read:user", "user:email"],
    });
  }

  if (process.env.ENTRA_CLIENT_ID) {
    config.push(microsoftEntraId({
      clientId: process.env.ENTRA_CLIENT_ID,
      clientSecret: process.env.ENTRA_CLIENT_SECRET!,
      tenantId: process.env.ENTRA_TENANT_ID ?? "common",
    }));
  }

  return config;
}
/* v8 ignore stop */

/** Build OAuth config from DB-stored providers (loaded after DB init). */
/* v8 ignore start */
async function buildDbOAuthConfig() {
  try {
    const rows = await controlDb.select().from(oauthProviders).where(eq(oauthProviders.enabled, true));
    return rows.map((p) => {
      if (p.type === "microsoft-entra-id") {
        return microsoftEntraId({
          clientId: p.clientId,
          clientSecret: p.clientSecret,
          tenantId: p.tenantId ?? "common",
        });
      }
      const base = {
        providerId: p.providerId,
        clientId: p.clientId,
        clientSecret: p.clientSecret,
        scopes: ["openid", "profile", "email"],
      };
      if (p.type === "oidc") {
        return { ...base, discoveryUrl: `${p.issuerUrl}/.well-known/openid-configuration` };
      }
      if (p.type === "google") {
        return { ...base, discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration" };
      }
      // github
      return {
        ...base,
        scopes: ["read:user", "user:email"],
        authorizationUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userInfoUrl: "https://api.github.com/user",
      };
    });
  } catch {
    return [];
  }
}

/* v8 ignore stop */

/**
 * Compute the list of trusted origins for CSRF protection.
 *
 * Self-hosted deployments reach the app on a single origin (LAN IP, custom
 * domain) that the web tier forwards to this API. We trust that origin only
 * when its host matches the host actually being served (x-forwarded-host/host),
 * which still blocks true cross-site CSRF (whose Origin host would not match).
 */
export function computeTrustedOrigins(request?: Request): string[] {
  const list = [
    process.env.WEB_URL ?? "http://localhost:8000",
    ...(process.env.TRUSTED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
  ];
  const origin = request?.headers.get("origin");
  const servedHost = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
  if (origin && servedHost) {
    try {
      if (new URL(origin).host === servedHost) list.push(origin);
    } catch { /* malformed Origin header */ }
  }
  return list;
}

/**
 * Compute Better Auth's `advanced` options for cross-subdomain cookies.
 *
 * In SaaS deployments the web app and admin console live on subdomains of a
 * shared root domain (e.g. `app.example.com` / `admin.example.com`). Setting
 * `COOKIE_DOMAIN=.example.com` makes Better Auth issue the session cookie with
 * that `Domain` attribute, so signing in on either subdomain authenticates
 * both. Self-hosted single-origin deployments leave `COOKIE_DOMAIN` unset and
 * get today's behaviour (cookie scoped to the serving origin).
 */
export function computeAdvancedOptions(): { crossSubDomainCookies?: { enabled: true; domain: string } } {
  const domain = process.env.COOKIE_DOMAIN;
  return domain ? { crossSubDomainCookies: { enabled: true, domain } } : {};
}

function createAuthInstance(oauthConfig: unknown[]) {
  return betterAuth({
    baseURL: process.env.API_URL ?? "http://localhost:3000",
    basePath: "/auth",
    advanced: computeAdvancedOptions(),

    database: drizzleAdapter(controlDb, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        organization: organizations,
        member: members,
        invitation: invitations,
        team: teams,
        teamMember: teamMembers,
      },
    }),

    secondaryStorage: {
      get: (key: string) => getRedis().get(key),
      set: async (key: string, value: string, ttl?: number) => {
        if (ttl) await getRedis().setex(key, ttl, value);
        else await getRedis().set(key, value);
      },
      delete: async (key: string) => { await getRedis().del(key); },
    },

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 3,
    },

    plugins: [
      username(),
      admin({
        defaultRole: "user",
        adminRole: "platform_admin",
      }),
      organization({
        teams: { enabled: true },
        // Only the platform super admin can create new organizations.
        allowUserToCreateOrganization: async (user) => user.role === "platform_admin",
        organizationHooks: {
          // Provisioning now triggered synchronously via POST /admin/organizations.
          afterCreateOrganization: async () => {},
        },
      }),
      ...(oauthConfig.length > 0 ? [genericOAuth({ config: oauthConfig as Parameters<typeof genericOAuth>[0]["config"] })] : []),
    ],

    session: {
      expiresIn: 60 * 60 * 24,
      updateAge: 60 * 60,
    },

    trustedOrigins: computeTrustedOrigins,

    secret: process.env.JWT_SECRET ?? "archispark-dev-secret-change-in-prod",
  });
}

let _auth = createAuthInstance(buildEnvOAuthConfig());

export function getAuth() { return _auth; }

/** Reload auth instance merging env + DB providers. Call after provider CRUD. */
export async function reloadAuth(): Promise<void> {
  const dbConfig = await buildDbOAuthConfig();
  const envConfig = buildEnvOAuthConfig();
  // Merge: env providers + DB providers, deduplicate by providerId
  const seen = new Set<string>();
  const merged: unknown[] = [];
  for (const p of [...envConfig, ...dbConfig]) {
    const id = (p as { providerId?: string }).providerId ?? "";
    if (!seen.has(id)) { seen.add(id); merged.push(p); }
  }
  _auth = createAuthInstance(merged);
}

/** Returns currently active providers list (for public /auth/providers endpoint). */
export async function getConfiguredProviders(): Promise<OAuthProvider[]> {
  const providers: OAuthProvider[] = [];

  // Env-based providers — none set in test
  /* v8 ignore start */
  if (process.env.GENERIC_OIDC_CLIENT_ID) {
    providers.push({ id: "generic-oidc", name: process.env.GENERIC_OIDC_NAME ?? "SSO" });
  }
  if (process.env.GOOGLE_CLIENT_ID) providers.push({ id: "google", name: "Google" });
  if (process.env.GITHUB_CLIENT_ID) providers.push({ id: "github", name: "GitHub" });
  if (process.env.ENTRA_CLIENT_ID) providers.push({ id: "microsoft-entra-id", name: "Microsoft" });
  /* v8 ignore stop */

  // DB-based providers
  try {
    const rows = await controlDb.select().from(oauthProviders).where(eq(oauthProviders.enabled, true));
    const envIds = new Set(providers.map((p) => p.id));
    for (const row of rows) {
      if (!envIds.has(row.providerId)) {
        providers.push({ id: row.providerId, name: row.name });
      }
    }
  } catch { /* DB not yet initialised */ }

  return providers;
}

export type Auth = typeof _auth;
