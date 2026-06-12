# Claude Instructions

## After every code change

1. **Update the documentation**: keep `README.md` in sync with any API, MCP tool, or behaviour change.

## Release notes

1. **Run the tests**: `pnpm run -w test` — all tests must pass before considering the change done. Line/branch/function coverage must stay at or above **80%**. If a change drops coverage below 80%, add tests before finishing.
2. **Run lint**: `pnpm turbo run lint` — must pass with zero rule errors before considering the change done.
3. **When tagging a release** (e.g. `git tag 0.4.0`), bump `package.json` `"version"` to match, run `npm test`, commit the bump, then create the tag and push both: `git push origin main --tags`.

## Project conventions

- **Type validation**: element and relationship types must belong to the ArchiMate 3.1 sets defined in `models/xsd`.
- **Reference PNG components**: all components (PNG) go to `models/img/archimate`. Never write generated images to `models/img/archimate/` or any other directory.
- **Reference SVG views**: `models/img/views/` contains SVGs exported directly by the Archi tool — these are the ground truth. When improving the renderer (`src/renderer.ts`), compare generated output against the matching file in `models/img/views/` and minimize visual differences (shapes, colors, layout, connectors, labels, fonts).
