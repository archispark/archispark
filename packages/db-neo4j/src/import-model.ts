import type { ArchiModel } from "@workspace/db";
import { getDriver } from "./connection.js";
import { buildNeo4jParams } from "./mapping.js";
import { ensureNeo4jSchema } from "./schema/migrate.js";

export interface Neo4jImportResult {
  modelId: string;
  elements: number;
  relationships: number;
  views: number;
  properties: number;
  importedAt: string;
}

/**
 * Syncs one workspace's ArchiModel into Neo4j: wipe-and-reload of the subgraph
 * reachable from this workspace's :Model node, then a full rewrite. Scoped to
 * the workspace so it never touches other workspaces already imported.
 */
export async function importModelToNeo4j(model: ArchiModel): Promise<Neo4jImportResult> {
  await ensureNeo4jSchema();
  const params = buildNeo4jParams(model);
  const session = getDriver().session();
  try {
    await session.run(
      `MATCH (m:Model {id: $modelId})
       OPTIONAL MATCH (m)-[:CONTAINS]->(n)
       OPTIONAL MATCH (n)-[:HAS_PROPERTY]->(p:Property)
       DETACH DELETE p, n, m`,
      { modelId: params.modelId },
    );

    await session.run(`MERGE (m:Model {id: $id}) SET m.name = $name, m.importedAt = datetime()`, {
      id: params.modelId,
      name: params.modelName,
    });

    await session.run(
      `MATCH (m:Model {id: $modelId})
       UNWIND $elements AS el
       MERGE (e:Element {id: el.id})
       SET e.name = el.name, e.type = el.type, e.documentation = el.documentation
       MERGE (m)-[:CONTAINS]->(e)`,
      { modelId: params.modelId, elements: params.elements },
    );

    for (const [neo4jType, relationships] of params.relationshipsByType) {
      // Relationships can't be the endpoint of another relationship in Neo4j, so — unlike
      // elements — their ArchiMate properties are set natively via `+=` rather than as
      // Property/HAS_PROPERTY nodes. `+=` runs first so the explicit fields below always win.
      await session.run(
        `UNWIND $relationships AS rel
         MATCH (s:Element {id: rel.sourceId}), (t:Element {id: rel.targetId})
         MERGE (s)-[r:${neo4jType} {id: rel.id}]->(t)
         SET r += rel.properties, r.name = rel.name, r.accessType = rel.accessType, r.archiType = rel.archiType`,
        { relationships },
      );
    }

    await session.run(
      `UNWIND $properties AS prop
       MATCH (e:Element {id: prop.ownerId})
       CREATE (p:Property {definitionId: prop.definitionId, name: prop.name, value: prop.value})
       MERGE (e)-[:HAS_PROPERTY]->(p)`,
      { properties: params.elementProperties },
    );

    await session.run(
      `MATCH (m:Model {id: $modelId})
       UNWIND $views AS v
       MERGE (view:View {id: v.id})
       SET view.name = v.name
       MERGE (m)-[:CONTAINS]->(view)
       WITH view, v
       UNWIND v.elementIds AS elId
       MATCH (e:Element {id: elId})
       MERGE (view)-[:CONTAINS]->(e)`,
      { modelId: params.modelId, views: params.views },
    );

    const allRelationships = [...params.relationshipsByType.values()].flat();
    const relationshipPropertyCount = allRelationships.reduce((n, r) => n + Object.keys(r.properties).length, 0);
    return {
      modelId: params.modelId,
      elements: params.elements.length,
      relationships: allRelationships.length,
      views: params.views.length,
      properties: params.elementProperties.length + relationshipPropertyCount,
      importedAt: new Date().toISOString(),
    };
  } finally {
    await session.close();
  }
}
