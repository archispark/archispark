import { test, expect } from "./fixtures"

test.describe("workspaces", () => {
  // Playwright doesn't guarantee cross-file execution order for specs that
  // don't depend on each other (see playwright.config.ts's "auth-setup"
  // project for the one ordering guarantee this suite relies on) — this
  // spec's own file order (create-then-list) is guaranteed, but another
  // spec file may have already created a workspace on this shared account
  // by the time this one runs, so the empty state may no longer be
  // reachable.
  test("shows the empty state before any workspace exists", async ({
    authedPage: page,
  }) => {
    await page.goto("/workspaces")
    const emptyState = page.getByText("No workspace")
    // Workspace list rows are `<div role="button">` (app/workspaces/page.tsx)
    // — distinct from the sidebar's own `<button>` workspace switcher, which
    // shows the same name and would otherwise also match a plain text query.
    const workspaceItem = page.locator('div[role="button"]').first()
    // useWorkspaces() is async — wait for whichever state the fetch settles
    // into before reading it, rather than racing a bare count() right after
    // navigation (which would always read as "no workspace yet loaded").
    await expect(emptyState.or(workspaceItem)).toBeVisible()

    test.skip(
      await workspaceItem.isVisible(),
      "a workspace already exists from another spec in this run"
    )
    await expect(emptyState).toBeVisible()
  })

  test("creates a workspace in the account's organization and activates it", async ({
    authedPage: page,
  }) => {
    const name = `E2E Workspace ${Date.now()}`
    await page.goto("/workspaces")
    await page.getByRole("button", { name: "Add" }).click()
    await page.getByPlaceholder("Workspace name").fill(name)
    await page.getByRole("button", { name: "Create" }).click()

    // e2e-user already has an organization (seeded — see e2e/seed.ts, users
    // can no longer self-provision one on first workspace, see
    // authentication.mdx#organizations-and-roles); creating a workspace
    // there activates it and the app lands on the workspace overview.
    await expect(page).toHaveURL("/overview")

    await page.goto("/workspaces")
    // Scoped to the list row (not getByText(name) alone): the sidebar's
    // workspace switcher shows the same active workspace name too.
    const row = page.locator('div[role="button"]', { hasText: name })
    await expect(row).toBeVisible()
    await expect(row.getByText("active")).toBeVisible()
  })
})
