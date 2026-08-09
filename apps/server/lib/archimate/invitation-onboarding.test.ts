import { afterEach, describe, expect, it, vi } from "vitest"
import { deliverInvitationEmail } from "./invitation-onboarding"

const mocks = vi.hoisted(() => ({
  createKeycloakUser: vi.fn(),
  deleteKeycloakUser: vi.fn(),
  findUserByEmail: vi.fn(),
  sendUserRequiredActionsEmail: vi.fn(),
  sendInvitationEmail: vi.fn(),
}))

vi.mock("@workspace/auth", () => ({
  createKeycloakUser: mocks.createKeycloakUser,
  deleteKeycloakUser: mocks.deleteKeycloakUser,
  findUserByEmail: mocks.findUserByEmail,
  sendUserRequiredActionsEmail: mocks.sendUserRequiredActionsEmail,
}))
vi.mock("./mail", () => ({ sendInvitationEmail: mocks.sendInvitationEmail }))

const EMAIL = "invitee@example.com"
const ACCEPT_URL = "http://localhost:8000/invitations/token"

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe("deliverInvitationEmail", () => {
  it("sends the normal invitation to an existing account", async () => {
    mocks.findUserByEmail.mockResolvedValue({
      id: "existing-user",
      username: "invitee",
      email: EMAIL,
      emailVerified: true,
    })

    await expect(
      deliverInvitationEmail(EMAIL, "Example Org", ACCEPT_URL)
    ).resolves.toBe("invitation")
    expect(mocks.sendInvitationEmail).toHaveBeenCalledWith(
      EMAIL,
      "Example Org",
      ACCEPT_URL
    )
    expect(mocks.createKeycloakUser).not.toHaveBeenCalled()
  })

  it("creates a missing account and sends finish-registration actions", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    mocks.findUserByEmail.mockResolvedValue(null)
    mocks.createKeycloakUser.mockResolvedValue("new-user")

    await expect(
      deliverInvitationEmail(EMAIL, "Example Org", ACCEPT_URL)
    ).resolves.toBe("onboarding")
    expect(mocks.createKeycloakUser).toHaveBeenCalledWith({
      username: EMAIL,
      email: EMAIL,
      enabled: true,
      emailVerified: false,
      requiredActions: ["UPDATE_PROFILE", "UPDATE_PASSWORD", "VERIFY_EMAIL"],
    })
    expect(mocks.sendUserRequiredActionsEmail).toHaveBeenCalledWith(
      "new-user",
      {
        clientId: "archispark-web",
        redirectUri: ACCEPT_URL,
        lifespan: 604800,
        actions: ["UPDATE_PROFILE", "UPDATE_PASSWORD", "VERIFY_EMAIL"],
      }
    )
  })

  it("resends onboarding actions for an account still awaiting setup", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    mocks.findUserByEmail.mockResolvedValue({
      id: "pending-user",
      username: EMAIL,
      email: EMAIL,
      emailVerified: false,
      requiredActions: ["UPDATE_PROFILE", "UPDATE_PASSWORD", "VERIFY_EMAIL"],
    })

    await expect(
      deliverInvitationEmail(EMAIL, "Example Org", ACCEPT_URL)
    ).resolves.toBe("onboarding")
    expect(mocks.createKeycloakUser).not.toHaveBeenCalled()
    expect(mocks.sendUserRequiredActionsEmail).toHaveBeenCalledWith(
      "pending-user",
      expect.objectContaining({ redirectUri: ACCEPT_URL })
    )
  })

  it("removes a newly created account when action e-mail delivery fails", async () => {
    vi.stubEnv("KEYCLOAK_CLIENT_ID_WEB", "archispark-web")
    mocks.findUserByEmail.mockResolvedValue(null)
    mocks.createKeycloakUser.mockResolvedValue("new-user")
    mocks.sendUserRequiredActionsEmail.mockRejectedValue(
      new Error("SMTP unavailable")
    )

    await expect(
      deliverInvitationEmail(EMAIL, "Example Org", ACCEPT_URL)
    ).rejects.toThrow("SMTP unavailable")
    expect(mocks.deleteKeycloakUser).toHaveBeenCalledWith("new-user")
  })
})
