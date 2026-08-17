export interface Neo4jConfig {
  uri: string;
  user?: string;
  password?: string;
}

/** Reads Neo4j connection settings from the environment. NEO4J_URI defaults to the local dev instance. */
export function getNeo4jConfig(): Neo4jConfig {
  const uri = process.env["NEO4J_URI"] ?? "bolt://localhost:7687";
  const user = process.env["NEO4J_USER"];
  const password = process.env["NEO4J_PASSWORD"];
  return { uri, user, password };
}

/**
 * Whether the Neo4j integration is active. Defaults to enabled — set
 * NEO4J_ENABLED=false to skip startup migrations and refuse any connection
 * attempt, e.g. when no Neo4j instance is reachable.
 */
export function isNeo4jEnabled(): boolean {
  return process.env["NEO4J_ENABLED"] !== "false";
}
