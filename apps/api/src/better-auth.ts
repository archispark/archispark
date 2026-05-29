import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin, genericOAuth, microsoftEntraId } from "better-auth/plugins";
import { eq, and } from "drizzle-orm";
import { db, dbDriver, users, sessions, accounts, verifications, roles, userRoles } from "@workspace/db";

export interface OAuthProvider {
  id: string;
  name: string;
}

export function getConfiguredProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (process.env.GENERIC_OIDC_CLIENT_ID) {
    providers.push({ id: "generic-oidc", name: process.env.GENERIC_OIDC_NAME ?? "SSO" });
  }
  if (process.env.GOOGLE_CLIENT_ID) {
    providers.push({ id: "google", name: "Google" });
  }
  if (process.env.GITHUB_CLIENT_ID) {
    providers.push({ id: "github", name: "GitHub" });
  }
  if (process.env.ENTRA_CLIENT_ID) {
    providers.push({ id: "microsoft-entra-id", name: "Microsoft" });
  }
  return providers;
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

function buildOAuthConfig() {
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

const oauthConfig = buildOAuthConfig();

export const auth = betterAuth({
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
    ...(oauthConfig.length > 0 ? [genericOAuth({ config: oauthConfig })] : []),
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
    expiresIn: 60 * 60 * 24,          // 24h
    updateAge: 60 * 60,                 // refresh every 1h
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  trustedOrigins: [
    process.env.WEB_URL ?? "http://localhost:8000",
  ],

  secret: process.env.JWT_SECRET ?? "archispark-dev-secret-change-in-prod",
});

export type Auth = typeof auth;
