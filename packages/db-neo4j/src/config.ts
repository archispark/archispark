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
