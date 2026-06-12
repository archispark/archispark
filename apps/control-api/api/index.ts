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

// registry.ts runs runMigrations() + initUsers() via top-level await at import.
// Catch connection errors here: an unhandled rejection from a transient Redis
// connect timeout would otherwise crash the whole serverless process.
await initRedis().catch((err: Error) => console.error("[redis] init failed:", err.message));
await reloadAuth();

export default app;
