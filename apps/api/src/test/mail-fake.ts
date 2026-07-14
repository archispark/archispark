/**
 * In-memory fake of ./mail.ts, used to test the invitation flow without
 * hitting a real SMTP server. Spread/return from a `vi.mock("./mail.js",
 * ...)` factory — mirrors the pattern in keycloak-users-fake.ts.
 */

export interface SentInvitationEmail {
  to: string
  organizationName: string
  acceptUrl: string
}

let sentEmails: SentInvitationEmail[] = []
let shouldFail = false

/** Clears sent emails and the failure flag. Call between tests. */
export function resetMailFake(): void {
  sentEmails = []
  shouldFail = false
}

/** Makes the next sendInvitationEmail() calls reject, simulating an SMTP outage. */
export function setMailFakeShouldFail(fail: boolean): void {
  shouldFail = fail
}

export function getSentInvitationEmails(): SentInvitationEmail[] {
  return sentEmails
}

export function invitationAcceptUrl(token: string): string {
  return `https://test.local/invitations/${token}`
}

export async function sendInvitationEmail(
  to: string,
  organizationName: string,
  acceptUrl: string
): Promise<void> {
  if (shouldFail) throw new Error("SMTP failure (fake)")
  sentEmails.push({ to, organizationName, acceptUrl })
}
