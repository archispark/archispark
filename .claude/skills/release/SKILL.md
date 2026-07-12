---
name: release
description: Cut an ArchiSpark release — validate, bump version, tag, and push. Human-triggered only.
disable-model-invocation: true
---

# Release process

## Pre-release validation (ONLY before creating a tag)

Delegate validation to the Codex plugin — no local sub-agent handles
this:

1. `/codex:review --background --base main` — read-only review of
   everything since the last release. Address blocking findings before
   continuing.
2. `/codex:rescue --background` with an explicit task: run
   `pnpm turbo run lint typecheck test:coverage --filter=api
   --filter=mcp-server --filter=web` (the same command CI runs — see
   `.github/workflows/ci.yml`), close any coverage gaps by writing
   tests (AAA pattern, reuse existing fixtures/helpers from
   `.claude/rules/testing.md`, never weaken an assertion just to make
   it pass), and iterate until lint/typecheck/test:coverage all
   succeed.
3. Check `/codex:result` for both tasks before proceeding — a release
   must not be created until they succeed.

**Important:**

- Do **not** run this validation during normal incremental development.
- Run it **only** immediately before creating a release tag.

## Creating a release

After the validation step succeeds:

1. Update `package.json` `"version"` so it exactly matches the release
   tag.
2. Commit the version bump.
3. Create the git tag using the same version.
4. Push commits and tags:

```bash
git push origin main --tags
```

The git tag and the `package.json` version must always remain
identical.
