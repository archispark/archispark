import { test as base, expect, type Page } from "@playwright/test"
import { E2E_USER_USERNAME, E2E_USER_PASSWORD } from "./seed"

export const ADMIN_USERNAME = "admin"
export const ADMIN_INITIAL_PASSWORD = "admin"
// The forced password change (see change-password/page.tsx) only fires once
// per DB lifetime, on the seeded admin/admin account
// (packages/db/drizzle-pg/0025_seed_local_admin.sql). auth.spec.ts (the
// "auth-setup" project) is the one spec that performs it.
export const ADMIN_PASSWORD = "E2E-admin-2026!"

// admin/admin is a platform_admin. Login (local sign-in, see
// ensureDefaultPlatformOrganization in
// lib/archimate/platform-context-store.ts) now enters it into the smallest
// existing organization automatically (owner-equivalent access, no manual
// "enter" step needed) — but auth.spec.ts (the "auth-setup" project)
// always runs before any organization exists in the throwaway DB
// (organizations are auto-created on a user's first workspace, and no spec
// has created one yet), so login is a no-op there and
// components/client-layout.tsx's PlatformAdminBlock still gates admin/admin
// out of every page except /login, /change-password, /invitations/*, and
// /platform/* for that spec. Every spec except auth.spec.ts therefore logs
// in as e2e-user (e2e/seed.ts), an ordinary "user"-role local account, to
// actually reach workspaces/elements/relationships/views/dashboards/
// settings.
export { E2E_USER_USERNAME, E2E_USER_PASSWORD }

/** Logs in as the seeded ordinary local user (e2e/seed.ts) — see the note above. */
export async function loginAsE2eUser(page: Page): Promise<void> {
  await page.goto("/login")
  await page.getByLabel("Username").fill(E2E_USER_USERNAME)
  await page.getByLabel("Password").fill(E2E_USER_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL("/")
}

/**
 * Ensures the current session has an active workspace (most pages need one
 * to have an organization to work in), creating "E2E Workspace" if none
 * exists yet, and returns its name. Reuses an existing workspace when
 * present rather than creating a new one on every call — workspaces persist
 * across specs in the shared DB for the run.
 */
export async function ensureWorkspace(page: Page): Promise<string> {
  await page.goto("/workspaces")
  // Workspace list rows are `<div role="button">` (see app/workspaces/page.tsx)
  // — a CSS attribute selector for the element type disambiguates them from
  // the "Add"/"Create"/"Cancel" `<button>` elements on the same page, which
  // also expose role="button" through getByRole.
  const existing = page.locator('div[role="button"]').first()
  const emptyState = page.getByText("No workspace")
  // useWorkspaces() is async — wait for whichever state the fetch settles
  // into before reading it, rather than racing a bare count() right after
  // navigation (which would always read as "no workspace yet loaded").
  await expect(existing.or(emptyState)).toBeVisible()
  if (await existing.isVisible()) {
    const name = (await existing.textContent())!.trim()
    await existing.click()
    await expect(page).toHaveURL("/")
    return name
  }

  const name = `E2E Workspace ${Date.now()}`
  await page.getByRole("button", { name: "Add" }).click()
  await page.getByPlaceholder("Workspace name").fill(name)
  await page.getByRole("button", { name: "Create" }).click()
  await expect(page).toHaveURL("/")
  return name
}

export const test = base.extend<{ authedPage: Page }>({
  // lib/i18n.tsx defaults to the "fr" locale and only switches on a
  // localStorage["locale"] value — a fresh browser context has neither, so
  // every spec in this suite would otherwise see French UI text. Force
  // "en" (this suite's assertions are all written against messages/en.json)
  // before the app's first script runs on any navigation.
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("locale", "en")
    })
    await use(page)
  },
  authedPage: async ({ page }, use) => {
    await loginAsE2eUser(page)
    await use(page)
  },
})

export { expect }
