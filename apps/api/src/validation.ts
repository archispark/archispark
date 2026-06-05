import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import type { Response } from "express";
import { ELEMENT_TYPES, RELATIONSHIP_TYPES, PROPERTY_DEFINITION_TYPES, VIEWPOINTS } from "./schemas.js";

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

const elementType = z.string().refine((v) => ELEMENT_TYPES.has(v), {
  message: `Type d'élément ArchiMate invalide. Types valides: ${[...ELEMENT_TYPES].sort().join(", ")}`,
});

const relationshipType = z.string().refine((v) => RELATIONSHIP_TYPES.has(v), {
  message: `Type de relation ArchiMate invalide. Types valides: ${[...RELATIONSHIP_TYPES].sort().join(", ")}`,
});

const propertyDefType = z.string().refine((v) => PROPERTY_DEFINITION_TYPES.has(v), {
  message: `Type invalide. Types valides: ${[...PROPERTY_DEFINITION_TYPES].sort().join(", ")}`,
});

const propertyOut = z.object({
  property_definition_ref: z.string(),
  value: z.string(),
});

// ---------------------------------------------------------------------------
// Route body schemas
// ---------------------------------------------------------------------------

export const ElementCreateSchema = z.object({
  name: z.string().min(1, "Le champ 'name' est requis."),
  type: elementType,
  documentation: z.string().nullable().optional(),
  properties: z.array(propertyOut).optional(),
});

export const ElementUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: elementType.optional(),
  documentation: z.string().nullable().optional(),
  properties: z.array(propertyOut).optional(),
});

export const RelationshipCreateSchema = z.object({
  name: z.string().nullable().optional(),
  type: relationshipType,
  source: z.string({ error: "Le champ 'source' est requis." }).min(1, "Le champ 'source' est requis."),
  target: z.string({ error: "Le champ 'target' est requis." }).min(1, "Le champ 'target' est requis."),
  documentation: z.string().nullable().optional(),
  properties: z.array(propertyOut).optional(),
  access_type: z.string().nullable().optional(),
  is_directed: z.boolean().nullable().optional(),
  influence_strength: z.string().nullable().optional(),
});

export const RelationshipUpdateSchema = z.object({
  name: z.string().nullable().optional(),
  type: relationshipType.optional(),
  source: z.string().optional(),
  target: z.string().optional(),
  documentation: z.string().nullable().optional(),
  properties: z.array(propertyOut).optional(),
  access_type: z.string().nullable().optional(),
  is_directed: z.boolean().nullable().optional(),
  influence_strength: z.string().nullable().optional(),
});

export const ViewCreateSchema = z.object({
  name: z.string().min(1, "Le champ 'name' est requis."),
  viewpoint: z.string().refine((v) => VIEWPOINTS.has(v), { message: "Viewpoint invalide." }).nullable().optional(),
  documentation: z.string().nullable().optional(),
});

export const ViewUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  viewpoint: z.string().nullable().optional(),
  documentation: z.string().nullable().optional(),
});

export const NodeCreateSchema = z.object({
  element_id: z.string().min(1, "Le champ 'element_id' est requis."),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  w: z.number().nullable().optional(),
  h: z.number().nullable().optional(),
});

export const NodeUpdateSchema = z.object({
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  w: z.number().nullable().optional(),
  h: z.number().nullable().optional(),
  name: z.string().nullable().optional(),
});

export const ConnectionCreateSchema = z.object({
  relationship_id: z.string().nullable().optional(),
  source: z.string().min(1, "Le champ 'source' est requis."),
  target: z.string().min(1, "Le champ 'target' est requis."),
  name: z.string().nullable().optional(),
  source_side: z.enum(["top", "right", "bottom", "left"]).nullable().optional(),
  target_side: z.enum(["top", "right", "bottom", "left"]).nullable().optional(),
});

export const ConnectionUpdateSchema = z.object({
  name: z.string().nullable().optional(),
  source: z.string().optional(),
  target: z.string().optional(),
  source_side: z.enum(["top", "right", "bottom", "left"]).nullable().optional(),
  target_side: z.enum(["top", "right", "bottom", "left"]).nullable().optional(),
});

export const PropertyDefinitionCreateSchema = z.object({
  name: z.string().min(1, "Le champ 'name' est requis."),
  type: propertyDefType.optional(),
});

export const PropertyDefinitionUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  type: propertyDefType.optional(),
});

export const WorkspaceCreateSchema = z.object({
  name: z.string().min(1, "Le champ 'name' est requis."),
  path: z.string().optional(),
});

export const WorkspaceUpdateSchema = z.object({
  name: z.string().min(1, "Le champ 'name' est requis."),
});

export const RoleCreateSchema = z.object({
  name: z.string().min(1, "Le champ 'name' est requis."),
  description: z.string().nullable().optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
});

export const RoleUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  permissions: z.record(z.string(), z.array(z.string())).optional(),
});

// ---------------------------------------------------------------------------
// Query string schemas
// ---------------------------------------------------------------------------

export const ElementQuerySchema = z.object({
  type: z.string().refine((v) => ELEMENT_TYPES.has(v), { message: "Type d'élément ArchiMate invalide." }).optional(),
  name: z.string().optional(),
});

export const RelationshipQuerySchema = z.object({
  type: z.string().refine((v) => RELATIONSHIP_TYPES.has(v), { message: "Type de relation ArchiMate invalide." }).optional(),
  source_id: z.string().optional(),
  target_id: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

export function parseBody<T>(schema: z.ZodType<T>, body: unknown, res: Response): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    res.status(422).json({ detail: first?.message ?? "Validation échouée." });
    return null;
  }
  return result.data;
}
