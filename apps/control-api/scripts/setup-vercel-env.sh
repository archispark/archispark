#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Configure Vercel environment variables for archispark-web and archispark-api
# Usage: VERCEL_TOKEN=<your_token> bash setup-vercel-env.sh
#
# Prerequisites:
#   - Supabase integration linked to the Vercel team (provides POSTGRES_URL*)
# ---------------------------------------------------------------------------

set -euo pipefail

TEAM_ID="team_k82grz5COxuWP1mKbLz1CqY3"
API_PROJECT="archispark-api"
TENANT_API_PROJECT="archispark-tenant-api"
WEB_PROJECT="archispark-web"
ADMIN_PROJECT="archispark-admin-web"

# Customise before running
# Phase 5 — shared secret for the control-api -> tenant-api inter-service JWT.
TENANT_JWT_SECRET="${TENANT_JWT_SECRET:-ff40a24687f21c5cb7954ad52667f06c7aa6ab89852e9ad1c747a1fc9a661521}"
# Phase 5 — decrypts per-tenant Neon connection strings (tenant-api, mcp-server).
TENANT_DB_ENCRYPTION_KEY="${TENANT_DB_ENCRYPTION_KEY:-84090c5a681dedd60b487875d5a7a6a94dd2d62b016e93464eecdcf02a1a999f}"
# Phase 7 — password for the restricted archispark_tenant Postgres role used by
# tenant-api in fallback mode (set by control-api via ensureTenantRole on startup).
# Generate with: openssl rand -hex 32
TENANT_DB_PASSWORD="${TENANT_DB_PASSWORD:-}"

API_VERCEL_URL="https://api.archispark.cloud"
# Phase 5 — tenant-api is internal-only (no custom domain): control-api reaches
# it at its default Vercel deployment URL. Override if you've assigned one.
TENANT_API_VERCEL_URL="${TENANT_API_VERCEL_URL:-https://archispark-tenant-api.vercel.app}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "ERROR: VERCEL_TOKEN is required. Export it before running this script."
  exit 1
fi

add_env() {
  local project="$1" key="$2" value="$3" sensitive="${4:-false}"
  local type="plain"
  [[ "$sensitive" == "true" ]] && type="encrypted"

  local display_value="$value"
  [[ "$sensitive" == "true" ]] && display_value="***"
  echo "  → $key=$display_value ($type)"

  curl -s -X POST "https://api.vercel.com/v10/projects/${project}/env?teamId=${TEAM_ID}&upsert=true" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$(jq -n \
      --arg k "$key" \
      --arg v "$value" \
      --arg t "$type" \
      '{"key":$k,"value":$v,"type":$t,"target":["production","preview","development"]}')" \
  | jq -r 'if .error then "    ERROR: \(.error.message)" else "    OK: \(.key // "upserted")" end'
}

update_project_settings() {
  local project="$1"
  echo "  → framework=null, buildCommand=pnpm build, outputDirectory=public"
  # outputDirectory must point at the empty apps/control-api/public/ dir: this is a
  # serverless-function-only project (api/index.ts), with no static frontend.
  # - outputDirectory:"dist" makes Vercel publish dist/ as static output, and
  #   dist/index.js then shadows both /index.js and / (root index resolution),
  #   bypassing the catch-all rewrite.
  # - outputDirectory:null makes Vercel default to "public", which doesn't
  #   exist, and the build fails with "No Output Directory named public found".
  curl -s -X PATCH "https://api.vercel.com/v9/projects/${project}?teamId=${TEAM_ID}" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"framework":null,"buildCommand":"pnpm build","outputDirectory":"public","installCommand":"pnpm install"}' \
  | jq -r 'if .error then "    ERROR: \(.error.message)" else "    OK: framework updated to \(.framework // "null")" end'
}

echo ""
echo "=== Configuring archispark-api ==="
update_project_settings "$API_PROJECT"
add_env "$API_PROJECT" "DB_DRIVER"            "postgres"
# Phase 5 — control-api reverse-proxies modeling requests to tenant-api,
# signing a short-lived inter-service JWT with TENANT_JWT_SECRET.
add_env "$API_PROJECT" "TENANT_API_URL"       "$TENANT_API_VERCEL_URL"
add_env "$API_PROJECT" "TENANT_JWT_SECRET"    "$TENANT_JWT_SECRET"      "true"
# Phase 7 — control-api uses this to create/maintain the archispark_tenant role
[[ -n "$TENANT_DB_PASSWORD" ]] && add_env "$API_PROJECT" "TENANT_DB_PASSWORD" "$TENANT_DB_PASSWORD" "true"

echo ""
echo "=== Configuring archispark-tenant-api ==="
update_project_settings "$TENANT_API_PROJECT"
add_env "$TENANT_API_PROJECT" "DB_DRIVER"                "postgres"
add_env "$TENANT_API_PROJECT" "TENANT_JWT_SECRET"        "$TENANT_JWT_SECRET"        "true"
add_env "$TENANT_API_PROJECT" "TENANT_DB_ENCRYPTION_KEY" "$TENANT_DB_ENCRYPTION_KEY" "true"
# Phase 7: TENANT_DATABASE_URL points to the shared tenant fallback DB (separate
# from the control DB). Build it from POSTGRES_URL replacing user:password and
# changing the database name to archispark_tenant (or your equivalent name).
# Example: if POSTGRES_URL=postgresql://user:pass@host:5432/archispark_control
# then TENANT_DATABASE_URL=postgresql://archispark_tenant:TENANT_DB_PASSWORD@host:5432/archispark_tenant
# Set this value manually (encrypted) in the Vercel dashboard or add it here.

echo ""
echo "=== Configuring archispark-web ==="
add_env "$WEB_PROJECT" "ARCHIMATE_API_URL" "$API_VERCEL_URL"

echo ""
echo "=== Configuring archispark-admin-web ==="
add_env "$ADMIN_PROJECT" "ARCHIMATE_API_URL" "$API_VERCEL_URL"

echo ""
echo "=== Done ==="
echo ""
echo "IMPORTANT: Make sure the Supabase integration (supabase-celeste-compass) is"
echo "linked to archispark-api, archispark-tenant-api and archispark-web in the"
echo "Vercel dashboard so POSTGRES_URL* env vars are automatically injected. Then"
echo "redeploy all three projects."
echo ""
echo "Phase 5: if archispark-tenant-api doesn't exist yet, create it in the Vercel"
echo "dashboard first (root directory apps/tenant-api), then re-run this script."
echo "TENANT_API_URL on archispark-api was set to $TENANT_API_VERCEL_URL — the"
echo "project's default *.vercel.app deployment URL (tenant-api is internal-only,"
echo "no custom domain needed). Override TENANT_API_VERCEL_URL if you assign one."
echo ""
echo "Phase 7 (Postgres role separation):"
echo "  1. Generate TENANT_DB_PASSWORD: openssl rand -hex 32"
echo "  2. Re-run this script with TENANT_DB_PASSWORD=<value> — it will set it on archispark-api."
echo "     control-api creates/maintains the archispark_tenant role on every cold start."
echo "  3. Build the restricted DATABASE_URL for archispark-tenant-api:"
echo "     take POSTGRES_URL from archispark-api (Supabase integration) and replace"
echo "     user:password with archispark_tenant:\$TENANT_DB_PASSWORD"
echo "  4. Set that URL as DATABASE_URL on archispark-tenant-api (encrypted), then"
echo "     redeploy archispark-api (to provision the role) and archispark-tenant-api."
