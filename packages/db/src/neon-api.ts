/**
 * Minimal client for the Neon API (https://api-docs.neon.tech/reference/getting-started-with-neon-api),
 * used by tenant-provisioning.ts to create one database + role per tenant
 * organization within a single Neon project (Phase 3).
 *
 * Only the handful of endpoints needed for provisioning are wrapped here.
 * Verify these paths against the current Neon API docs before first live
 * use — this client has not been exercised against a real Neon project.
 */

const NEON_API_BASE = "https://console.neon.tech/api/v2";

export interface NeonApiConfig {
  apiKey: string;
  projectId: string;
}

/** Reads NEON_API_KEY / NEON_PROJECT_ID. Returns undefined if either is missing. */
export function getNeonApiConfig(): NeonApiConfig | undefined {
  const apiKey = process.env["NEON_API_KEY"];
  const projectId = process.env["NEON_PROJECT_ID"];
  if (!apiKey || !projectId) return undefined;
  return { apiKey, projectId };
}

async function neonFetch<T>(config: NeonApiConfig, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${NEON_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Neon API ${init?.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
  }
  return (await res.json()) as T;
}

/** Returns the project's default branch id, or NEON_BRANCH_ID if set. */
export async function getDefaultBranchId(config: NeonApiConfig): Promise<string> {
  const override = process.env["NEON_BRANCH_ID"];
  if (override) return override;

  const data = await neonFetch<{ branches: { id: string; default?: boolean }[] }>(
    config,
    `/projects/${config.projectId}/branches`,
  );
  const branch = data.branches.find((b) => b.default) ?? data.branches[0];
  if (!branch) throw new Error(`Neon project ${config.projectId} has no branches`);
  return branch.id;
}

/** Creates a Postgres role within the given branch. Neon assigns the password. */
export async function createRole(config: NeonApiConfig, branchId: string, roleName: string): Promise<void> {
  await neonFetch(config, `/projects/${config.projectId}/branches/${branchId}/roles`, {
    method: "POST",
    body: JSON.stringify({ role: { name: roleName } }),
  });
}

/** Creates a database within the given branch, owned by `ownerName`. */
export async function createDatabase(
  config: NeonApiConfig,
  branchId: string,
  databaseName: string,
  ownerName: string,
): Promise<void> {
  await neonFetch(config, `/projects/${config.projectId}/branches/${branchId}/databases`, {
    method: "POST",
    body: JSON.stringify({ database: { name: databaseName, owner_name: ownerName } }),
  });
}

/** Returns a ready-to-use connection string for `roleName`/`databaseName` (pooled). */
export async function getConnectionUri(
  config: NeonApiConfig,
  branchId: string,
  databaseName: string,
  roleName: string,
): Promise<string> {
  const params = new URLSearchParams({
    branch_id: branchId,
    database_name: databaseName,
    role_name: roleName,
    pooled: "true",
  });
  const data = await neonFetch<{ uri: string }>(config, `/projects/${config.projectId}/connection_uri?${params}`);
  return data.uri;
}
