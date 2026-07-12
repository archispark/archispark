/**
 * Recreates/updates the Keycloak Phase Two environment (realm, roles,
 * clients, api service account) from
 * .docker/keycloak/realm-export.json via the Admin REST API.
 *
 * Unlike `--import-realm` (Keycloak container first-boot only, local dev),
 * this works against any Keycloak instance — including an existing hosted
 * Phasetwo realm:
 *   - if the target realm doesn't exist yet, it is created from the full
 *     realm-export.json (realm + roles + clients + service account);
 *   - if it already exists, roles/clients/the api service account
 *     are applied via `partialImport` with `ifResourceExists: "SKIP"` —
 *     idempotent, only adds what's missing.
 *
 * Usage:
 *   pnpm --filter @workspace/db setup:realm
 *
 * Requires KEYCLOAK_URL and KEYCLOAK_REALM (the target realm). Authenticates
 * via a `password` grant against KEYCLOAK_SETUP_AUTH_REALM (default
 * "master") using KEYCLOAK_SETUP_CLIENT_ID (default "admin-cli") and
 * KEYCLOAK_SETUP_USERNAME/KEYCLOAK_SETUP_PASSWORD (default KEYCLOAK_ADMIN/
 * KEYCLOAK_ADMIN_PASSWORD). For a hosted realm without master-realm access,
 * set KEYCLOAK_SETUP_AUTH_REALM to the target realm and
 * KEYCLOAK_SETUP_USERNAME/KEYCLOAK_SETUP_PASSWORD to a realm-admin user.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const url = process.env["KEYCLOAK_URL"];
const realm = process.env["KEYCLOAK_REALM"];
if (!url) {
  console.error("Error: KEYCLOAK_URL is required.");
  process.exit(1);
}
if (!realm) {
  console.error("Error: KEYCLOAK_REALM is required.");
  process.exit(1);
}

const authRealm = process.env["KEYCLOAK_SETUP_AUTH_REALM"] || "master";
const authClientId = process.env["KEYCLOAK_SETUP_CLIENT_ID"] || "admin-cli";
const username = process.env["KEYCLOAK_SETUP_USERNAME"] || process.env["KEYCLOAK_ADMIN"];
const password = process.env["KEYCLOAK_SETUP_PASSWORD"] || process.env["KEYCLOAK_ADMIN_PASSWORD"];
if (!username || !password) {
  console.error("Error: KEYCLOAK_SETUP_USERNAME/KEYCLOAK_SETUP_PASSWORD (or KEYCLOAK_ADMIN/KEYCLOAK_ADMIN_PASSWORD) are required.");
  process.exit(1);
}

const REALM_JSON_PATH = resolve(import.meta.dirname, "../../../.docker/keycloak/realm-export.json");
const realmJson = JSON.parse(readFileSync(REALM_JSON_PATH, "utf-8")) as {
  roles: unknown;
  clients: unknown;
  users: { serviceAccountClientId?: string }[];
};

const tokenRes = await fetch(`${url}/realms/${authRealm}/protocol/openid-connect/token`, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "password",
    client_id: authClientId,
    username,
    password,
  }).toString(),
});
if (!tokenRes.ok) {
  throw new Error(`Admin token request failed: ${tokenRes.status} ${await tokenRes.text()}`);
}
const { access_token: token } = (await tokenRes.json()) as { access_token: string };

function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${url}/admin${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${token}` },
  });
}

const existing = await adminFetch(`/realms/${realm}`);

if (existing.status === 404) {
  console.log(`Realm "${realm}" does not exist — creating from realm-export.json…`);
  const res = await adminFetch("/realms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...realmJson, realm }),
  });
  if (!res.ok) {
    throw new Error(`POST /admin/realms -> ${res.status} ${await res.text()}`);
  }
  console.log(`Realm "${realm}" created.`);
} else if (existing.ok) {
  console.log(`Realm "${realm}" exists — applying roles/clients via partialImport (ifResourceExists=SKIP)…`);
  const payload = {
    ifResourceExists: "SKIP",
    roles: realmJson.roles,
    clients: realmJson.clients,
    users: realmJson.users.filter((u) => u.serviceAccountClientId),
  };
  const res = await adminFetch(`/realms/${realm}/partialImport`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`POST /admin/realms/${realm}/partialImport -> ${res.status} ${await res.text()}`);
  }
  console.log(JSON.stringify(await res.json(), null, 2));
} else {
  throw new Error(`GET /admin/realms/${realm} -> ${existing.status} ${await existing.text()}`);
}

console.log("Done.");
