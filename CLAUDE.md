# Claude Instructions

## After every code change

1. **Update the documentation**: keep `README.md` in sync with any API, MCP tool, or behaviour change.

## Release notes

1. **Run tests, lint & typecheck**: use the `vitest-coverage-enforcer` sub-agent — it runs tests with coverage, adds missing tests until line/branch/function coverage stays at or above **80%**, then runs `pnpm turbo run lint typecheck` and fixes any errors before considering the change done.
2. **When tagging a release** (e.g. `git tag 0.4.0`), bump `package.json` `"version"` to match, commit the bump, then create the tag and push both: `git push origin main --tags`.

## Project conventions

- **Type validation**: element and relationship types must belong to the ArchiMate 3.1 sets defined in `models/xsd`.
- **Reference PNG components**: all components (PNG) go to `models/img/archimate`. Never write generated images to `models/img/archimate/` or any other directory.
- **Reference SVG views**: `models/img/views/` contains SVGs exported directly by the Archi tool — these are the ground truth. When improving the renderer (`src/renderer.ts`), compare generated output against the matching file in `models/img/views/` and minimize visual differences (shapes, colors, layout, connectors, labels, fonts).
