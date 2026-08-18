import neo4j, { type Driver } from "neo4j-driver";
import { getNeo4jConfig, isNeo4jEnabled } from "./config.js";

let driver: Driver | undefined;

/** The single shared Neo4j driver — created lazily on first use, reused for the process lifetime. */
export function getDriver(): Driver {
  if (!isNeo4jEnabled()) {
    throw new Error("Neo4j est désactivé (NEO4J_ENABLED=false).");
  }
  if (!driver) {
    const { uri, user, password } = getNeo4jConfig();
    driver = neo4j.driver(uri, user ? neo4j.auth.basic(user, password ?? "") : undefined);
  }
  return driver;
}

/** Test/shutdown hook — request handlers never call this, the driver outlives a single request. */
export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = undefined;
  }
}
