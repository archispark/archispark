# ArchiSpark — Server

Unified Next.js application for ArchiSpark, an open-source ArchiMate 3.1 modeling tool.

A single deployment combining the web UI, the REST API (authentication, personal settings, and modeling requests — elements, relationships, views, workspaces, import/export), and the Model Context Protocol server (38 tools, 2 prompts, 2 resources over Streamable HTTP), enabling both interactive editing and AI-agent access to the same ArchiMate models. Built with **Next.js**, **PostgreSQL** and **Keycloak**.

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
