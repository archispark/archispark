# Claude Instructions

## After every code change

1. **Update the documentation**: keep `README.md` in sync with any API, MCP tool, or behaviour change.

## Release Process

### Pre-release validation (ONLY before creating a tag)

Before creating a release tag, run the `vitest-coverage-enforcer` sub-agent.

The sub-agent is responsible for all release validation checks and must complete successfully before a release can be created.

**Important:**

* Do **not** run the `vitest-coverage-enforcer` during normal incremental development.
* Run it **only** immediately before creating a release tag.

### Creating a release

After the validation step succeeds:

1. Update `package.json` `"version"` so it exactly matches the release tag.
2. Commit the version bump.
3. Create the git tag using the same version.
4. Push commits and tags:

```bash
git push origin main --tags
```

The git tag and the `package.json` version must always remain identical.

## Project conventions

- **Type validation**: element and relationship types must belong to the ArchiMate 3.1 sets defined in `models/xsd`.
- **Reference PNG components**: all components (PNG) go to `models/img/archimate`. Never write generated images to `models/img/archimate/` or any other directory.
- **Reference SVG views**: `models/img/views/` contains SVGs exported directly by the Archi tool — these are the ground truth. When improving the renderer (`src/renderer.ts`), compare generated output against the matching file in `models/img/views/` and minimize visual differences (shapes, colors, layout, connectors, labels, fonts).
