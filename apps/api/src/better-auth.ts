import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin, genericOAuth, microsoftEntraId } from "better-auth/plugins";
import { eq, and } from "drizzle-orm";
import { db, dbDriver, users, sessions, accounts, verifications, roles, userRoles, oauthProviders } from "@workspace/db";
import { getRedis } from "./redis.js";

export interface OAuthProvider {
  id: string;
  name: string;
}

async function assignDefaultRbacRole(userId: string): Promise<void> {
  const [userRole] = await db.select().from(roles).where(eq(roles.name, "user"));
  if (!userRole) return;
  const [exists] = await db.select().from(userRoles)
    .where(and(eq(userRoles.roleId, userRole.id), eq(userRoles.userId, userId)));
  if (!exists) {
    await db.insert(userRoles).values({ roleId: userRole.id, userId });
  }
}

/** Build OAuth config from env vars (always available at startup). */
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

/** Build OAuth config from DB-stored providers (loaded after DB init). */
async function buildDbOAuthConfig() {
  try {
    const rows = await db.select().from(oauthProviders).where(eq(oauthProviders.enabled, true));
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

function buildSecondaryStorage() {
  const redis = getRedis();
  if (!redis) return undefined;
  return {
    get: (key: string) => redis.get(key),
    set: async (key: string, value: string, ttl?: number) => {
      if (ttl) await redis.setex(key, ttl, value);
      else await redis.set(key, value);
    },
    delete: async (key: string) => { await redis.del(key); },
  };
}

function createAuthInstance(oauthConfig: unknown[]) {
  const redis = getRedis();
  return betterAuth({
    baseURL: process.env.API_URL ?? "http://localhost:3000",
    basePath: "/auth",

    database: drizzleAdapter(db, {
      provider: dbDriver === "postgres" ? "pg" : "sqlite",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),

    secondaryStorage: buildSecondaryStorage(),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 3,
    },

    plugins: [
      username(),
      admin({
        defaultRole: "user",
        adminRole: "admin",
      }),
      ...(oauthConfig.length > 0 ? [genericOAuth({ config: oauthConfig as Parameters<typeof genericOAuth>[0]["config"] })] : []),
    ],

    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await assignDefaultRbacRole(user.id);
          },
        },
      },
    },

    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: true,
        },
      },
    },

    session: {
      expiresIn: 60 * 60 * 24,
      updateAge: 60 * 60,
      // Cookie cache when Redis absent; Redis covers the caching layer otherwise
      cookieCache: redis ? undefined : { enabled: true, maxAge: 60 * 5 },
    },

    trustedOrigins: [
      process.env.WEB_URL ?? "http://localhost:8000",
    ],

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

  // Env-based providers
  if (process.env.GENERIC_OIDC_CLIENT_ID) {
    providers.push({ id: "generic-oidc", name: process.env.GENERIC_OIDC_NAME ?? "SSO" });
  }
  if (process.env.GOOGLE_CLIENT_ID) providers.push({ id: "google", name: "Google" });
  if (process.env.GITHUB_CLIENT_ID) providers.push({ id: "github", name: "GitHub" });
  if (process.env.ENTRA_CLIENT_ID) providers.push({ id: "microsoft-entra-id", name: "Microsoft" });

  // DB-based providers
  try {
    const rows = await db.select().from(oauthProviders).where(eq(oauthProviders.enabled, true));
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
