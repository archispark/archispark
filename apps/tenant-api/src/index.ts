/**
 * Public entry point of the `tenant-api` workspace package.
 *
 * Consumers (e.g. apps/mcp-server) should import from `"tenant-api"` rather
 * than deep `"tenant-api/src/*.js"` paths: the `.` export is a plain
 * (non-wildcard) conditional export that Vercel's file tracer (nft) follows
 * into the built `dist/` for serverless bundling, whereas the wildcard
 * `./src/*.js` export does not get traced reliably. Mirror of the
 * `@workspace/db` and `control-api` packages' `.` export.
 */
export * as store from "./store.js";
export { getActiveWorkspaceId, getWorkspaces, activateWorkspace } from "./registry.js";
export type { WorkspaceOut } from "./registry.js";
export type { WorkspaceContext } from "./tenant-auth.js";
export { renderViewToSvg } from "./renderer.js";
export {
  ELEMENT_TYPES,
  RELATIONSHIP_TYPES,
  PROPERTY_DEFINITION_TYPES,
  VIEWPOINTS,
} from "./schemas.js";
export type {
  ElementUpdateIn,
  RelationshipUpdateIn,
  PropertyDefinitionUpdateIn,
  ViewUpdateIn,
  NodeUpdateIn,
  ConnectionCreateIn,
  ConnectionUpdateIn,
} from "./schemas.js";
