# Screenshot sources

Trace of how each PNG in this folder was captured, so an agent can reproduce
it at the same place instead of guessing. Update the matching row whenever a
screenshot is replaced.

Default source: [`https://demo.archispark.cloud/`](https://demo.archispark.cloud/)
(public demo, no local setup needed). If the public demo has no seeded
account able to reach the route (as was the case below), fall back to a
local instance seeded with the demo data (`pnpm seed:demo-users` +
`pnpm seed:demo`, `KEYCLOAK_SSO_ENABLED=true`) and note it in the "Source"
column.

| File | Route | Account (role) | Source | Viewport | Captured |
| --- | --- | --- | --- | --- | --- |
| `overview.png` | `/` (workspace: ArchiSurance) | `archi` (owner) | local demo seed | 1400×900 | 2026-08-16 |
| `elements.png` | `/elements` | `archi` (owner) | local demo seed | 1400×900 | 2026-08-16 |
| `relationships.png` | `/relationships` | `archi` (owner) | local demo seed | 1400×900 | 2026-08-16 |
| `views.png` | `/views` | `archi` (owner) | local demo seed | 1400×900 | 2026-08-16 |
| `canvas.png` | `/views/id-c7c26d7b36cb42ccaf8fda65a2579db3` ("08 Solution Concept View", ArchiSurance) | `archi` (owner) | local demo seed | 1400×900 | 2026-08-16 |
| `settings.png` | `/settings` (workspace: ArchiSurance) | `archi` (owner) | local demo seed | 1400×900 | 2026-08-16 |
| `organizations.png` | `/organizations` | `archi` (owner) | local demo seed | 1400×900 | 2026-08-16 |
| `properties.png` | `/properties` | `archi` (owner) | local demo seed | 1400×900 | 2026-08-16 |
| `admin-mode.png` | `/platform/organizations` | `admin` (platform_admin) | local demo seed | 1400×900 | 2026-08-16 |

Demo accounts (username = password): `archi`/`contrib`/`user` (org "Archi"),
`open` (org "Open"), `admin` (platform_admin) — see
[Demo Seed](../content/docs/developer-guide/getting-started/demo-data.md).

Capture notes:

- Light theme, Next.js dev tools badge hidden before each shot
  (`document.querySelectorAll('[data-nextjs-dev-tools-button], nextjs-portal')`
  set to `display:none`) — it only exists in `pnpm dev`, not in the shipped
  build.
- No token, email, or other real personal data visible.
