/**
 * Vercel serverless entry point.
 *
 * Mirrors apps/api/api/index.ts. Vercel detects this file under `api/` and
 * builds it as a Node serverless function with @vercel/node; the catch-all
 * rewrite in vercel.json sends every route here and Express routes `/mcp/`
 * internally.
 *
 * It imports the COMPILED output (`../dist/server.js`). The vercel.json
 * buildCommand builds @workspace/db, the api package, and this app with tsc, so
 * the api workspace's `./src/*.js` exports resolve to its built `dist/*.js` at
 * runtime (no source-only paths to chase, no workspace-resolution surprises).
 */
import { app } from "../dist/server.js";

export default app;
