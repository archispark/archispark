/**
 * SMTP client (nodemailer) for the one e-mail ArchiSpark sends itself in the
 * invitation flow — "you're invited to join <org>". Keycloak sends its own
 * "verify your e-mail" natively after self-registration (see
 * packages/db/scripts/setup-realm.ts's smtpServer patch), reusing the same
 * SMTP_* variables so there's a single mail config for both.
 */

import nodemailer, { type Transporter } from "nodemailer"
import { escXml } from "./xml-escape.js"

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  const host = process.env["SMTP_HOST"]
  if (!host) throw new Error("SMTP_HOST n'est pas configuré.")
  if (!transporter) {
    const user = process.env["SMTP_USER"]
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env["SMTP_PORT"] || "587"),
      auth: user
        ? { user, pass: process.env["SMTP_PASSWORD"] || "" }
        : undefined,
    })
  }
  return transporter
}

/**
 * Builds the invitation acceptance link from ARCHISPARK_URL — never from the
 * incoming request's Host/X-Forwarded-Host header, which is caller-
 * controlled and would let an attacker redirect the invitation link to an
 * arbitrary domain.
 */
export function invitationAcceptUrl(token: string): string {
  const base = process.env["ARCHISPARK_URL"]
  if (!base) throw new Error("ARCHISPARK_URL n'est pas configuré.")
  return `${base.replace(/\/+$/, "")}/invitations/${token}`
}

export async function sendInvitationEmail(
  to: string,
  organizationName: string,
  acceptUrl: string
): Promise<void> {
  const from = process.env["SMTP_FROM"] || "no-reply@archispark.local"
  const org = escXml(organizationName)
  await getTransporter().sendMail({
    from,
    to,
    subject: `Invitation à rejoindre « ${organizationName} » sur ArchiSpark`,
    text: [
      `Vous avez été invité(e) à rejoindre l'organisation « ${organizationName} » sur ArchiSpark.`,
      "",
      `Acceptez l'invitation : ${acceptUrl}`,
      "",
      "Ce lien expire dans 7 jours.",
    ].join("\n"),
    html: [
      `<p>Vous avez été invité(e) à rejoindre l'organisation « <strong>${org}</strong> » sur ArchiSpark.</p>`,
      `<p><a href="${acceptUrl}">Accepter l'invitation</a></p>`,
      "<p>Ce lien expire dans 7 jours.</p>",
    ].join("\n"),
  })
}
