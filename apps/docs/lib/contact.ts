import nodemailer, { type Transporter } from "nodemailer"

export interface ContactPayload {
  name: string
  email: string
  message: string
  // Champ honeypot : un formulaire rempli par un humain le laisse vide, un
  // bot qui remplit tous les champs le trahit.
  company: string
}

export interface ContactFieldErrors {
  name?: string
  email?: string
  message?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateContactPayload(
  payload: Partial<ContactPayload>
): ContactFieldErrors {
  const errors: ContactFieldErrors = {}
  if (!payload.name || !payload.name.trim()) {
    errors.name = "Le nom est requis."
  }
  if (!payload.email || !EMAIL_RE.test(payload.email.trim())) {
    errors.email = "L'adresse e-mail est invalide."
  }
  if (!payload.message || !payload.message.trim()) {
    errors.message = "Le message est requis."
  }
  return errors
}

export function isHoneypotFilled(payload: Partial<ContactPayload>): boolean {
  return Boolean(payload.company && payload.company.trim())
}

// Même variables SMTP_* que apps/server (voir lib/archimate/mail.ts) : un
// seul jeu de réglages SMTP pour tout le monorepo, chargé depuis le .env
// racine via loadEnv() dans next.config.mjs.
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

export async function sendContactEmail(
  payload: Pick<ContactPayload, "name" | "email" | "message">
): Promise<void> {
  const to = process.env["CONTACT_TO_EMAIL"]
  if (!to) throw new Error("CONTACT_TO_EMAIL n'est pas configuré.")
  const from = process.env["SMTP_FROM"] || "no-reply@archispark.local"

  const { name, email, message } = payload
  await getTransporter().sendMail({
    from,
    to,
    replyTo: email,
    subject: `Nouveau message de contact — ${name}`,
    text: [`Nom : ${name}`, `E-mail : ${email}`, "", message].join("\n"),
  })
}
