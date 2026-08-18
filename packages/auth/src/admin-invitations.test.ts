import { afterEach, describe, expect, it, vi } from "vitest"
import { clearAdminTokenCache } from "./admin-token.js"
import {
  deleteKeycloakUser,
  findUserByEmail,
  sendUserRequiredActionsEmail,
} from "./admin-users.js"

const KEYCLOAK_URL = "http://localhost:8080"
const REALM = "archispark"
const TOKEN_URL = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`
const ADMIN_URL = `${KEYCLOAK_URL}/admin/realms/${REALM}`

function stubEnv(): void {
  vi.stubEnv("KEYCLOAK_URL", KEYCLOAK_URL)
  vi.stubEnv("KEYCLOAK_REALM", REALM)
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_ID", "archispark-api")
  vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", "secret")
}

function tokenResponse(): Response {
  return Response.json({ access_token: "admin-token", expires_in: 300 })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  clearAdminTokenCache()
})

describe("Keycloak invitation administration", () => {
  it("finds a user by normalized exact e-mail", async () => {
    stubEnv()
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = input.toString()
        if (url === TOKEN_URL) return tokenResponse()
        expect(url).toBe(
          `${ADMIN_URL}/users?email=invitee%40example.com&exact=true`
        )
        return Response.json([
          { id: "u1", username: "invitee", email: "invitee@example.com" },
        ])
      })
    )

    await expect(
      findUserByEmail(" Invitee@Example.com ")
    ).resolves.toMatchObject({ id: "u1" })
  })

  it("sends required actions with the client and return URI", async () => {
    stubEnv()
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = new URL(input.toString())
        if (url.toString() === TOKEN_URL) return tokenResponse()
        expect(url.pathname).toBe(
          `/admin/realms/${REALM}/users/u1/execute-actions-email`
        )
        expect(url.searchParams.get("client_id")).toBe("archispark-web")
        expect(url.searchParams.get("redirect_uri")).toBe(
          "http://localhost:8000/invitations/token"
        )
        expect(url.searchParams.get("lifespan")).toBe("600")
        expect(init?.method).toBe("PUT")
        expect(JSON.parse(init?.body as string)).toEqual(["UPDATE_PASSWORD"])
        return new Response(null, { status: 204 })
      })
    )

    await expect(
      sendUserRequiredActionsEmail("u1", {
        clientId: "archispark-web",
        redirectUri: "http://localhost:8000/invitations/token",
        lifespan: 600,
        actions: ["UPDATE_PASSWORD"],
      })
    ).resolves.toBeUndefined()
  })

  it("deletes a provisioned user and tolerates an absent user", async () => {
    stubEnv()
    const fetchMock = vi.fn(async (input: string | URL) => {
      if (input.toString() === TOKEN_URL) return tokenResponse()
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(deleteKeycloakUser("u1")).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenLastCalledWith(
      `${ADMIN_URL}/users/u1`,
      expect.objectContaining({ method: "DELETE" })
    )
  })
})
