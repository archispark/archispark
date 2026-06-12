#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Configure Vercel environment variables for archispark-web and archispark-api
# Usage: VERCEL_TOKEN=<your_token> bash setup-vercel-env.sh
#
# Prerequisites:
#   - Supabase integration linked to the Vercel team (provides POSTGRES_URL*)
#   - SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD set below or in env
# ---------------------------------------------------------------------------

set -euo pipefail

TEAM_ID="team_k82grz5COxuWP1mKbLz1CqY3"
API_PROJECT="archispark-api"
TENANT_API_PROJECT="archispark-tenant-api"
WEB_PROJECT="archispark-web"
ADMIN_PROJECT="archispark-admin-web"

# Customise before running
JWT_SECRET="${JWT_SECRET:-39ea557f68e4dae99a76697df559fdd6291f0e1af9fe668a006ea3e2d6d08c03}"
# Phase 5 — shared secret for the control-api -> tenant-api inter-service JWT.
TENANT_JWT_SECRET="${TENANT_JWT_SECRET:-ff40a24687f21c5cb7954ad52667f06c7aa6ab89852e9ad1c747a1fc9a661521}"
# Phase 5 — decrypts per-tenant Neon connection strings (tenant-api, mcp-server).
TENANT_DB_ENCRYPTION_KEY="${TENANT_DB_ENCRYPTION_KEY:-84090c5a681dedd60b487875d5a7a6a94dd2d62b016e93464eecdcf02a1a999f}"
SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-}"
SEED_USER_PASSWORD="${SEED_USER_PASSWORD:-}"

WEB_URL="https://demo.archispark.cloud"
API_URL="https://demo.archispark.cloud"
API_VERCEL_URL="https://api.archispark.cloud"
# Phase 5 — tenant-api is internal-only (no custom domain): control-api reaches
# it at its default Vercel deployment URL. Override if you've assigned one.
TENANT_API_VERCEL_URL="${TENANT_API_VERCEL_URL:-https://archispark-tenant-api.vercel.app}"

# Phase 4c (optional) — subdomain SaaS topology: app.<domain> (archispark-web)
# and admin.<domain> (archispark-admin-web) sharing one Better Auth session
# cookie. Leave both unset to keep today's single-domain setup unchanged.
ADMIN_URL="${ADMIN_URL:-}"
COOKIE_DOMAIN="${COOKIE_DOMAIN:-}"

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

TRUSTED_ORIGINS="$WEB_URL"
[[ -n "$ADMIN_URL" ]] && TRUSTED_ORIGINS="$TRUSTED_ORIGINS,$ADMIN_URL"

echo ""
echo "=== Configuring archispark-api ==="
update_project_settings "$API_PROJECT"
add_env "$API_PROJECT" "DB_DRIVER"            "postgres"
add_env "$API_PROJECT" "JWT_SECRET"           "$JWT_SECRET"             "true"
add_env "$API_PROJECT" "WEB_URL"              "$WEB_URL"
add_env "$API_PROJECT" "API_URL"              "$API_URL"
add_env "$API_PROJECT" "TRUSTED_ORIGINS"      "$TRUSTED_ORIGINS"
[[ -n "$COOKIE_DOMAIN" ]] && add_env "$API_PROJECT" "COOKIE_DOMAIN" "$COOKIE_DOMAIN"
[[ -n "$SEED_ADMIN_PASSWORD" ]] && add_env "$API_PROJECT" "SEED_ADMIN_PASSWORD" "$SEED_ADMIN_PASSWORD" "true"
[[ -n "$SEED_USER_PASSWORD"  ]] && add_env "$API_PROJECT" "SEED_USER_PASSWORD"  "$SEED_USER_PASSWORD"  "true"
# Phase 5 — control-api reverse-proxies modeling requests to tenant-api,
# signing a short-lived inter-service JWT with TENANT_JWT_SECRET.
add_env "$API_PROJECT" "TENANT_API_URL"       "$TENANT_API_VERCEL_URL"
add_env "$API_PROJECT" "TENANT_JWT_SECRET"    "$TENANT_JWT_SECRET"      "true"

echo ""
echo "=== Configuring archispark-tenant-api ==="
update_project_settings "$TENANT_API_PROJECT"
add_env "$TENANT_API_PROJECT" "DB_DRIVER"                "postgres"
add_env "$TENANT_API_PROJECT" "TENANT_JWT_SECRET"        "$TENANT_JWT_SECRET"        "true"
add_env "$TENANT_API_PROJECT" "TENANT_DB_ENCRYPTION_KEY" "$TENANT_DB_ENCRYPTION_KEY" "true"

echo ""
echo "=== Configuring archispark-web ==="
add_env "$WEB_PROJECT" "ARCHIMATE_API_URL" "$API_VERCEL_URL"

if [[ -n "$ADMIN_URL" ]]; then
  echo ""
  echo "=== Configuring archispark-admin-web ==="
  add_env "$ADMIN_PROJECT" "ARCHIMATE_API_URL" "$API_VERCEL_URL"
fi

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
if [[ -n "$COOKIE_DOMAIN" ]]; then
  echo ""
  echo "Subdomain SSO: COOKIE_DOMAIN=$COOKIE_DOMAIN makes Better Auth issue the"
  echo "session cookie for that root domain, shared between $WEB_URL and $ADMIN_URL."
  echo "Attach the matching custom domains to archispark-web / archispark-admin-web"
  echo "in the Vercel dashboard, then redeploy all three projects."
fi
