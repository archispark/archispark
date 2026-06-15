# Deployment

## Kubernetes (Helm)

A Helm chart is available in `.k8s/helm/archispark/`. It deploys the full stack (api, web, mcp-server, postgres) with an NGINX Ingress — the same topology as the Docker Compose setup.

### Prerequisites

| Tool | Install |
|------|---------|
| `helm` ≥ 3.x | `curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \| bash` |
| `kubectl` | `curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"` |
| Kubernetes cluster | Any cluster with an **NGINX Ingress Controller** (minikube, k3s, GKE, EKS…) |

**Local cluster with minikube (Docker driver) :**

```bash
minikube start --driver=docker --cpus=4 --memory=6g --addons=ingress
```

### Install

```bash
# Minimal install (replace values with your own)
helm install archispark .k8s/helm/archispark \
  --namespace archispark --create-namespace \
  --set ingress.host=archispark.local \
  --set secrets.dbPassword=<motdepasse>
```

With TLS (cert-manager or manual secret):

```bash
helm install archispark .k8s/helm/archispark \
  --namespace archispark --create-namespace \
  --set ingress.host=archispark.example.com \
  --set ingress.tls.enabled=true \
  --set ingress.tls.secretName=archispark-tls \
  --set secrets.dbPassword=<motdepasse>
```

**minikube local DNS** (add Ingress IP to `/etc/hosts`):

```bash
echo "$(minikube ip) archispark.local" | sudo tee -a /etc/hosts
```

### Key values

| Value | Default | Description |
|-------|---------|-------------|
| `image.os` | `alpine` | Image variant: `alpine` or `trixie-slim` |
| `image.tag` | `latest` | Image tag (use a pinned version in production, e.g. `0.4.0`) |
| `ingress.host` | `archispark.example.com` | Hostname served by the Ingress |
| `ingress.className` | `nginx` | Ingress class |
| `ingress.tls.enabled` | `false` | Enable TLS |
| `secrets.dbPassword` | — | **Required** — PostgreSQL password |
| `secrets.existingSecret` | `""` | Name of a pre-existing K8s Secret (Sealed Secrets, ESO…) |
| `postgres.storage` | `5Gi` | PostgreSQL PVC size |

See [`.k8s/helm/archispark/values.yaml`](../.k8s/helm/archispark/values.yaml) for the full list.

### Upgrade / uninstall

```bash
# Upgrade (keep existing values)
helm upgrade archispark .k8s/helm/archispark --namespace archispark --reuse-values

# Uninstall (keeps PVCs — data is preserved)
helm uninstall archispark --namespace archispark

# Full wipe including data
helm uninstall archispark --namespace archispark
kubectl delete pvc -n archispark --all
```

### Routing

| Path | Backend | Notes |
|------|---------|-------|
| `/api/*` | `archispark-api:3000` | `/api` prefix stripped before forwarding |
| `/mcp/*` | `archispark-mcp:3001` | MCP Streamable HTTP (Bearer token required) |
| `/` | `archispark-web:8000` | Next.js catch-all |

### MCP Server on Kubernetes

Once deployed, generate a personal API token in the web UI (**Mon profil → Tokens API → Nouveau token**) and configure Claude Code:

```bash
claude mcp add archimate \
  http://archispark.local/mcp/ \
  --transport http \
  --header "Authorization: Bearer <your-token>"
```

## Vercel

1. **Create the `archispark-tenant-api` project** (Phase 5, one-time) — import
   the repo as a second Vercel project with root directory `apps/tenant-api`.
   It's internal-only (no custom domain needed, the default `*.vercel.app`
   URL is fine — see [Control-api / tenant-api split](architecture.md#control-api--tenant-api-split)).

2. **Add Neon** — In Vercel → Storage, add two Neon Postgres databases:
   - `archispark-control` → attached to `archispark-control-api` and `archispark-mcp-server`. Neon auto-injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
   - `archispark-tenant-fallback` → attached to `archispark-tenant-api`, `archispark-control-api`, and `archispark-mcp-server`. Rename the injected `DATABASE_URL` → `TENANT_DATABASE_URL` and `DATABASE_URL_UNPOOLED` → `TENANT_DATABASE_URL_UNPOOLED`.

3. **Apply database migrations** — run the control DB migrations manually, then deploy tenant-api so it auto-applies the tenant schema on first cold start:

```bash
# Control DB (migrations 0000 → 0012, runs against DATABASE_URL)
DATABASE_URL="<neon-control-pooled>" pnpm --filter @workspace/db migrate:prod

# Tenant DB — two options:
# Option A (recommended): deploy tenant-api with TENANT_DATABASE_URL set;
#   runTenantFallbackMigrations() applies drizzle-pg/tenant/ automatically on cold start.
# Option B (manual, if tenant-api not yet deployed):
DATABASE_URL="<neon-tenant-pooled>" pnpm --filter @workspace/db exec drizzle-kit migrate --config drizzle.config.tenant.ts
```

> **Important:** the tenant DB schema (`workspaces`, `elements`, `views`, etc.) is separate from the control DB schema and must be migrated independently. Forgetting this step results in "relation does not exist" errors on workspace creation.

4. **Set environment variables** — grab a Vercel token from Account Settings → Tokens, then:

```bash
VERCEL_TOKEN=xxx \
bash apps/control-api/scripts/setup-vercel-env.sh
```

The script configures:

| Variable | Project | Value |
|---|---|---|
| `TENANT_API_URL` | api | `archispark-tenant-api`'s deployment URL |
| `TENANT_JWT_SECRET` | api, tenant-api | shared (auto-generated) |
| `TENANT_DB_ENCRYPTION_KEY` | tenant-api | auto-generated |
| `ARCHIMATE_API_URL` | web, admin-web | API Vercel deployment URL |

Authentication itself (Keycloak realm, client ids/secrets) is configured
separately via each project's Vercel dashboard — see
[Keycloak login](authentication.md#keycloak-login-stage-3).

5. **Redeploy** `archispark-control-api`, `archispark-tenant-api`, `archispark-web`, and `archispark-admin-web`.

### Admin web project (`apps/admin-web`)

`apps/admin-web` deploys as its own Vercel project (root directory
`apps/admin-web`, same build/output settings as `archispark-web`):

1. Create the `archispark-admin-web` Vercel project (root directory
   `apps/admin-web`, same team).
2. Attach its domain (or subdomain, e.g. `admin.<domain>`) in the Vercel
   dashboard.
3. Set `KEYCLOAK_CLIENT_ID_ADMIN_WEB` (defaults to `archispark-admin-web`) and
   the shared `KEYCLOAK_URL`/`KEYCLOAK_REALM` — see
   [Keycloak login](authentication.md#keycloak-login-stage-3). Each app signs in against
   Keycloak independently via its own OIDC client, so no shared-cookie
   configuration between `apps/web` and `apps/admin-web` is required.
