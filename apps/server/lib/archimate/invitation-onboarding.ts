/** Keycloak account provisioning and delivery for organization invitations. */

import {
  createKeycloakUser,
  deleteKeycloakUser,
  findUserByEmail,
  sendUserRequiredActionsEmail,
  type KeycloakUserRepresentation,
} from "@workspace/auth"
import { sendInvitationEmail } from "./mail"

const ONBOARDING_ACTIONS = ["UPDATE_PROFILE", "UPDATE_PASSWORD", "VERIFY_EMAIL"]

export type InvitationEmailKind = "invitation" | "onboarding"

function isPendingOnboarding(user: KeycloakUserRepresentation): boolean {
  return (
    user.emailVerified !== true &&
    user.requiredActions?.includes("UPDATE_PASSWORD") === true
  )
}

async function createPendingUser(email: string): Promise<string> {
  return createKeycloakUser({
    username: email,
    email,
    enabled: true,
    emailVerified: false,
    requiredActions: ONBOARDING_ACTIONS,
  })
}

async function sendOnboardingEmail(
  userId: string,
  acceptUrl: string
): Promise<void> {
  const clientId = process.env["KEYCLOAK_CLIENT_ID_WEB"]
  if (!clientId) throw new Error("KEYCLOAK_CLIENT_ID_WEB is not set")
  await sendUserRequiredActionsEmail(userId, {
    clientId,
    redirectUri: acceptUrl,
    lifespan: 7 * 24 * 3600,
    actions: ONBOARDING_ACTIONS,
  })
}

/**
 * Existing accounts receive the normal ArchiSpark invitation. Missing
 * accounts are provisioned without credentials and receive Keycloak's
 * finish-registration actions, returning to the invitation afterwards.
 */
export async function deliverInvitationEmail(
  email: string,
  organizationName: string,
  acceptUrl: string
): Promise<InvitationEmailKind> {
  let user = await findUserByEmail(email)
  let createdUserId: string | null = null

  if (!user) {
    try {
      createdUserId = await createPendingUser(email)
      user = {
        id: createdUserId,
        username: email,
        email,
        emailVerified: false,
        requiredActions: ONBOARDING_ACTIONS,
      }
    } catch (error) {
      // A concurrent invitation may have created the same identity first.
      user = await findUserByEmail(email)
      if (!user) throw error
    }
  }

  if (createdUserId || isPendingOnboarding(user)) {
    if (!user.id) throw new Error("Keycloak user response is missing its id")
    try {
      await sendOnboardingEmail(user.id, acceptUrl)
      return "onboarding"
    } catch (error) {
      if (createdUserId) {
        try {
          await deleteKeycloakUser(createdUserId)
        } catch (rollbackError) {
          console.error(
            `[invitations] failed to roll back Keycloak user ${createdUserId}:`,
            rollbackError
          )
        }
      }
      throw error
    }
  }

  await sendInvitationEmail(email, organizationName, acceptUrl)
  return "invitation"
}
