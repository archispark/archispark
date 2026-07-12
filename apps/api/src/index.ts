/**
 * Public entry point of the `api` workspace package.
 *
 * Consumers (e.g. apps/mcp-server) should import from `"api"` rather than
 * deep `"api/src/*.js"` paths: the `.` export is a plain (non-wildcard)
 * conditional export that Vercel's file tracer (nft) follows into the built
 * `dist/` for serverless bundling, whereas the wildcard `./src/*.js` export
 * does not get traced reliably. Mirror of the `@workspace/db` package's `.`
 * export.
 */
export { lookupApiToken } from "./auth.js"
export type { TokenUser } from "./auth.js"
export * as store from "./store.js"
export { getWorkspaces, activateWorkspace } from "./registry.js"
export type { WorkspaceOut } from "./registry.js"
export { resolveActiveContext, assertWorkspaceAccess } from "./access.js"
export type { AccessUser, Intent, OrgRoleName, TokenContext } from "./access.js"
export { renderViewToSvg } from "./renderer.js"
export {
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  PROPERTY_DEFINITION_TYPES,
  VIEWPOINTS,
} from "./schemas.js"
export type {
  ElementUpdateIn,
  RelationshipUpdateIn,
  PropertyDefinitionUpdateIn,
  ViewUpdateIn,
  NodeUpdateIn,
  ConnectionCreateIn,
  ConnectionUpdateIn,
} from "./schemas.js"
