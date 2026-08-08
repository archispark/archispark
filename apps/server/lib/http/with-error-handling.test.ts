import { describe, it, expect } from "vitest"
import { NextRequest } from "next/server"
import { withErrorHandling } from "./with-error-handling"
import { NotFoundError } from "@/lib/archimate/errors"

const req = () => new NextRequest("http://localhost/api/x")

describe("withErrorHandling", () => {
  it("passes through a successful response", async () => {
    const handler = withErrorHandling(async () => new Response("ok"))
    const res = await handler(req())
    expect(await res.text()).toBe("ok")
  })

  it("maps AppError subclasses to their status code and message", async () => {
    const handler = withErrorHandling(async () => {
      throw new NotFoundError("Introuvable.")
    })
    const res = await handler(req())
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ detail: "Introuvable." })
  })

  it("maps unknown errors to a generic 500", async () => {
    const handler = withErrorHandling(async () => {
      throw new Error("boom")
    })
    const res = await handler(req())
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ detail: "boom" })
  })
})
