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
import { initRedis } from "../dist/redis.js";
import { runMigrations } from "@workspace/db";

await initRedis().catch((err: Error) => console.error("[redis] init failed:", err.message));
await runMigrations().catch((err: Error) => console.error("[db] migrations failed:", err.message));

export default app;
