# ArchiSpark — Tenant API

Internal data-plane REST API for ArchiSpark, an open-source ArchiMate 3.1 modeling tool.

Built with **Express.js** and **PostgreSQL**. Serves modeling requests (elements, relationships, views, workspaces, import/export) for requests proxied by `control-api`, verifying a short-lived inter-service JWT instead of running its own authentication. Not exposed publicly.

## Tags

| Tag | Base image |
|-----|------------|
| `alpine-latest` | `node:22-alpine` |
| `trixie-slim-latest` | `node:22-trixie-slim` |
| `alpine-X.Y.Z` | Pinned release |
| `trixie-slim-X.Y.Z` | Pinned release |

## Source

[archispark/archispark](https://github.com/archispark/archispark) — monorepo source

## Documentation

Full setup guide, environment variables and configuration reference at **[docs.archispark.io](https://docs.archispark.io/)**.
