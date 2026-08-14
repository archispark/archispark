import { test, expect, ensureWorkspace } from "./fixtures"

test.describe("dashboards", () => {
  test("opens the dashboards list for the active organization", async ({
    authedPage: page,
  }) => {
    await ensureWorkspace(page)
    await page.goto("/dashboards")
    await expect(
      page.getByRole("heading", { name: "Dashboards" })
    ).toBeVisible()
    // No dashboard has been created for this organization
    // (packages/db seed:dashboards isn't run in this suite) — the empty
    // state is the expected, valid outcome here.
    await expect(
      page.getByText("No dashboards for this organization yet.")
    ).toBeVisible()
  })
})
