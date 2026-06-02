/**
 * Shared ArchiMate model types.
 *
 * These live in `@workspace/db` (the package that owns the schema and model I/O).
 * This module re-exports them so the many `./model.js` imports across the API
 * keep resolving without each file reaching into the db package directly.
 */

export type {
  ArchiColor,
  ArchiFont,
  ArchiElement,
  ArchiRelationship,
  ArchiNode,
  BendPoint,
  EdgeSide,
  ArchiConnection,
  ArchiView,
  ArchiPropertyDefinition,
  ArchiModel,
} from "@workspace/db";
