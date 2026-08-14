import { test, expect, ensureWorkspace, E2E_USER_USERNAME } from "./fixtures"

test.describe("profile", () => {
  test("shows the current user's info and manages a personal API token", async ({
    authedPage: page,
  }) => {
    // Creating an API token needs an organization to attach it to — the
    // profile-tokens-tab.tsx dropdown only lists organizations the user
    // belongs to, so a personal org (auto-created on first workspace) must
    // exist first.
    await ensureWorkspace(page)

    await page.goto("/profile")
    await expect(page.locator("#profile-username")).toHaveValue(
      E2E_USER_USERNAME
    )

    // The tabs on this page aren't i18n-driven (profile/page.tsx hardcodes
    // French labels even under the "en" locale) — target by the literal text.
    await page.getByRole("button", { name: "Tokens API" }).click()

    const tokenName = `E2E Token ${Date.now()}`
    await page.getByRole("button", { name: "Add" }).click()
    await page.locator("#token-name").fill(tokenName)
    // The create/cancel buttons here are hardcoded French too
    // (profile-token-create-form.tsx), unlike the other create dialogs.
    await page.getByRole("button", { name: "Créer" }).click()

    await expect(page.getByText(tokenName)).toBeVisible()

    // Only one token exists at this point in the test, so the single
    // delete button (icon-only; accessible name comes from its `title`
    // attribute — see profile-token-list.tsx) is unambiguous.
    await page.getByRole("button", { name: "Supprimer ce token" }).click()
    await expect(page.getByText(tokenName)).not.toBeVisible()
  })
})
