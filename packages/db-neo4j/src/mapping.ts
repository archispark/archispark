import type { ArchiModel, ArchiNode } from "@workspace/db";
import { getLayer } from "./layer.js";

export interface Neo4jElementParam {
  id: string;
  name: string;
  type: string;
  layer: string;
  documentation: string | null;
  organizationId: number;
}

export interface Neo4jRelationshipParam {
  id: string;
  sourceId: string;
  targetId: string;
  name: string | null;
  accessType: string | null;
  archiType: string;
  organizationId: number;
  /**
   * ArchiMate property name -> value, set natively on the relationship via
   * `SET r += rel.properties`. Neo4j relationships can't be the endpoint of
   * another relationship, so — unlike elements — a Property/HAS_PROPERTY
   * node graph isn't representable for them.
   */
  properties: Record<string, string>;
}

export interface Neo4jPropertyParam {
  ownerId: string;
  definitionId: string;
  name: string;
  value: string;
  organizationId: number;
}

export interface Neo4jViewParam {
  id: string;
  name: string;
  elementIds: string[];
  organizationId: number;
}

/** The Postgres organization a workspace belongs to — carried through to Neo4j for tenant tagging (see docs/architecture.md#neo4j-export). */
export interface Neo4jOrganizationParam {
  id: number;
  slug: string;
  name: string;
}

export interface Neo4jModelParams {
  modelId: string;
  modelName: string;
  organization: Neo4jOrganizationParam;
  elements: Neo4jElementParam[];
  relationshipsByType: Map<string, Neo4jRelationshipParam[]>;
  elementProperties: Neo4jPropertyParam[];
  views: Neo4jViewParam[];
}

/** Neo4j relationship type names are interpolated into Cypher (not parameterizable) — reject anything unsafe. */
const SAFE_RELATIONSHIP_TYPE = /^[A-Z0-9_]+$/;

export function toNeo4jRelationshipType(archiType: string): string {
  return archiType.toUpperCase();
}

/** Pure transform: ArchiModel (Postgres object graph) -> Neo4j write parameters. Throws on an unsafe relationship type. */
export function buildNeo4jParams(model: ArchiModel, organization: Neo4jOrganizationParam): Neo4jModelParams {
  const defNameByUuid = new Map(model.propertyDefinitions.map((d) => [d.uuid, d.name]));

  const elements: Neo4jElementParam[] = model.elements.map((el) => ({
    id: el.uuid,
    name: el.name,
    type: el.type,
    layer: getLayer(el.type),
    documentation: el.desc,
    organizationId: organization.id,
  }));

  const elementProperties: Neo4jPropertyParam[] = model.elements.flatMap((el) =>
    Object.entries(el.props).map(([defUuid, value]) => ({
      ownerId: el.uuid,
      definitionId: defUuid,
      name: defNameByUuid.get(defUuid) ?? defUuid,
      value,
      organizationId: organization.id,
    })),
  );

  const relationshipsByType = new Map<string, Neo4jRelationshipParam[]>();
  for (const rel of model.relationships) {
    const neo4jType = toNeo4jRelationshipType(rel.type);
    if (!SAFE_RELATIONSHIP_TYPE.test(neo4jType)) {
      throw new Error(`Type de relation invalide (rejeté) : ${JSON.stringify(rel.type)}`);
    }
    const sourceId = typeof rel.source === "string" ? rel.source : rel.source.uuid;
    const targetId = typeof rel.target === "string" ? rel.target : rel.target.uuid;
    const properties = Object.fromEntries(
      Object.entries(rel.props).map(([defUuid, value]) => [defNameByUuid.get(defUuid) ?? defUuid, value]),
    );
    const list = relationshipsByType.get(neo4jType) ?? [];
    list.push({
      id: rel.uuid,
      sourceId,
      targetId,
      name: rel.name,
      accessType: rel.access_type,
      archiType: rel.type,
      organizationId: organization.id,
      properties,
    });
    relationshipsByType.set(neo4jType, list);
  }

  const views: Neo4jViewParam[] = model.views.map((v) => ({
    id: v.uuid,
    name: v.name,
    elementIds: [...collectElementUuids(v.nodes)],
    organizationId: organization.id,
  }));

  return {
    modelId: model.uuid,
    modelName: model.name,
    organization,
    elements,
    relationshipsByType,
    elementProperties,
    views,
  };
}

function collectElementUuids(nodeList: ArchiNode[], acc: Set<string> = new Set()): Set<string> {
  for (const n of nodeList) {
    if (n.ref) acc.add(typeof n.ref === "string" ? n.ref : n.ref.uuid);
    collectElementUuids(n.nodes, acc);
  }
  return acc;
}
