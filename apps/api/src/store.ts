/**
 * Data-access layer — the DB is the single source of truth.
 *
 * Every function is workspace-scoped (takes `wsId`) and reads/writes PostgreSQL
 * directly at row level (no in-memory model, no full-workspace replace). This
 * makes the API stateless: any instance can serve any request, and concurrent
 * edits to different rows no longer clobber each other.
 *
 * Returns the same DTO shapes as before via the pure converters in
 * serializers.js, so the HTTP layer (app.ts) and MCP server stay thin.
 */

import { randomUUID } from "crypto";
import { and, eq, or, inArray, count } from "drizzle-orm";
import {
  db,
  workspaces, elements, relationships, propertyDefinitions,
  elementProperties, relationshipProperties, views, nodes, connections,
  buildNodeTree, modelFromDb, modelToDb,
} from "@workspace/db";
import type { ArchiModel } from "@workspace/db";
import { parseOpenExchange } from "./oxf-parser.js";
import { serializeToOpenExchange } from "./oxf-serializer.js";

/** Load the full workspace model (object graph) — for render/export consumers. */
export async function loadModel(wsId: number): Promise<ArchiModel> {
  return modelFromDb(wsId);
}
import type {
  ArchiElement, ArchiRelationship, ArchiNode, ArchiConnection, ArchiView,
} from "@workspace/db";
import { elementOut, relOut, nodeOut, viewOut, pdOut } from "./serializers.js";
import { NotFoundError, ValidationError } from "./errors.js";
import type {
  ElementCreateIn, ElementUpdateIn, ElementOut,
  RelationshipCreateIn, RelationshipUpdateIn, RelationshipOut,
  ViewCreateIn, ViewUpdateIn, ViewOut, ViewDetailOut,
  NodeCreateIn, NodeUpdateIn, NodeOut,
  ConnectionCreateIn, ConnectionUpdateIn, ConnectionOut,
  PropertyDefinitionCreateIn, PropertyDefinitionUpdateIn, PropertyDefinitionOut,
  ModelInfo,
} from "./schemas.js";

/** xs:ID / NCName requires the first char to be a letter or underscore. */
function newId(): string {
  return `id-${randomUUID()}`;
}

// ---------------------------------------------------------------------------
// ArchiMate relationship validation (mirrors apps/web/lib/archimate-rules.ts)
// ---------------------------------------------------------------------------

type ArchiCategory = "active" | "behavior" | "passive" | "motivation" | "strategy" | "implementation" | "composite" | "junction" | "other";

const ARCHIMATE_CATEGORY: Record<string, ArchiCategory> = {
  BusinessActor: "active", BusinessRole: "active", BusinessCollaboration: "active", BusinessInterface: "active",
  ApplicationComponent: "active", ApplicationCollaboration: "active", ApplicationInterface: "active",
  Node: "active", Device: "active", SystemSoftware: "active", TechnologyCollaboration: "active",
  TechnologyInterface: "active", Path: "active", CommunicationNetwork: "active",
  Equipment: "active", Facility: "active", DistributionNetwork: "active",
  BusinessProcess: "behavior", BusinessFunction: "behavior", BusinessInteraction: "behavior",
  BusinessEvent: "behavior", BusinessService: "behavior",
  ApplicationFunction: "behavior", ApplicationInteraction: "behavior", ApplicationProcess: "behavior",
  ApplicationEvent: "behavior", ApplicationService: "behavior",
  TechnologyFunction: "behavior", TechnologyProcess: "behavior", TechnologyInteraction: "behavior",
  TechnologyEvent: "behavior", TechnologyService: "behavior",
  BusinessObject: "passive", Contract: "passive", Representation: "passive", Product: "passive",
  DataObject: "passive", Artifact: "passive", Material: "passive",
  Stakeholder: "motivation", Driver: "motivation", Assessment: "motivation", Goal: "motivation",
  Outcome: "motivation", Principle: "motivation", Requirement: "motivation",
  Constraint: "motivation", Meaning: "motivation", Value: "motivation",
  Resource: "strategy", Capability: "strategy", ValueStream: "strategy", CourseOfAction: "strategy",
  WorkPackage: "implementation", Deliverable: "implementation",
  ImplementationEvent: "implementation", Plateau: "implementation", Gap: "implementation",
  Grouping: "composite", Location: "composite",
  Junction: "junction", AndJunction: "junction", OrJunction: "junction",
};

const STRUCTURAL: ArchiCategory[] = ["active", "passive", "composite", "strategy", "implementation", "behavior"];

function isRelationshipAllowed(relType: string, srcType?: string, tgtType?: string): boolean {
  if (!srcType || !tgtType) return true;
  const s: ArchiCategory = ARCHIMATE_CATEGORY[srcType] ?? "other";
  const t: ArchiCategory = ARCHIMATE_CATEGORY[tgtType] ?? "other";
  if (relType === "Association") return true;
  if (relType === "Specialization") return srcType === tgtType;
  if (relType === "Composition" || relType === "Aggregation") return STRUCTURAL.includes(s) && STRUCTURAL.includes(t);
  if (relType === "Assignment") {
    if (s === "active" && (t === "behavior" || t === "passive" || t === "active")) return true;
    if (s === "behavior" && t === "passive") return true;
    return false;
  }
  if (relType === "Realization") {
    if (s === "behavior" && (t === "behavior" || t === "passive")) return true;
    if (s === "active" && t === "behavior") return true;
    if (s === "implementation") return true;
    if (s === "strategy" && (t === "strategy" || t === "motivation" || t === "behavior")) return true;
    if (t === "motivation") return true;
    return false;
  }
  if (relType === "Serving") return (s === "behavior" || s === "active") && (t === "active" || t === "behavior");
  if (relType === "Triggering" || relType === "Flow") {
    if (s === "behavior" && t === "behavior") return true;
    if (relType === "Flow" && s === "active" && t === "active") return true;
    if (s === "junction" || t === "junction") return true;
    return false;
  }
  if (relType === "Access") return (s === "behavior" && t === "passive") || (s === "passive" && t === "behavior");
  if (relType === "Influence") return s === "motivation" || t === "motivation";
  return false;
}

// ---------------------------------------------------------------------------
// Property loaders (element / relationship key-value metadata)
// ---------------------------------------------------------------------------

async function elementPropsByDbId(elemDbIds: number[]): Promise<Map<number, Record<string, string>>> {
  const map = new Map<number, Record<string, string>>();
  if (elemDbIds.length === 0) return map;
  const rows = await db.select().from(elementProperties).where(inArray(elementProperties.elementId, elemDbIds));
  for (const r of rows) {
    const m = map.get(r.elementId) ?? {};
    m[r.propertyDefUuid] = r.value;
    map.set(r.elementId, m);
  }
  return map;
}

async function relPropsByDbId(relDbIds: number[]): Promise<Map<number, Record<string, string>>> {
  const map = new Map<number, Record<string, string>>();
  if (relDbIds.length === 0) return map;
  const rows = await db.select().from(relationshipProperties).where(inArray(relationshipProperties.relationshipId, relDbIds));
  for (const r of rows) {
    const m = map.get(r.relationshipId) ?? {};
    m[r.propertyDefUuid] = r.value;
    map.set(r.relationshipId, m);
  }
  return map;
}

/** uuid → minimal element (for resolving relationship source/target names). */
async function elementNameMap(wsId: number): Promise<Map<string, ArchiElement>> {
  const rows = await db.select().from(elements).where(eq(elements.workspaceId, wsId));
  return new Map(rows.map((r) => [r.uuid, { uuid: r.uuid, name: r.name, type: r.type, desc: r.description ?? null, props: {} }]));
}

function rowToElement(r: typeof elements.$inferSelect, props: Record<string, string>): ArchiElement {
  return { uuid: r.uuid, name: r.name, type: r.type, desc: r.description ?? null, props };
}

function rowToRelationship(
  r: typeof relationships.$inferSelect,
  props: Record<string, string>,
  elemMap: Map<string, ArchiElement>,
): ArchiRelationship {
  return {
    uuid: r.uuid,
    name: r.name ?? null,
    type: r.type,
    source: elemMap.get(r.sourceUuid) ?? r.sourceUuid,
    target: elemMap.get(r.targetUuid) ?? r.targetUuid,
    desc: r.description ?? null,
    props,
    access_type: r.accessType ?? null,
    is_directed: r.isDirected ?? null,
    influence_strength: r.influenceModifier ?? null,
  };
}

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

export async function listElementTypes(wsId: number): Promise<string[]> {
  const rows = await db.select().from(elements).where(eq(elements.workspaceId, wsId));
  return [...new Set(rows.map((e) => e.type).filter(Boolean))].sort();
}

export async function listElements(wsId: number, element_type?: string | null, name?: string | null): Promise<ElementOut[]> {
  const conds = [eq(elements.workspaceId, wsId)];
  if (element_type) conds.push(eq(elements.type, element_type));
  let rows = await db.select().from(elements).where(and(...conds));
  if (name) {
    const nl = name.toLowerCase();
    rows = rows.filter((e) => e.name && e.name.toLowerCase().includes(nl));
  }
  const propsMap = await elementPropsByDbId(rows.map((r) => r.id));
  return rows.map((r) => elementOut(rowToElement(r, propsMap.get(r.id) ?? {})));
}

export async function getElementById(wsId: number, elementId: string): Promise<ElementOut> {
  const [row] = await db.select().from(elements).where(and(eq(elements.workspaceId, wsId), eq(elements.uuid, elementId)));
  if (!row) throw new NotFoundError(`Élément '${elementId}' introuvable.`);
  const propsMap = await elementPropsByDbId([row.id]);
  return elementOut(rowToElement(row, propsMap.get(row.id) ?? {}));
}

export async function getElementRelationships(wsId: number, elementId: string): Promise<RelationshipOut[]> {
  const rows = await db.select().from(relationships).where(and(
    eq(relationships.workspaceId, wsId),
    or(eq(relationships.sourceUuid, elementId), eq(relationships.targetUuid, elementId)),
  ));
  const elemMap = await elementNameMap(wsId);
  const propsMap = await relPropsByDbId(rows.map((r) => r.id));
  return rows.map((r) => relOut(rowToRelationship(r, propsMap.get(r.id) ?? {}, elemMap)));
}

export async function listElementsInViews(wsId: number): Promise<string[]> {
  const rows = await db.select({ elementUuid: nodes.elementUuid })
    .from(nodes).innerJoin(views, eq(nodes.viewId, views.id))
    .where(eq(views.workspaceId, wsId));
  return [...new Set(rows.map((r) => r.elementUuid).filter((u): u is string => !!u))];
}

export async function createElement(wsId: number, input: ElementCreateIn): Promise<ElementOut> {
  const uuid = newId();
  const [row] = await db.insert(elements).values({
    workspaceId: wsId, uuid, type: input.type, name: input.name, description: input.documentation ?? null,
  }).returning();
  if (!row) throw new Error("Failed to create element");
  const props = propsIn(input.properties);
  for (const [defUuid, value] of Object.entries(props)) {
    await db.insert(elementProperties).values({ elementId: row.id, propertyDefUuid: defUuid, value });
  }
  return elementOut(rowToElement(row, props));
}

export async function updateElement(wsId: number, elementId: string, input: ElementUpdateIn): Promise<ElementOut> {
  const [row] = await db.select().from(elements).where(and(eq(elements.workspaceId, wsId), eq(elements.uuid, elementId)));
  if (!row) throw new NotFoundError(`Élément '${elementId}' introuvable.`);
  const patch: Partial<typeof elements.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (input.documentation !== undefined) patch.description = input.documentation ?? null;
  if (Object.keys(patch).length > 0) await db.update(elements).set(patch).where(eq(elements.id, row.id));
  if (input.properties !== undefined) {
    await db.delete(elementProperties).where(eq(elementProperties.elementId, row.id));
    for (const [defUuid, value] of Object.entries(propsIn(input.properties))) {
      await db.insert(elementProperties).values({ elementId: row.id, propertyDefUuid: defUuid, value });
    }
  }
  return getElementById(wsId, elementId);
}

export async function deleteElement(wsId: number, elementId: string): Promise<void> {
  const [row] = await db.select().from(elements).where(and(eq(elements.workspaceId, wsId), eq(elements.uuid, elementId)));
  if (!row) throw new NotFoundError(`Élément '${elementId}' introuvable.`);
  // Remove relationships referencing this element, and view nodes that point to it.
  await db.delete(relationships).where(and(
    eq(relationships.workspaceId, wsId),
    or(eq(relationships.sourceUuid, elementId), eq(relationships.targetUuid, elementId)),
  ));
  const wsViews = await db.select({ id: views.id }).from(views).where(eq(views.workspaceId, wsId));
  if (wsViews.length > 0) {
    await db.delete(nodes).where(and(
      inArray(nodes.viewId, wsViews.map((v) => v.id)),
      eq(nodes.elementUuid, elementId),
    ));
  }
  await db.delete(elements).where(eq(elements.id, row.id)); // cascades element_properties
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

export async function listRelationshipTypes(wsId: number): Promise<string[]> {
  const rows = await db.select().from(relationships).where(eq(relationships.workspaceId, wsId));
  return [...new Set(rows.map((r) => r.type).filter(Boolean))].sort();
}

export async function listRelationships(
  wsId: number, rel_type?: string | null, source_id?: string | null, target_id?: string | null,
): Promise<RelationshipOut[]> {
  const conds = [eq(relationships.workspaceId, wsId)];
  if (rel_type) conds.push(eq(relationships.type, rel_type));
  if (source_id) conds.push(eq(relationships.sourceUuid, source_id));
  if (target_id) conds.push(eq(relationships.targetUuid, target_id));
  const rows = await db.select().from(relationships).where(and(...conds));
  const elemMap = await elementNameMap(wsId);
  const propsMap = await relPropsByDbId(rows.map((r) => r.id));
  return rows.map((r) => relOut(rowToRelationship(r, propsMap.get(r.id) ?? {}, elemMap)));
}

export async function getRelationshipById(wsId: number, relationshipId: string): Promise<RelationshipOut> {
  const [row] = await db.select().from(relationships).where(and(eq(relationships.workspaceId, wsId), eq(relationships.uuid, relationshipId)));
  if (!row) throw new NotFoundError(`Relation '${relationshipId}' introuvable.`);
  const elemMap = await elementNameMap(wsId);
  const propsMap = await relPropsByDbId([row.id]);
  return relOut(rowToRelationship(row, propsMap.get(row.id) ?? {}, elemMap));
}

export async function createRelationship(wsId: number, input: RelationshipCreateIn): Promise<RelationshipOut> {
  const [src] = await db.select().from(elements).where(and(eq(elements.workspaceId, wsId), eq(elements.uuid, input.source)));
  if (!src) throw new ValidationError(`Élément source '${input.source}' introuvable.`);
  const [tgt] = await db.select().from(elements).where(and(eq(elements.workspaceId, wsId), eq(elements.uuid, input.target)));
  if (!tgt) throw new ValidationError(`Élément cible '${input.target}' introuvable.`);
  const uuid = newId();
  const [row] = await db.insert(relationships).values({
    workspaceId: wsId, uuid, type: input.type, name: input.name ?? null,
    description: input.documentation ?? null, sourceUuid: input.source, targetUuid: input.target,
    accessType: input.access_type ?? null,
    isDirected: input.is_directed ?? null,
    influenceModifier: input.influence_strength ?? null,
  }).returning();
  if (!row) throw new Error("Failed to create relationship");
  const props = propsIn(input.properties);
  for (const [defUuid, value] of Object.entries(props)) {
    await db.insert(relationshipProperties).values({ relationshipId: row.id, propertyDefUuid: defUuid, value });
  }
  return getRelationshipById(wsId, uuid);
}

export async function updateRelationship(wsId: number, relationshipId: string, input: RelationshipUpdateIn): Promise<RelationshipOut> {
  const [row] = await db.select().from(relationships).where(and(eq(relationships.workspaceId, wsId), eq(relationships.uuid, relationshipId)));
  if (!row) throw new NotFoundError(`Relation '${relationshipId}' introuvable.`);
  if (input.source !== undefined) {
    const [src] = await db.select({ id: elements.id }).from(elements).where(and(eq(elements.workspaceId, wsId), eq(elements.uuid, input.source)));
    if (!src) throw new ValidationError(`Élément source '${input.source}' introuvable.`);
  }
  if (input.target !== undefined) {
    const [tgt] = await db.select({ id: elements.id }).from(elements).where(and(eq(elements.workspaceId, wsId), eq(elements.uuid, input.target)));
    if (!tgt) throw new ValidationError(`Élément cible '${input.target}' introuvable.`);
  }
  const patch: Partial<typeof relationships.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (input.source !== undefined) patch.sourceUuid = input.source;
  if (input.target !== undefined) patch.targetUuid = input.target;
  if (input.documentation !== undefined) patch.description = input.documentation ?? null;
  if (input.access_type !== undefined) patch.accessType = input.access_type;
  if (input.is_directed !== undefined) patch.isDirected = input.is_directed;
  if (input.influence_strength !== undefined) patch.influenceModifier = input.influence_strength;
  if (Object.keys(patch).length > 0) await db.update(relationships).set(patch).where(eq(relationships.id, row.id));
  if (input.properties !== undefined) {
    await db.delete(relationshipProperties).where(eq(relationshipProperties.relationshipId, row.id));
    for (const [defUuid, value] of Object.entries(propsIn(input.properties))) {
      await db.insert(relationshipProperties).values({ relationshipId: row.id, propertyDefUuid: defUuid, value });
    }
  }
  return getRelationshipById(wsId, relationshipId);
}

export async function deleteRelationship(wsId: number, relationshipId: string): Promise<void> {
  const [row] = await db.select({ id: relationships.id }).from(relationships).where(and(eq(relationships.workspaceId, wsId), eq(relationships.uuid, relationshipId)));
  if (!row) throw new NotFoundError(`Relation '${relationshipId}' introuvable.`);
  await db.delete(relationships).where(eq(relationships.id, row.id)); // cascades relationship_properties
}

// ---------------------------------------------------------------------------
// Property definitions
// ---------------------------------------------------------------------------

export async function listPropertyDefinitions(wsId: number): Promise<PropertyDefinitionOut[]> {
  const rows = await db.select().from(propertyDefinitions).where(eq(propertyDefinitions.workspaceId, wsId));
  return rows.map((r) => pdOut({ uuid: r.uuid, name: r.name, type: r.type }));
}

export async function getPropertyDefinitionById(wsId: number, id: string): Promise<PropertyDefinitionOut> {
  const [row] = await db.select().from(propertyDefinitions).where(and(eq(propertyDefinitions.workspaceId, wsId), eq(propertyDefinitions.uuid, id)));
  if (!row) throw new NotFoundError(`Définition de propriété '${id}' introuvable.`);
  return pdOut({ uuid: row.uuid, name: row.name, type: row.type });
}

export async function createPropertyDefinition(wsId: number, input: PropertyDefinitionCreateIn): Promise<PropertyDefinitionOut> {
  const uuid = newId();
  const [row] = await db.insert(propertyDefinitions).values({
    workspaceId: wsId, uuid, name: input.name, type: input.type ?? "string",
  }).returning();
  if (!row) throw new Error("Failed to create property definition");
  return pdOut({ uuid: row.uuid, name: row.name, type: row.type });
}

export async function updatePropertyDefinition(wsId: number, id: string, input: PropertyDefinitionUpdateIn): Promise<PropertyDefinitionOut> {
  const [row] = await db.select().from(propertyDefinitions).where(and(eq(propertyDefinitions.workspaceId, wsId), eq(propertyDefinitions.uuid, id)));
  if (!row) throw new NotFoundError(`Définition de propriété '${id}' introuvable.`);
  const patch: Partial<typeof propertyDefinitions.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.type !== undefined) patch.type = input.type;
  if (Object.keys(patch).length > 0) await db.update(propertyDefinitions).set(patch).where(eq(propertyDefinitions.id, row.id));
  return getPropertyDefinitionById(wsId, id);
}

export async function deletePropertyDefinition(wsId: number, id: string): Promise<void> {
  const [row] = await db.select({ id: propertyDefinitions.id }).from(propertyDefinitions).where(and(eq(propertyDefinitions.workspaceId, wsId), eq(propertyDefinitions.uuid, id)));
  if (!row) throw new NotFoundError(`Définition de propriété '${id}' introuvable.`);
  await db.delete(propertyDefinitions).where(eq(propertyDefinitions.id, row.id));
  // Drop the property values keyed by this definition on elements/relationships of the workspace.
  const elemIds = (await db.select({ id: elements.id }).from(elements).where(eq(elements.workspaceId, wsId))).map((e) => e.id);
  if (elemIds.length > 0) {
    await db.delete(elementProperties).where(and(inArray(elementProperties.elementId, elemIds), eq(elementProperties.propertyDefUuid, id)));
  }
  const relIds = (await db.select({ id: relationships.id }).from(relationships).where(eq(relationships.workspaceId, wsId))).map((r) => r.id);
  if (relIds.length > 0) {
    await db.delete(relationshipProperties).where(and(inArray(relationshipProperties.relationshipId, relIds), eq(relationshipProperties.propertyDefUuid, id)));
  }
}

// ---------------------------------------------------------------------------
// Views / nodes / connections
// ---------------------------------------------------------------------------

async function requireView(wsId: number, viewId: string): Promise<typeof views.$inferSelect> {
  const [row] = await db.select().from(views).where(and(eq(views.workspaceId, wsId), eq(views.uuid, viewId)));
  if (!row) throw new NotFoundError(`Vue '${viewId}' introuvable.`);
  return row;
}

/** Build the full ArchiView (node tree + connections) for one view row. */
async function buildView(v: typeof views.$inferSelect): Promise<ArchiView> {
  const nodeRows = await db.select().from(nodes).where(eq(nodes.viewId, v.id));
  const rootNodes = buildNodeTree(nodeRows, null, new Map());
  const connRows = await db.select().from(connections).where(eq(connections.viewId, v.id));
  const archiConns: ArchiConnection[] = connRows.map((c) => ({
    uuid: c.uuid,
    name: c.name ?? null,
    ref: c.relationshipUuid ?? null,
    source: c.sourceNodeUuid ?? null,
    target: c.targetNodeUuid ?? null,
    line_color: null,
    font_name: c.fontName ?? null,
    font_size: c.fontSize ?? null,
    font_color: null,
    line_width: c.lineWidth ?? null,
  }));
  return {
    uuid: v.uuid,
    name: v.name,
    desc: v.description ?? null,
    primary_viewpoint: v.viewpoint ?? null,
    nodes: rootNodes,
    conns: archiConns,
  };
}

/** Compute ok_count / conflict_count for a list of view DB IDs. */
async function computeStatusCounts(
  wsId: number,
  viewIds: number[],
): Promise<Map<number, { ok: number; conflict: number }>> {
  if (viewIds.length === 0) return new Map();

  const connRows = await db
    .select({ viewId: connections.viewId, relUuid: connections.relationshipUuid })
    .from(connections)
    .where(inArray(connections.viewId, viewIds));

  const relUuids = [...new Set(connRows.map((c) => c.relUuid).filter((u): u is string => !!u))];
  const relTypeMap = new Map<string, { type: string; srcUuid: string; tgtUuid: string }>();
  if (relUuids.length > 0) {
    const relRows = await db
      .select({ uuid: relationships.uuid, type: relationships.type, srcUuid: relationships.sourceUuid, tgtUuid: relationships.targetUuid })
      .from(relationships)
      .where(and(eq(relationships.workspaceId, wsId), inArray(relationships.uuid, relUuids)));
    for (const r of relRows) relTypeMap.set(r.uuid, { type: r.type, srcUuid: r.srcUuid, tgtUuid: r.tgtUuid });
  }

  const elementUuids = [...new Set([...relTypeMap.values()].flatMap((r) => [r.srcUuid, r.tgtUuid]))];
  const elementTypeMap = new Map<string, string>();
  if (elementUuids.length > 0) {
    const elRows = await db
      .select({ uuid: elements.uuid, type: elements.type })
      .from(elements)
      .where(and(eq(elements.workspaceId, wsId), inArray(elements.uuid, elementUuids)));
    for (const e of elRows) elementTypeMap.set(e.uuid, e.type);
  }

  const result = new Map<number, { ok: number; conflict: number }>();
  for (const c of connRows) {
    if (!c.relUuid) continue;
    const rel = relTypeMap.get(c.relUuid);
    if (!rel) continue;
    const entry = result.get(c.viewId) ?? { ok: 0, conflict: 0 };
    if (isRelationshipAllowed(rel.type, elementTypeMap.get(rel.srcUuid), elementTypeMap.get(rel.tgtUuid))) {
      entry.ok += 1;
    } else {
      entry.conflict += 1;
    }
    result.set(c.viewId, entry);
  }
  return result;
}

export async function getElementViews(wsId: number, elementId: string): Promise<ViewOut[]> {
  const rows = await db
    .select({ view: views })
    .from(nodes)
    .innerJoin(views, eq(nodes.viewId, views.id))
    .where(and(eq(views.workspaceId, wsId), eq(nodes.elementUuid, elementId)));
  const seen = new Set<number>();
  const viewRows: (typeof views.$inferSelect)[] = [];
  for (const { view: v } of rows) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    viewRows.push(v);
  }
  if (viewRows.length === 0) return [];
  return buildViewOutList(wsId, viewRows);
}

export async function listViews(wsId: number): Promise<ViewOut[]> {
  const viewRows = await db.select().from(views).where(eq(views.workspaceId, wsId));
  return buildViewOutList(wsId, viewRows);
}

async function buildViewOutList(wsId: number, viewRows: (typeof views.$inferSelect)[]): Promise<ViewOut[]> {
  if (viewRows.length === 0) return [];
  const viewIds = viewRows.map((v) => v.id);

  const [nodeCounts, connCounts, statusMap] = await Promise.all([
    db.select({ viewId: nodes.viewId, c: count() }).from(nodes).where(inArray(nodes.viewId, viewIds)).groupBy(nodes.viewId),
    db.select({ viewId: connections.viewId, c: count() }).from(connections).where(inArray(connections.viewId, viewIds)).groupBy(connections.viewId),
    computeStatusCounts(wsId, viewIds),
  ]);

  const nodeCountMap = new Map(nodeCounts.map((r) => [r.viewId, Number(r.c)]));
  const connCountMap = new Map(connCounts.map((r) => [r.viewId, Number(r.c)]));

  return viewRows.map((v) => {
    const status = statusMap.get(v.id) ?? { ok: 0, conflict: 0 };
    return {
      identifier: v.uuid,
      name: v.name || "",
      documentation: v.description ?? null,
      viewpoint: v.viewpoint ?? null,
      node_count: nodeCountMap.get(v.id) ?? 0,
      connection_count: connCountMap.get(v.id) ?? 0,
      ok_count: status.ok,
      conflict_count: status.conflict,
    };
  });
}

export async function getViewById(wsId: number, viewId: string): Promise<ViewDetailOut> {
  const v = await requireView(wsId, viewId);
  return viewOut(await buildView(v), true);
}

export async function createView(wsId: number, input: ViewCreateIn): Promise<ViewDetailOut> {
  const uuid = newId();
  const [row] = await db.insert(views).values({
    workspaceId: wsId, uuid, name: input.name, description: input.documentation ?? null, viewpoint: input.viewpoint ?? null,
  }).returning();
  if (!row) throw new Error("Failed to create view");
  return viewOut(await buildView(row), true);
}

export async function updateView(wsId: number, viewId: string, input: ViewUpdateIn): Promise<ViewDetailOut> {
  const v = await requireView(wsId, viewId);
  const patch: Partial<typeof views.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.documentation !== undefined) patch.description = input.documentation ?? null;
  if (input.viewpoint !== undefined) patch.viewpoint = input.viewpoint ?? null;
  if (Object.keys(patch).length > 0) await db.update(views).set(patch).where(eq(views.id, v.id));
  return getViewById(wsId, viewId);
}

export async function deleteView(wsId: number, viewId: string): Promise<void> {
  const v = await requireView(wsId, viewId);
  await db.delete(views).where(eq(views.id, v.id)); // cascades nodes/connections/bendpoints
}

async function findNode(viewDbId: number, nodeUuid: string): Promise<typeof nodes.$inferSelect | null> {
  const [row] = await db.select().from(nodes).where(and(eq(nodes.viewId, viewDbId), eq(nodes.uuid, nodeUuid)));
  return row ?? null;
}

function findInTree(tree: ArchiNode[], uuid: string): ArchiNode | null {
  for (const n of tree) {
    if (n.uuid === uuid) return n;
    const inner = findInTree(n.nodes, uuid);
    if (inner) return inner;
  }
  return null;
}

/** Load a node (with its child subtree) from the DB and convert to NodeOut. */
async function loadNodeOut(viewDbId: number, nodeUuid: string): Promise<NodeOut> {
  const nodeRows = await db.select().from(nodes).where(eq(nodes.viewId, viewDbId));
  const tree = buildNodeTree(nodeRows, null, new Map());
  const found = findInTree(tree, nodeUuid);
  if (!found) throw new NotFoundError(`Nœud '${nodeUuid}' introuvable dans la vue.`);
  return nodeOut(found);
}

export async function createNode(wsId: number, viewId: string, input: NodeCreateIn): Promise<NodeOut> {
  const v = await requireView(wsId, viewId);
  const [el] = await db.select({ id: elements.id }).from(elements).where(and(eq(elements.workspaceId, wsId), eq(elements.uuid, input.element_id)));
  if (!el) throw new NotFoundError(`Élément '${input.element_id}' introuvable.`);
  const [maxRow] = await db.select({ c: count() }).from(nodes).where(eq(nodes.viewId, v.id));
  const [row] = await db.insert(nodes).values({
    viewId: v.id, uuid: newId(), name: null, elementUuid: input.element_id, parentNodeUuid: null,
    x: input.x ?? null, y: input.y ?? null, w: input.w ?? null, h: input.h ?? null,
    sortOrder: Number(maxRow?.c ?? 0),
  }).returning();
  if (!row) throw new Error("Failed to create node");
  return loadNodeOut(v.id, row.uuid);
}

export async function updateViewNode(wsId: number, viewId: string, nodeUuid: string, input: NodeUpdateIn): Promise<NodeOut> {
  const v = await requireView(wsId, viewId);
  const n = await findNode(v.id, nodeUuid);
  if (!n) throw new NotFoundError(`Nœud '${nodeUuid}' introuvable dans la vue.`);
  const patch: Partial<typeof nodes.$inferInsert> = {};
  if (input.x !== undefined) patch.x = input.x;
  if (input.y !== undefined) patch.y = input.y;
  if (input.w !== undefined) patch.w = input.w;
  if (input.h !== undefined) patch.h = input.h;
  if (input.name !== undefined) patch.name = input.name;
  if (Object.keys(patch).length > 0) await db.update(nodes).set(patch).where(eq(nodes.id, n.id));
  return loadNodeOut(v.id, nodeUuid);
}

export async function deleteViewNode(wsId: number, viewId: string, nodeUuid: string): Promise<void> {
  const v = await requireView(wsId, viewId);
  const n = await findNode(v.id, nodeUuid);
  if (!n) throw new NotFoundError(`Nœud '${nodeUuid}' introuvable dans la vue.`);
  await db.delete(nodes).where(eq(nodes.id, n.id)); // cascades child nodes via FK? parent is by uuid, not FK — drop children explicitly
  await db.delete(nodes).where(and(eq(nodes.viewId, v.id), eq(nodes.parentNodeUuid, nodeUuid)));
  // Drop connections that reference the removed node.
  await db.delete(connections).where(and(
    eq(connections.viewId, v.id),
    or(eq(connections.sourceNodeUuid, nodeUuid), eq(connections.targetNodeUuid, nodeUuid)),
  ));
}

function connRowToOut(c: typeof connections.$inferSelect, sourceSide: string | null, targetSide: string | null): ConnectionOut {
  return {
    identifier: c.uuid,
    name: c.name ?? null,
    relationship_ref: c.relationshipUuid ?? null,
    source: c.sourceNodeUuid ?? null,
    target: c.targetNodeUuid ?? null,
    source_side: sourceSide as ConnectionOut["source_side"],
    target_side: targetSide as ConnectionOut["target_side"],
    style: null,
  };
}

export async function createViewConnection(wsId: number, viewId: string, input: ConnectionCreateIn): Promise<ConnectionOut> {
  const v = await requireView(wsId, viewId);
  if (!(await findNode(v.id, input.source))) throw new ValidationError(`Nœud source '${input.source}' introuvable.`);
  if (!(await findNode(v.id, input.target))) throw new ValidationError(`Nœud cible '${input.target}' introuvable.`);
  if (input.relationship_id) {
    const [rel] = await db.select({ id: relationships.id }).from(relationships).where(and(eq(relationships.workspaceId, wsId), eq(relationships.uuid, input.relationship_id)));
    if (!rel) throw new ValidationError(`Relation '${input.relationship_id}' introuvable.`);
  }
  const [row] = await db.insert(connections).values({
    viewId: v.id, uuid: newId(), name: input.name ?? null,
    relationshipUuid: input.relationship_id ?? null,
    sourceNodeUuid: input.source, targetNodeUuid: input.target,
  }).returning();
  if (!row) throw new Error("Failed to create connection");
  return connRowToOut(row, input.source_side ?? null, input.target_side ?? null);
}

export async function updateViewConnection(wsId: number, viewId: string, connId: string, input: ConnectionUpdateIn): Promise<ConnectionOut> {
  const v = await requireView(wsId, viewId);
  const [c] = await db.select().from(connections).where(and(eq(connections.viewId, v.id), eq(connections.uuid, connId)));
  if (!c) throw new NotFoundError(`Connexion '${connId}' introuvable.`);
  const patch: Partial<typeof connections.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.source !== undefined) {
    if (!(await findNode(v.id, input.source))) throw new ValidationError(`Nœud source '${input.source}' introuvable.`);
    patch.sourceNodeUuid = input.source;
  }
  if (input.target !== undefined) {
    if (!(await findNode(v.id, input.target))) throw new ValidationError(`Nœud cible '${input.target}' introuvable.`);
    patch.targetNodeUuid = input.target;
  }
  if (Object.keys(patch).length > 0) await db.update(connections).set(patch).where(eq(connections.id, c.id));
  const [updated] = await db.select().from(connections).where(eq(connections.id, c.id));
  return connRowToOut(updated!, input.source_side ?? null, input.target_side ?? null);
}

export async function deleteViewConnection(wsId: number, viewId: string, connId: string): Promise<void> {
  const v = await requireView(wsId, viewId);
  const [c] = await db.select({ id: connections.id }).from(connections).where(and(eq(connections.viewId, v.id), eq(connections.uuid, connId)));
  if (!c) throw new NotFoundError(`Connexion '${connId}' introuvable.`);
  await db.delete(connections).where(eq(connections.id, c.id));
}

// ---------------------------------------------------------------------------
// Model info
// ---------------------------------------------------------------------------

export async function getModelInfo(wsId: number): Promise<ModelInfo> {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, wsId));
  if (!ws) throw new NotFoundError(`Workspace '${wsId}' introuvable.`);
  const [ec] = await db.select({ c: count() }).from(elements).where(eq(elements.workspaceId, wsId));
  const [rc] = await db.select({ c: count() }).from(relationships).where(eq(relationships.workspaceId, wsId));
  const [vc] = await db.select({ c: count() }).from(views).where(eq(views.workspaceId, wsId));
  const [pc] = await db.select({ c: count() }).from(propertyDefinitions).where(eq(propertyDefinitions.workspaceId, wsId));
  return {
    identifier: ws.uuid || "",
    name: ws.name || "",
    documentation: ws.description ?? null,
    version: ws.version ?? null,
    element_count: Number(ec?.c ?? 0),
    relationship_count: Number(rc?.c ?? 0),
    view_count: Number(vc?.c ?? 0),
    property_definition_count: Number(pc?.c ?? 0),
  };
}

export async function exportModelToXml(wsId: number): Promise<string> {
  const model = await modelFromDb(wsId);
  return serializeToOpenExchange(model);
}

export async function importModelFromXml(wsId: number, xml: string): Promise<ModelInfo> {
  let model: ArchiModel;
  try { model = parseOpenExchange(xml); }
  catch (err) { throw new Error(`Erreur de parsing XML : ${(err as Error).message}`, { cause: err }); }
  await modelToDb(wsId, model);
  return getModelInfo(wsId);
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function propsIn(properties: { property_definition_ref: string; value: string }[] | undefined): Record<string, string> {
  return Object.fromEntries((properties ?? []).map((p) => [p.property_definition_ref, p.value]));
}
