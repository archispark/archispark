import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { db, users, sessions, accounts, verifications } from "@workspace/db";

export const auth = betterAuth({
  baseURL: process.env.API_URL ?? "http://localhost:3000",
  basePath: "/auth",

  database: drizzleAdapter(db, {
    provider: "sqlite",
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
  ],

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
