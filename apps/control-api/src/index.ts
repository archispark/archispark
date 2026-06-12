/**
 * Public entry point of the `control-api` workspace package.
 *
 * Consumers (e.g. apps/mcp-server) should import from `"control-api"` rather
 * than deep `"control-api/src/*.js"` paths: the `.` export is a plain
 * (non-wildcard) conditional export that Vercel's file tracer (nft) follows
 * into the built `dist/` for serverless bundling, whereas the wildcard
 * `./src/*.js` export does not get traced reliably. Mirror of the
 * `@workspace/db` package's `.` export.
 */
export { getMembershipContext, lookupApiToken } from "./auth.js";
export type { WorkspaceContext, TokenUser } from "./auth.js";
