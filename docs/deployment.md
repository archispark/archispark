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

1. **Create the `archispark-api` project** — import the repo as a Vercel
   project with root directory `apps/api`.

2. **Add Neon** — In Vercel → Storage, add a Neon Postgres database
   (`archispark`), attached to `archispark-api` and `archispark-mcp-server`.
   Neon auto-injects `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED`
   (direct) into both projects.

3. **Apply database migrations**:

```bash
DATABASE_URL="<neon-pooled>" pnpm --filter @workspace/db migrate:prod
```

4. **Set environment variables** — `DATABASE_URL` (from Neon, above),
   `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`,
   `KEYCLOAK_ADMIN_CLIENT_SECRET` on `archispark-api`; `ARCHIMATE_API_URL`
   (the `archispark-api` deployment URL) on `archispark-web`. Authentication
   itself (Keycloak realm, client ids/secrets) is configured via each
   project's Vercel dashboard — see [Keycloak login](authentication.md#keycloak-login).

5. **Redeploy** `archispark-api`, `archispark-web`, and `archispark-mcp-server`.

## Onboarding d'un nouveau client (un realm Keycloak dédié)

ArchiSpark se déploie comme une plateforme **dédiée par client** (API +
web + Postgres séparés) sur un **Keycloak self-hosté partagé** (image
`quay.io/keycloak/keycloak` "classic", la même que celle utilisée en dev —
déployée séparément de ce chart Helm, par exemple via le chart Keycloak
officiel ou un conteneur dédié ; le chart `.k8s/helm/archispark/` ne
provisionne pas Keycloak lui-même). L'isolation entre clients vient du
**realm Keycloak** : chaque client a le sien
(`archispark-<tenant>`), un namespace d'identité totalement séparé
(utilisateurs, rôles, Identity Providers, JWKS/issuer) — voir
[One Keycloak realm per client](authentication.md#one-keycloak-realm-per-client).
Aucune modification de code applicatif n'est nécessaire pour ajouter un
client : tout se joue dans la configuration Keycloak et les variables
d'environnement du déploiement.

1. **Créer le realm du client**, via le script déjà existant
   [`packages/db/scripts/setup-realm.ts`](../packages/db/scripts/setup-realm.ts)
   (aucun script dédié n'est requis — il n'a jamais fait d'hypothèse sur un
   nom de realm fixe) :

   ```bash
   KEYCLOAK_URL=<url du Keycloak self-hosté partagé> \
   KEYCLOAK_REALM=archispark-<tenant> \
   KEYCLOAK_SETUP_AUTH_REALM=master \
   KEYCLOAK_SETUP_USERNAME=<admin master> \
   KEYCLOAK_SETUP_PASSWORD=<mot de passe> \
   pnpm --filter @workspace/db setup:realm
   ```

   (ou `KEYCLOAK_SETUP_AUTH_REALM=archispark-<tenant>` + un admin de ce
   realm si le compte ne donne pas accès à `master` — voir les commentaires
   en tête de `setup-realm.ts`.)

2. **Récupérer le secret** du service account `archispark-api` généré dans
   ce realm (console admin → Clients → `archispark-api` → Credentials).

3. **Provisionner la base Postgres dédiée** du client et appliquer les
   migrations (`pnpm --filter @workspace/db migrate:prod`).

4. **Déployer** `archispark-api`/`archispark-web` du client (Helm — voir
   [Kubernetes (Helm)](#kubernetes-helm) — ou Vercel), pointés vers le
   Keycloak partagé, avec : `DATABASE_URL`
   (DB du client), `KEYCLOAK_URL` (le Keycloak partagé),
   `KEYCLOAK_REALM=archispark-<tenant>`, `KEYCLOAK_CLIENT_ID_WEB=archispark-web`,
   `KEYCLOAK_ADMIN_CLIENT_ID`/`KEYCLOAK_ADMIN_CLIENT_SECRET`.

5. **(Optionnel) Peupler des comptes initiaux** :
   `KEYCLOAK_REALM=archispark-<tenant> pnpm --filter @workspace/db seed:demo-users`,
   ou créer les vrais utilisateurs via la console admin/API.

6. **(Optionnel) Configurer le SSO du client** : console admin → Identity
   providers → Google / Microsoft (Entra ID) / autre OIDC-SAML, propre à ce
   realm — invisible des autres clients.

7. **Tester** la connexion de bout en bout, puis vérifier l'isolation :
   un token obtenu sur le realm d'un client doit être rejeté (401) par le
   déploiement d'un autre client (`verifyAccessToken` rejette sur
   l'`issuer`, sans rien à coder — voir
   [One Keycloak realm per client](authentication.md#one-keycloak-realm-per-client)).
