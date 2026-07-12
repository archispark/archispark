# ArchiSpark — API

Public REST API for ArchiSpark, an open-source ArchiMate 3.1 modeling tool.

Built with **Express.js**, **PostgreSQL** and **Keycloak**. Handles authentication and personal settings, and serves modeling requests (elements, relationships, views, workspaces, import/export). Every workspace belongs to a single user.

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
