import { test, expect, ensureWorkspace } from "./fixtures"

// The "New element"/"New relationship" dialogs (element-create-dialog.tsx,
// relationship-create-dialog.tsx) only offer types already present in the
// active workspace's model — GET /api/elements/types returns the *distinct
// types currently in use* (lib/archimate/store.ts's listElementTypes:
// `SELECT DISTINCT type FROM elements WHERE workspace_id = …`), not the
// full ArchiMate 3.1 catalog. A brand-new workspace therefore has an empty
// Type dropdown and the dialogs can't create a workspace's first element
// through the UI at all — confirmed live (GET /api/elements/types → `[]`
// right after creating an empty workspace). The REST API itself has no such
// restriction (ElementCreateSchema/RelationshipCreateSchema validate against
// the full ArchiMate 3.1 enum, see lib/archimate/validation.ts), so this
// spec seeds content via page.request (same authenticated session as the
// browser) and uses the UI only to verify it's browsable and renders —
// still real coverage of the far more common "view existing content" path,
// without depending on a UI flow that's currently unusable from empty.
test.describe("ArchiMate editing", () => {
  test("shows API-created elements/relationships and renders a view's canvas", async ({
    authedPage: page,
  }) => {
    await ensureWorkspace(page)
    const suffix = Date.now()
    const actorName = `E2E Business Actor ${suffix}`
    const appName = `E2E App Component ${suffix}`
    const viewName = `E2E View ${suffix}`

    const actor = await (
      await page.request.post("/api/elements", {
        data: { name: actorName, type: "BusinessActor" },
      })
    ).json()
    const app = await (
      await page.request.post("/api/elements", {
        data: { name: appName, type: "ApplicationComponent" },
      })
    ).json()
    // "Association" is valid between any two ArchiMate element types
    // (lib/archimate-rules.ts's baseline allowed set).
    await page.request.post("/api/relationships", {
      data: {
        type: "Association",
        source: actor.identifier,
        target: app.identifier,
      },
    })
    await page.request.post("/api/views", { data: { name: viewName } })

    await page.goto("/elements")
    await expect(page.getByText(actorName)).toBeVisible()
    await expect(page.getByText(appName)).toBeVisible()

    await page.goto("/relationships")
    // Scoped to the table row (not a bare getByText): the row also carries
    // a collapsed detail cell that duplicates the source/target names in
    // the accessibility tree without being visible, which a plain text
    // locator can resolve to instead of the visible cell.
    const relationshipRow = page
      .getByRole("row")
      .filter({ hasText: "Association" })
    await expect(relationshipRow).toBeVisible()
    await expect(relationshipRow).toContainText(actorName)
    await expect(relationshipRow).toContainText(appName)

    // @xyflow/react always mounts a `.react-flow` root.
    await page.goto("/views")
    await page.getByRole("link", { name: viewName }).click()
    await expect(page).toHaveURL(/\/views\/.+/)
    await expect(page.locator(".react-flow")).toBeVisible()
  })
})
