import { describe, it, expect } from "vitest"
import { ARCHISPARK_IMAGE_PROPERTY_ID as CLIENT_ID } from "./image-library"
import { ARCHISPARK_IMAGE_PROPERTY_ID as DB_ID } from "@workspace/db"

// This client-side constant is intentionally duplicated (see image-library.ts)
// so browser bundles never import @workspace/db. Keep both in sync.
describe("ARCHISPARK_IMAGE_PROPERTY_ID", () => {
  it("matches the canonical value exported by @workspace/db", () => {
    expect(CLIENT_ID).toBe(DB_ID)
  })
})
