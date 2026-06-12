# ArchiSpark — Control API

Public REST API entry point for ArchiSpark, an open-source ArchiMate 3.1 modeling tool.

Built with **Express.js**, **PostgreSQL** and **Better Auth**. Handles authentication, user/organization administration and settings, and reverse-proxies modeling requests (elements, relationships, views, workspaces, import/export) to the internal `tenant-api` service.

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
