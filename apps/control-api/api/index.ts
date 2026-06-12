/**
 * Vercel serverless entry point.
 *
 * Vercel detects this file under `api/` and builds it as a Node serverless
 * function with @vercel/node. The catch-all rewrite in vercel.json sends every
 * route here, and Express does its own routing on the original URL.
 *
 * It imports the COMPILED output (`../dist`), which the vercel.json buildCommand
 * produces (it builds @workspace/db and this app with tsc) so the function has no
 * TypeScript / workspace-resolution surprises at bundle time.
 */
import { app } from "../dist/app.js";
import { reloadAuth } from "../dist/better-auth.js";
import { initRedis } from "../dist/redis.js";
import { runMigrations } from "@workspace/db";
import { initUsers } from "../dist/auth.js";

// Initialization order matters: Redis must be ready before initUsers() because
// Better Auth's signUpEmail writes to secondaryStorage (Redis) during user creation.
await initRedis().catch((err: Error) => console.error("[redis] init failed:", err.message));
await runMigrations().catch((err: Error) => console.error("[db] migrations failed:", err.message));
await reloadAuth();
await initUsers().catch((err: Error) => console.error("[auth] initUsers failed:", err.message));

export default app;
