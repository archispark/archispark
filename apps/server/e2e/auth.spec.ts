import {
  test,
  expect,
  ADMIN_USERNAME,
  ADMIN_INITIAL_PASSWORD,
  ADMIN_PASSWORD,
} from "./fixtures"

// Runs in the "auth-setup" project (see playwright.config.ts), guaranteed to
// execute before every other spec — the only place allowed to exercise the
// admin/admin account's one-time forced password change.
test.describe("local auth", () => {
  test("rejects wrong credentials", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Username").fill(ADMIN_USERNAME)
    await page.getByLabel("Password").fill("definitely-not-the-password")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText("Invalid credentials.")).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test("logs in, forces a password change, then logs out", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("Username").fill(ADMIN_USERNAME)
    await page.getByLabel("Password").fill(ADMIN_INITIAL_PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()

    // First login on the seeded account: proxy.ts redirects everywhere but
    // /change-password until the mustChangePassword claim is cleared.
    await expect(page).toHaveURL(/\/change-password$/)
    await page.getByLabel("Current password").fill(ADMIN_INITIAL_PASSWORD)
    await page
      .getByLabel("New password", { exact: true })
      .fill(ADMIN_PASSWORD)
    await page.getByLabel("Confirm new password").fill(ADMIN_PASSWORD)
    await page.getByRole("button", { name: "Change password" }).click()
    await expect(page).toHaveURL("/")

    // The old password no longer works; the new one does.
    await page.goto("/api/auth/logout")
    await expect(page).toHaveURL(/\/login/)
    await page.getByLabel("Username").fill(ADMIN_USERNAME)
    await page.getByLabel("Password").fill(ADMIN_INITIAL_PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText("Invalid credentials.")).toBeVisible()

    await page.getByLabel("Username").fill(ADMIN_USERNAME)
    await page.getByLabel("Password").fill(ADMIN_PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL("/")

    await page.goto("/api/auth/logout")
    await expect(page).toHaveURL(/\/login/)
  })
})
