import { NextResponse } from "next/server"
import {
  isHoneypotFilled,
  sendContactEmail,
  validateContactPayload,
  type ContactPayload,
} from "@/lib/contact"

export async function POST(request: Request): Promise<NextResponse> {
  let body: Partial<ContactPayload>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 })
  }

  // Un bot qui remplit le honeypot reçoit une réponse de succès factice —
  // pas d'indice qu'il a été détecté.
  if (isHoneypotFilled(body)) {
    return NextResponse.json({ ok: true })
  }

  const errors = validateContactPayload(body)
  if (Object.keys(errors).length > 0 || !body.name || !body.email || !body.message) {
    return NextResponse.json({ errors }, { status: 422 })
  }

  try {
    await sendContactEmail({
      name: body.name.trim(),
      email: body.email.trim(),
      message: body.message.trim(),
    })
  } catch {
    return NextResponse.json(
      { error: "L'envoi du message a échoué. Réessayez plus tard." },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
