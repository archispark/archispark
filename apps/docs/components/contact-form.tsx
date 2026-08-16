"use client"

import { useState, type FormEvent } from "react"

type Status = "idle" | "sending" | "sent" | "error"

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("sending")
    setErrorMessage(null)

    const form = event.currentTarget
    const data = new FormData(form)

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          company: data.get("company"),
        }),
      })
      if (!response.ok) throw new Error("request failed")
      setStatus("sent")
      form.reset()
    } catch {
      setStatus("error")
      setErrorMessage(
        "Something went wrong. Try again, or email us directly at contact@archispark.io."
      )
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Name
        <input name="name" autoComplete="name" required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Message
        <textarea name="message" rows={5} required />
      </label>
      {/* Honeypot : masqué visuellement et pour les lecteurs d'écran, un
          bot qui remplit tous les champs le remplit aussi. */}
      <label className="landing-contact-honeypot" aria-hidden="true">
        Company
        <input name="company" tabIndex={-1} autoComplete="off" />
      </label>
      <button
        type="submit"
        className="landing-primary"
        disabled={status === "sending"}
      >
        {status === "sending" ? "Sending…" : "Send message →"}
      </button>
      {status === "sent" && (
        <small className="landing-contact-success">
          Message sent — we&apos;ll get back to you shortly.
        </small>
      )}
      {status === "error" && (
        <small className="landing-contact-error">{errorMessage}</small>
      )}
      {status === "idle" && (
        <small>We usually reply within one business day.</small>
      )}
    </form>
  )
}
