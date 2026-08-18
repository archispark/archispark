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
    // System dashboards are global rows seeded once by migration
    // 0032_dashboard_system_seed.sql (see packages/db/src/schema.ts) — every
    // workspace, including a freshly created one, sees them without any
    // per-suite seeding step.
    await expect(
      page.getByRole("heading", { name: "Rapports application" })
    ).toBeVisible()
  })

  test("runs the demonstration-datasources dashboard's Postgres panel end to end", async ({
    authedPage: page,
  }) => {
    await ensureWorkspace(page)
    await page.goto("/dashboards/demonstration-datasources")
    // panel-frame.tsx only renders a panel's own content (including its
    // title, from metric-visualization.tsx) once its query has resolved
    // without error — a visible title here proves the "fournisseurs-postgres"
    // panel actually executed its SQL against the application Postgres
    // database (see datasource-executors/postgres.ts), not just that the
    // dashboard shell loaded.
    await expect(
      page.getByText("Fournisseurs actifs (démonstration PostgreSQL)")
    ).toBeVisible()
  })
})
